'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Layers3, Loader2 } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Tabs } from '@/components/ui/tabs'
import ChannelManager from '@/components/notifications/channel-manager'
import { Badge } from '@/components/ui/badge'
import { AlertSummaryDialog } from '@/components/alerts/alert-summary-dialog'
import { AlertRuleTestDialog } from '@/components/alerts/alert-rule-test-dialog'
import { AlertRuleForm } from '@/components/alerts/alert-rule-form'
import { AlertRulesList } from '@/components/alerts/alert-rules-list'
import { AlertEvaluationResults } from '@/components/alerts/alert-evaluation-results'
import { AlertRecentActivity } from '@/components/alerts/alert-recent-activity'
import { useAlertMarketData } from '@/components/alerts/use-alert-market-data'
import { useGuestAlertWalletAddress } from '@/components/alerts/use-guest-alert-wallet-address'
import { normalizeProtocolSlug } from '@/lib/protocol/slug-resolver'
import type {
  AlertDirection,
  AlertEvaluationResultItem,
  AlertEventItem,
  AlertMetric,
  AlertRuleItem,
  AlertStorageMode,
  AlertTestResultItem,
  ResearchHistoryItem,
} from '@/components/alerts/alert-types'
import {
  buildLocalAlertSummary,
  createLocalAlertId,
  formatAlertValue,
  getLocalCurrentValueForRule,
  isLocalAlertTriggered,
  normalizeAlertEvents,
  readLocalAlertStore,
  writeLocalAlertStore,
} from '@/components/alerts/alert-utils'
import { toast } from 'sonner'

function AlertsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') === 'channels' ? 'channels' : 'signals'

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.replace(`/alerts?${params.toString()}`)
  }

  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58()
  const guestAlertWalletAddress = useGuestAlertWalletAddress()
  const { availableAlertProtocolSlugs, findMarketProtocol, getSelectedAlertCurrentValue, priceBySlug } =
    useAlertMarketData(walletAddress)

  const [history, setHistory] = useState<ResearchHistoryItem[]>([])
  const [rules, setRules] = useState<AlertRuleItem[]>([])
  const [events, setEvents] = useState<AlertEventItem[]>([])
  const [testResults, setTestResults] = useState<AlertTestResultItem[]>([])
  const [evaluationResults, setEvaluationResults] = useState<AlertEvaluationResultItem[]>([])
  const [dbStatus, setDbStatus] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertProtocolSlug, setAlertProtocolSlug] = useState('')
  const [alertMetric, setAlertMetric] = useState<AlertMetric>('CHANGE_1D')
  const [alertDirection, setAlertDirection] = useState<AlertDirection>('BELOW')
  const [alertThreshold, setAlertThreshold] = useState('10')
  const [creatingAlert, setCreatingAlert] = useState(false)
  const [evaluatingAlerts, setEvaluatingAlerts] = useState(false)
  const [updatingRuleId, setUpdatingRuleId] = useState<string | null>(null)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)
  const [regeneratingEventId, setRegeneratingEventId] = useState<string | null>(null)
  const [pollingEventId, setPollingEventId] = useState<string | null>(null)
  const [fullSummaryEventId, setFullSummaryEventId] = useState<string | null>(null)
  const [fullSummaryOpen, setFullSummaryOpen] = useState(false)
  const [testRuleOpen, setTestRuleOpen] = useState(false)
  const [selectedTestRule, setSelectedTestRule] = useState<AlertRuleItem | null>(null)
  const [testRuleValue, setTestRuleValue] = useState('')
  const [alertStorageMode, setAlertStorageMode] = useState<AlertStorageMode>('loading')
  const [showAllAlertRules, setShowAllAlertRules] = useState(false)

  const selectedAlertCurrentValue = useMemo(() => {
    return getSelectedAlertCurrentValue(alertProtocolSlug, alertMetric)
  }, [alertMetric, alertProtocolSlug, getSelectedAlertCurrentValue])

  const visibleAlertRules = useMemo(() => (showAllAlertRules ? rules : rules.slice(0, 3)), [rules, showAllAlertRules])

  const alertWalletAddress = walletAddress ?? guestAlertWalletAddress

  async function fetchAlertState(targetWalletAddress: string) {
    const res = await fetch(`/api/alerts/rules?walletAddress=${encodeURIComponent(targetWalletAddress)}`)
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? 'Alerts unavailable.')
    }

    return (await res.json()) as { rules: AlertRuleItem[]; recentEvents: AlertEventItem[] }
  }

  async function reloadAlerts() {
    if (!alertWalletAddress) {
      setRules([])
      setEvents([])
      return
    }

    setAlertsLoading(true)
    try {
      const body = await fetchAlertState(alertWalletAddress)
      setAlertStorageMode('database')
      setRules(body.rules ?? [])
      setEvents(normalizeAlertEvents(body.recentEvents ?? []))
      setDbStatus(null)
    } catch (err) {
      const localStore = readLocalAlertStore(alertWalletAddress)
      setAlertStorageMode('local')
      setRules(localStore.rules)
      setEvents(normalizeAlertEvents(localStore.events))
      setDbStatus(err instanceof Error ? err.message : 'Using local alert storage.')
    } finally {
      setAlertsLoading(false)
    }
  }

  function persistLocalRule(rule: AlertRuleItem) {
    if (!alertWalletAddress) return

    const store = readLocalAlertStore(alertWalletAddress)
    const nextRules = [rule, ...store.rules.filter((existing) => existing.id !== rule.id)]
    writeLocalAlertStore(alertWalletAddress, {
      ...store,
      rules: nextRules,
      updatedAt: new Date().toISOString(),
    })
    setRules(nextRules)
  }

  async function createAlertRule(options?: {
    threshold?: number
    useLocal?: boolean
  }): Promise<{ mode: 'database' | 'local'; rule: AlertRuleItem } | null> {
    if (!alertWalletAddress) {
      toast.error('Preparing alert identity...')
      return null
    }

    const protocolSlug = normalizeProtocolSlug(alertProtocolSlug)
    const threshold = Number(options?.threshold ?? alertThreshold)

    if (!protocolSlug) {
      toast.error('Choose a protocol slug.')
      return null
    }

    if (!Number.isFinite(threshold)) {
      toast.error('Enter a valid threshold.')
      return null
    }

    setCreatingAlert(true)
    try {
      if (options?.useLocal || alertStorageMode === 'local') {
        const localRule: AlertRuleItem = {
          id: createLocalAlertId('rule'),
          protocolSlug,
          metric: alertMetric,
          threshold,
          direction: alertDirection,
          enabled: true,
          createdAt: new Date().toISOString(),
        }

        persistLocalRule(localRule)
        setAlertStorageMode('local')
        toast.success(`Alert created for ${localRule.protocolSlug}.`)
        return { mode: 'local', rule: localRule }
      }

      const res = await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: alertWalletAddress,
          protocolSlug,
          metric: alertMetric,
          threshold,
          direction: alertDirection,
        }),
      })

      const body = (await res.json().catch(() => null)) as { error?: string; rule?: AlertRuleItem } | null
      if (!res.ok) {
        throw new Error(body?.error ?? 'Failed to create alert rule.')
      }

      toast.success(`Alert created for ${body?.rule?.protocolSlug ?? protocolSlug}.`)
      await reloadAlerts()
      return {
        mode: 'database',
        rule: body?.rule ?? {
          id: createLocalAlertId('rule'),
          protocolSlug,
          metric: alertMetric,
          threshold,
          direction: alertDirection,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      }
    } catch (err) {
      if (alertWalletAddress) {
        const localRule: AlertRuleItem = {
          id: createLocalAlertId('rule'),
          protocolSlug,
          metric: alertMetric,
          threshold,
          direction: alertDirection,
          enabled: true,
          createdAt: new Date().toISOString(),
        }

        persistLocalRule(localRule)
        setAlertStorageMode('local')
        setDbStatus('Prisma is unavailable, so alerts are being saved locally in this browser.')
        toast.success(`Alert created for ${localRule.protocolSlug}.`)
        return { mode: 'local', rule: localRule }
      }

      const message = err instanceof Error ? err.message : 'Failed to create alert rule.'
      toast.error(message)
      return null
    } finally {
      setCreatingAlert(false)
    }
  }

  function openTestRuleDialog(rule: AlertRuleItem) {
    const market = findMarketProtocol(rule.protocolSlug)
    const price = priceBySlug[rule.protocolSlug]?.priceUsd ?? null
    const liveValue = getLocalCurrentValueForRule(rule, market, price)
    setSelectedTestRule(rule)
    setTestRuleValue((liveValue ?? rule.threshold).toString())
    setTestRuleOpen(true)
  }

  async function createAndTestAlert() {
    const created = await createAlertRule({
      threshold: selectedAlertCurrentValue ?? undefined,
      useLocal: alertStorageMode === 'local',
    })

    if (!created) return

    await runAlertEvaluation(created.mode === 'local')
  }

  async function runSpecificAlertTest(rule: AlertRuleItem, valueText: string) {
    if (!alertWalletAddress) {
      toast.error('Preparing alert identity...')
      return
    }

    const currentValue = Number.parseFloat(valueText)
    if (!Number.isFinite(currentValue)) {
      toast.error('Enter a valid test value.')
      return
    }

    const market = findMarketProtocol(rule.protocolSlug)
    const price = priceBySlug[rule.protocolSlug]?.priceUsd ?? null
    const liveValue = getLocalCurrentValueForRule(rule, market, price)
    const triggered = isLocalAlertTriggered(rule, currentValue)
    const summary = buildLocalAlertSummary(rule, currentValue)
    const formattedCurrent = formatAlertValue(rule.metric, currentValue)
    const formattedLive =
      liveValue == null
        ? 'No live market value was available.'
        : `Live value was ${formatAlertValue(rule.metric, liveValue)}.`
    const testResult: AlertTestResultItem = {
      id: createLocalAlertId('test'),
      ruleId: rule.id,
      protocolSlug: rule.protocolSlug,
      metric: rule.metric,
      threshold: rule.threshold,
      direction: rule.direction,
      currentValue,
      triggered,
      createdAt: new Date().toISOString(),
      summary: `Tested against ${formattedCurrent}. ${formattedLive} ${summary}`,
    }

    setTestResults((prev) => [testResult, ...prev.filter((existing) => existing.ruleId !== rule.id)])

    toast.success(
      triggered
        ? `Test PASSED: ${rule.protocolSlug} rule passed at ${formattedCurrent}.`
        : `Test FAILED: ${rule.protocolSlug} rule failed at ${formattedCurrent}.`,
    )
  }

  async function runAlertEvaluation(forceLocal = false) {
    if (!alertWalletAddress) {
      toast.error('Preparing alert identity...')
      return
    }

    setEvaluatingAlerts(true)
    try {
      if (forceLocal || alertStorageMode === 'local') {
        const store = readLocalAlertStore(alertWalletAddress)
        const triggeredEvents: AlertEventItem[] = []
        let skippedEvents = 0
        const results: AlertEvaluationResultItem[] = []

        store.rules
          .filter((rule) => rule.enabled)
          .forEach((rule) => {
            const market = findMarketProtocol(rule.protocolSlug)
            const price = priceBySlug[rule.protocolSlug]?.priceUsd ?? null
            const currentValue = getLocalCurrentValueForRule(rule, market, price)
            if (currentValue == null) {
              skippedEvents++
              results.push({
                ruleId: rule.id,
                protocolSlug: rule.protocolSlug,
                metric: rule.metric,
                threshold: rule.threshold,
                direction: rule.direction,
                status: 'skipped',
                currentValue: null,
                reason: 'No live market value was available.',
              })
              return
            }

            if (!isLocalAlertTriggered(rule, currentValue)) {
              skippedEvents++
              results.push({
                ruleId: rule.id,
                protocolSlug: rule.protocolSlug,
                metric: rule.metric,
                threshold: rule.threshold,
                direction: rule.direction,
                status: 'skipped',
                currentValue,
                reason: buildLocalAlertSummary(rule, currentValue),
              })
              return
            }

            const event: AlertEventItem = {
              id: createLocalAlertId('event'),
              ruleId: rule.id,
              protocolSlug: rule.protocolSlug,
              metric: rule.metric,
              threshold: rule.threshold,
              direction: rule.direction,
              currentValue,
              triggeredAt: new Date().toISOString(),
              summary: buildLocalAlertSummary(rule, currentValue),
              summaryGeneratedAt: new Date().toISOString(),
            }
            triggeredEvents.push(event)
            results.push({
              ruleId: rule.id,
              protocolSlug: rule.protocolSlug,
              metric: rule.metric,
              threshold: rule.threshold,
              direction: rule.direction,
              status: 'triggered',
              currentValue,
              reason: buildLocalAlertSummary(rule, currentValue),
            })
          })

        if (triggeredEvents.length > 0) {
          const nextEvents = normalizeAlertEvents([...triggeredEvents, ...store.events])
          writeLocalAlertStore(alertWalletAddress, {
            ...store,
            events: nextEvents,
            updatedAt: new Date().toISOString(),
          })
          setEvents(nextEvents)
        }

        setEvaluationResults(results)
        toast.success(`Alert check complete: ${triggeredEvents.length} passed, ${skippedEvents} failed.`)
        return
      }

      const res = await fetch('/api/alerts/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: alertWalletAddress }),
      })

      const body = (await res.json().catch(() => null)) as {
        error?: string
        triggered?: number
        skipped?: number
        results?: AlertEvaluationResultItem[]
      } | null
      if (!res.ok) {
        throw new Error(body?.error ?? 'Failed to evaluate alerts.')
      }

      setEvaluationResults(body?.results ?? [])
      const triggeredCount = body?.triggered ?? 0
      const skippedCount = body?.skipped ?? 0
      toast.success(`Alert check complete: ${triggeredCount} passed, ${skippedCount} failed.`)
      await reloadAlerts()
    } catch (err) {
      setAlertStorageMode('local')
      const message = err instanceof Error ? err.message : 'Failed to evaluate alerts.'
      setDbStatus('Prisma is unavailable, so alerts are running in local test mode.')
      if (!forceLocal) {
        await runAlertEvaluation(true)
        return
      }
      toast.error(message)
    } finally {
      setEvaluatingAlerts(false)
    }
  }

  async function toggleAlertRule(rule: AlertRuleItem) {
    setUpdatingRuleId(rule.id)
    try {
      if (alertStorageMode === 'local' && alertWalletAddress) {
        const store = readLocalAlertStore(alertWalletAddress)
        const nextRules = store.rules.map((existing) =>
          existing.id === rule.id ? { ...existing, enabled: !existing.enabled } : existing,
        )
        writeLocalAlertStore(alertWalletAddress, { ...store, rules: nextRules, updatedAt: new Date().toISOString() })
        setRules(nextRules)
        toast.success(rule.enabled ? 'Alert disabled.' : 'Alert enabled.')
        return
      }

      const res = await fetch(`/api/alerts/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      })

      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        throw new Error(body?.error ?? 'Failed to update rule.')
      }

      toast.success(rule.enabled ? 'Alert disabled.' : 'Alert enabled.')
      await reloadAlerts()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update rule.'
      toast.error(message)
    } finally {
      setUpdatingRuleId(null)
    }
  }

  async function deleteAlertRule(rule: AlertRuleItem) {
    if (!window.confirm(`Delete the alert for ${rule.protocolSlug}?`)) return

    setDeletingRuleId(rule.id)
    try {
      if (alertStorageMode === 'local' && alertWalletAddress) {
        const store = readLocalAlertStore(alertWalletAddress)
        const nextRules = store.rules.filter((existing) => existing.id !== rule.id)
        writeLocalAlertStore(alertWalletAddress, { ...store, rules: nextRules, updatedAt: new Date().toISOString() })
        setRules(nextRules)
        toast.success('Alert deleted.')
        return
      }

      const res = await fetch(`/api/alerts/rules/${rule.id}`, { method: 'DELETE' })

      if (!res.ok && res.status !== 204) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Failed to delete rule.')
      }

      toast.success('Alert deleted.')
      await reloadAlerts()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete rule.'
      toast.error(message)
    } finally {
      setDeletingRuleId(null)
    }
  }

  useEffect(() => {
    if (!alertProtocolSlug && availableAlertProtocolSlugs.length > 0) {
      setAlertProtocolSlug(availableAlertProtocolSlugs[0])
    }
  }, [alertProtocolSlug, availableAlertProtocolSlugs])

  useEffect(() => {
    if (!walletAddress) {
      setHistory([])
      setDbStatus(null)
      setHistoryLoading(false)
    }

    let cancelled = false

    async function loadHistory() {
      if (!walletAddress) return
      setHistoryLoading(true)
      try {
        const encodedWalletAddress = encodeURIComponent(walletAddress)
        const res = await fetch(`/api/research/history?walletAddress=${encodedWalletAddress}&limit=6`)
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          if (!cancelled) setDbStatus(body?.error ?? 'Research history unavailable.')
          return
        }
        const body = (await res.json()) as { runs: ResearchHistoryItem[] }
        if (!cancelled) {
          setHistory(body.runs ?? [])
          setDbStatus(null)
        }
      } catch {
        if (!cancelled) setDbStatus('Research history unavailable.')
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }

    async function loadAlerts() {
      if (!alertWalletAddress) return
      setAlertsLoading(true)
      try {
        const res = await fetch(`/api/alerts/rules?walletAddress=${encodeURIComponent(alertWalletAddress)}`)
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          if (!cancelled) setDbStatus(body?.error ?? 'Alerts unavailable.')
          return
        }
        const body = (await res.json()) as { rules: AlertRuleItem[]; recentEvents: AlertEventItem[] }
        if (!cancelled) {
          setRules(body.rules ?? [])
          setEvents(body.recentEvents ?? [])
          setDbStatus(null)
        }
      } catch {
        if (!cancelled) setDbStatus('Alerts unavailable.')
      } finally {
        if (!cancelled) setAlertsLoading(false)
      }
    }

    loadHistory()
    loadAlerts()

    return () => {
      cancelled = true
    }
  }, [walletAddress, alertWalletAddress])

  useEffect(() => {
    if (!alertWalletAddress) return

    const eventSource = new EventSource(`/api/alerts/stream?walletAddress=${encodeURIComponent(alertWalletAddress)}`)

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type: 'EVENT_CREATED' | 'SUMMARY_COMPLETED'
          event: AlertEventItem
        }

        if (payload.type === 'EVENT_CREATED') {
          setEvents((prev) => {
            const items = normalizeAlertEvents(prev)
            if (items.some((e) => e.id === payload.event.id)) return prev
            return [payload.event, ...items]
          })
          toast.error(`⚠️ Alert Triggered: ${payload.event.protocolSlug} breached threshold!`, {
            description: `${payload.event.metric} is now ${payload.event.currentValue.toFixed(2)}%`,
            duration: 8000,
          })
        } else if (payload.type === 'SUMMARY_COMPLETED') {
          setEvents((prev) =>
            normalizeAlertEvents(prev).map((e) =>
              e.id === payload.event.id
                ? { ...e, summary: payload.event.summary, summaryGeneratedAt: payload.event.summaryGeneratedAt }
                : e,
            ),
          )
          setPollingEventId((current) => (current === payload.event.id ? null : current))
          toast.success(`Optional summary generated for ${payload.event.protocolSlug}`, {
            description: payload.event.summary ? `${payload.event.summary.slice(0, 100)}...` : undefined,
            duration: 6000,
          })
        }
      } catch (err) {
        console.error('[SSE Client] Error parsing event:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('[SSE Client] Connection error:', err)
    }

    return () => {
      eventSource.close()
    }
  }, [alertWalletAddress])

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-8 py-6 px-2 cyber-grid">
        <header className="space-y-4 text-left">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Link href="/watchlist">
                <span className="inline-flex items-center justify-center gap-1.5 font-orbitron font-bold border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900 text-zinc-300 rounded-xs text-xs px-3.5 py-2 cursor-pointer transition-all">
                  <ArrowLeft className="h-3.5 w-3.5 text-cyan-400" /> Back to Watchlist
                </span>
              </Link>
              <Badge
                variant="accent"
                className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-orbitron font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)] bg-cyan-950/20 text-cyan-400 border-cyan-500/20"
              >
                <Layers3 className="h-3.5 w-3.5 inline mr-1.5" /> Alerts System
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-orbitron font-black tracking-wide text-white md:text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.08)] uppercase">
              Alerts & Briefs
            </h1>
            <p className="max-w-3xl text-zinc-400 text-xs sm:text-sm leading-relaxed font-medium">
              Create and evaluate active alert rules, manually test parameters on watched protocols, and view your
              research brief timeline.
            </p>
          </div>
        </header>

        <Tabs
          activeTabValue={activeTab}
          onTabChange={handleTabChange}
          tabs={[
            {
              title: 'Alert Signals',
              value: 'signals',
              content: (
                <section className="grid gap-6 lg:grid-cols-2">
                  <div className="console-panel corner-decor border border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs space-y-6 shadow-2xl">
                    <AlertRuleForm
                      alertWalletAddress={alertWalletAddress}
                      availableProtocolSlugs={availableAlertProtocolSlugs}
                      creatingAlert={creatingAlert}
                      evaluatingAlerts={evaluatingAlerts}
                      protocolSlug={alertProtocolSlug}
                      metric={alertMetric}
                      direction={alertDirection}
                      threshold={alertThreshold}
                      selectedCurrentValue={selectedAlertCurrentValue}
                      onProtocolSlugChange={setAlertProtocolSlug}
                      onMetricChange={(nextMetric) => {
                        setAlertMetric(nextMetric)
                        if (nextMetric === 'TVL_USD') setAlertThreshold('10000000')
                        else if (nextMetric === 'PRICE_USD') setAlertThreshold('1.00')
                        else setAlertThreshold('10')
                      }}
                      onDirectionChange={setAlertDirection}
                      onThresholdChange={setAlertThreshold}
                      onCreateAlert={async () => {
                        await createAlertRule()
                      }}
                      onCreateAndTestAlert={createAndTestAlert}
                      onRunEvaluation={() => {
                        void runAlertEvaluation()
                      }}
                    />

                    <AlertRulesList
                      rules={rules}
                      visibleRules={visibleAlertRules}
                      loading={alertsLoading}
                      showAllRules={showAllAlertRules}
                      updatingRuleId={updatingRuleId}
                      deletingRuleId={deletingRuleId}
                      onShowAllRulesChange={setShowAllAlertRules}
                      onTestRule={openTestRuleDialog}
                      onToggleRule={toggleAlertRule}
                      onDeleteRule={deleteAlertRule}
                    />

                    <AlertEvaluationResults results={evaluationResults} />
                  </div>

                  <AlertRecentActivity
                    rules={rules}
                    events={events}
                    history={history}
                    storageMode={alertStorageMode}
                    loading={alertsLoading || historyLoading}
                    dbStatus={dbStatus}
                    historyLoading={historyLoading}
                    regeneratingEventId={regeneratingEventId}
                    pollingEventId={pollingEventId}
                    onRegeneratingEventIdChange={setRegeneratingEventId}
                    onPollingEventIdChange={setPollingEventId}
                    onEventsChange={(updater) => setEvents((current) => updater(current))}
                    onViewFullSummary={(eventId) => {
                      setFullSummaryEventId(eventId)
                      setFullSummaryOpen(true)
                    }}
                  />
                </section>
              ),
            },
            {
              title: 'Delivery Channels',
              value: 'channels',
              content: (
                <section className="console-panel corner-decor border border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs shadow-2xl md:p-6 text-left">
                  <ChannelManager />
                </section>
              ),
            },
          ]}
        />
      </div>

      <AlertSummaryDialog
        event={events.find((event) => event.id === fullSummaryEventId) ?? null}
        open={fullSummaryOpen}
        onOpenChange={setFullSummaryOpen}
      />

      <AlertRuleTestDialog
        open={testRuleOpen}
        onOpenChange={setTestRuleOpen}
        selectedRule={selectedTestRule}
        testRuleValue={testRuleValue}
        onTestRuleValueChange={setTestRuleValue}
        testResults={testResults}
        findMarketProtocol={findMarketProtocol}
        priceBySlug={priceBySlug}
        onEvaluate={runSpecificAlertTest}
      />
    </>
  )
}

export default function AlertsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      }
    >
      <AlertsContent />
    </Suspense>
  )
}
