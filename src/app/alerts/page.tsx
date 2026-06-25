'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, Layers3, Plus, Play, Loader2 } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Tabs } from '@/components/ui/tabs'
import ChannelManager from '@/components/notifications/channel-manager'
import { AlertTelemetryScanner } from '@/components/alerts/alert-telemetry-scanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertSummaryDialog } from '@/components/alerts/alert-summary-dialog'
import { AlertRuleTestDialog } from '@/components/alerts/alert-rule-test-dialog'
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
  ALERT_METRIC_LABEL,
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
          toast.success(`🤖 AI Brief generated for ${payload.event.protocolSlug}!`, {
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
                  {/* Alerts Rule Creation & Testing Form */}
                  <div className="console-panel corner-decor border border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs space-y-6 shadow-2xl">
                    <div className="rounded-xs border border-cyan-500/10 bg-zinc-950/60 p-4 space-y-4 shadow-md">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400">
                            Create Alert Vector
                          </p>
                          <p className="mt-1 text-xs text-zinc-400">
                            Set one rule on a watched protocol, then run a live evaluation to verify it fires.
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                          <Button
                            type="button"
                            onClick={() => runAlertEvaluation()}
                            disabled={!alertWalletAddress || evaluatingAlerts}
                            title="Checks every saved alert against the latest market data"
                            className="border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 font-mono rounded-xs text-xs sm:min-w-[150px] cursor-pointer"
                          >
                            <Play className="h-3.5 w-3.5 mr-1" />
                            {evaluatingAlerts ? 'Running check…' : 'Run saved alerts'}
                          </Button>
                          <Button
                            type="button"
                            onClick={createAndTestAlert}
                            disabled={
                              !alertWalletAddress ||
                              creatingAlert ||
                              evaluatingAlerts ||
                              selectedAlertCurrentValue == null
                            }
                            title="Creates an alert at the current live value, then checks it immediately"
                            className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-black uppercase tracking-wider rounded-xs shadow-[0_0_8px_rgba(6,182,212,0.2)] transition-all sm:min-w-[180px] text-xs h-9 sm:h-auto py-2 px-3 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Create & test
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 font-mono">
                        <p>&gt; Run saved alerts: checks every enabled rule against the latest market data.</p>
                        <p>&gt; Create & test: saves the new rule and tests only that specific rule right away.</p>
                      </div>

                      <form
                        className="mt-4 grid gap-4 md:grid-cols-2"
                        onSubmit={async (event) => {
                          event.preventDefault()
                          await createAlertRule()
                        }}
                      >
                        <div className="md:col-span-2">
                          <label className="mb-1.5 block text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400/80">
                            Protocol slug
                          </label>
                          <div className="relative">
                            <select
                              value={alertProtocolSlug}
                              onChange={(event) => setAlertProtocolSlug(event.target.value)}
                              className="flex h-11 w-full rounded-xs border border-zinc-800 bg-zinc-950/80 px-3 pr-10 text-sm shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono appearance-none"
                              disabled={!alertWalletAddress || creatingAlert}
                            >
                              <option value="" disabled className="bg-zinc-950 text-white">
                                Select a protocol from your watchlist
                              </option>
                              {availableAlertProtocolSlugs.map((slug) => (
                                <option key={slug} value={slug} className="bg-zinc-950 text-white font-mono">
                                  {slug}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          </div>
                          <p className="mt-1 text-xs text-zinc-450 font-medium">
                            Choose a protocol from your current watchlist.
                          </p>
                          <p className="mt-2 text-xs text-cyan-400 font-mono">
                            Live {ALERT_METRIC_LABEL[alertMetric]}:{' '}
                            {selectedAlertCurrentValue == null
                              ? 'not available'
                              : formatAlertValue(alertMetric, selectedAlertCurrentValue)}
                          </p>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400/80">
                            Metric
                          </label>
                          <select
                            value={alertMetric}
                            onChange={(event) => {
                              const nextMetric = event.target.value as AlertMetric
                              setAlertMetric(nextMetric)
                              if (nextMetric === 'TVL_USD') setAlertThreshold('10000000')
                              else if (nextMetric === 'PRICE_USD') setAlertThreshold('1.00')
                              else setAlertThreshold('10')
                            }}
                            className="flex h-11 w-full rounded-xs border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-sm shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono"
                            disabled={!alertWalletAddress || creatingAlert}
                          >
                            <option value="CHANGE_1D" className="bg-zinc-950 text-white">
                              24h change
                            </option>
                            <option value="CHANGE_7D" className="bg-zinc-950 text-white">
                              7d change
                            </option>
                            <option value="TVL_USD" className="bg-zinc-950 text-white">
                              TVL ($)
                            </option>
                            <option value="PRICE_USD" className="bg-zinc-950 text-white">
                              Token Price ($)
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400/80">
                            Direction
                          </label>
                          <select
                            value={alertDirection}
                            onChange={(event) => setAlertDirection(event.target.value as AlertDirection)}
                            className="flex h-11 w-full rounded-xs border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-sm shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono"
                            disabled={!alertWalletAddress || creatingAlert}
                          >
                            <option value="BELOW" className="bg-zinc-950 text-white font-mono">
                              Below threshold
                            </option>
                            <option value="ABOVE" className="bg-zinc-950 text-white font-mono">
                              Above threshold
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400/80">
                            {alertMetric === 'CHANGE_1D' || alertMetric === 'CHANGE_7D'
                              ? 'Threshold %'
                              : 'Threshold ($)'}
                          </label>
                          <Input
                            type="number"
                            step={alertMetric === 'PRICE_USD' ? '0.0001' : alertMetric === 'TVL_USD' ? '1000' : '0.1'}
                            value={alertThreshold}
                            onChange={(event) => setAlertThreshold(event.target.value)}
                            placeholder={
                              alertMetric === 'PRICE_USD' ? '1.50' : alertMetric === 'TVL_USD' ? '10000000' : '10'
                            }
                            className="h-11 rounded-xs border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-white focus:border-cyan-500/30 font-mono"
                            disabled={!alertWalletAddress || creatingAlert}
                          />
                          <p className="mt-1 text-xs text-zinc-450 leading-relaxed font-medium">
                            {alertMetric === 'TVL_USD'
                              ? 'Enter absolute TVL in USD (e.g. 50000000 for $50M).'
                              : alertMetric === 'PRICE_USD'
                                ? 'Enter target token price in USD (e.g. 1.25).'
                                : 'Use the live value above if you want this rule to fire on the next check.'}
                          </p>
                        </div>

                        <div className="flex items-end">
                          <Button
                            type="submit"
                            disabled={!alertWalletAddress || creatingAlert}
                            className="h-11 w-full bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-black uppercase tracking-wider rounded-xs shadow-[0_0_8px_rgba(6,182,212,0.2)] transition-all text-xs cursor-pointer"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            {creatingAlert ? 'Creating…' : 'Save alert'}
                          </Button>
                        </div>
                      </form>
                    </div>

                    {/* Alert Rules List */}
                    <div className="rounded-xs border border-cyan-500/10 bg-zinc-950/60 p-4 space-y-4 shadow-md">
                      <div className="flex items-center justify-between gap-3 border-b border-zinc-900 pb-2">
                        <p className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400">
                          Active Alert Rules
                        </p>
                        {rules.length > 0 && (
                          <span className="text-xs font-mono font-bold text-zinc-450">
                            {alertsLoading ? 'loading...' : `${rules.length} saved`}
                          </span>
                        )}
                      </div>
                      {rules.length === 0 ? (
                        <p className="text-xs text-zinc-400 leading-normal font-mono">
                          &gt; No rules yet. Create one above to start monitoring a protocol.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {visibleAlertRules.map((rule) => (
                            <div
                              key={rule.id}
                              className="rounded-xs border border-zinc-900 bg-zinc-950/80 px-3.5 py-3 text-xs text-zinc-200"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-bold text-white text-sm font-orbitron tracking-wider">
                                    {rule.protocolSlug}
                                  </p>
                                  <p className="text-xs text-zinc-400 font-mono mt-1">
                                    {ALERT_METRIC_LABEL[rule.metric]} {rule.direction === 'BELOW' ? '≤' : '≥'}{' '}
                                    {formatAlertValue(rule.metric, rule.threshold)}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-xs px-2 py-0.5 text-[10px] font-mono font-bold uppercase border ${rule.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}
                                >
                                  {rule.enabled ? 'Active' : 'Disabled'}
                                </span>
                              </div>
                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openTestRuleDialog(rule)}
                                  disabled={updatingRuleId === rule.id || deletingRuleId === rule.id}
                                  style={{
                                    borderColor: 'rgba(6, 182, 212, 0.3)',
                                    backgroundColor: 'rgba(6, 182, 212, 0.05)',
                                    color: '#67e8f9',
                                  }}
                                  className="border rounded-xs font-mono text-xs px-2.5 py-1.5 cursor-pointer transition-all hover:bg-cyan-500/15 hover:text-cyan-200"
                                >
                                  Test this rule
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleAlertRule(rule)}
                                  disabled={updatingRuleId === rule.id || deletingRuleId === rule.id}
                                  style={
                                    rule.enabled
                                      ? {
                                          borderColor: 'rgba(245, 158, 11, 0.3)',
                                          backgroundColor: 'rgba(245, 158, 11, 0.05)',
                                          color: '#f59e0b',
                                        }
                                      : {
                                          borderColor: 'rgba(16, 185, 129, 0.3)',
                                          backgroundColor: 'rgba(16, 185, 129, 0.05)',
                                          color: '#10b981',
                                        }
                                  }
                                  className="border rounded-xs font-mono text-xs px-2.5 py-1.5 cursor-pointer transition-all hover:opacity-80"
                                >
                                  {updatingRuleId === rule.id ? 'Updating…' : rule.enabled ? 'Disable' : 'Enable'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteAlertRule(rule)}
                                  disabled={updatingRuleId === rule.id || deletingRuleId === rule.id}
                                  style={{
                                    borderColor: 'rgba(244, 63, 94, 0.3)',
                                    backgroundColor: 'rgba(244, 63, 94, 0.05)',
                                    color: '#fda4af',
                                  }}
                                  className="border rounded-xs font-mono text-xs px-2.5 py-1.5 cursor-pointer transition-all hover:bg-rose-500/15 hover:text-rose-200"
                                >
                                  {deletingRuleId === rule.id ? 'Deleting…' : 'Delete'}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {rules.length > 3 && (
                        <div className="mt-3 flex justify-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAllAlertRules((current) => !current)}
                            className="border border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-xs font-mono text-xs px-3 py-1.5 cursor-pointer"
                          >
                            {showAllAlertRules ? 'Show fewer' : `Show all ${rules.length}`}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Last check results */}
                    <div className="rounded-xs border border-cyan-500/10 bg-zinc-950/60 p-4 space-y-4 shadow-md">
                      <div className="flex items-center justify-between gap-3 border-b border-zinc-900 pb-2">
                        <p className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400">
                          Last Evaluation Run
                        </p>
                        {evaluationResults.length > 0 && (
                          <span className="text-xs font-mono font-bold text-zinc-450">
                            {evaluationResults.length} rules
                          </span>
                        )}
                      </div>
                      {evaluationResults.length === 0 ? (
                        <p className="text-xs text-zinc-400 font-mono leading-normal">
                          &gt; Run saved alerts to see which rules passed or failed.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {evaluationResults.map((result) => {
                            const condition = `${ALERT_METRIC_LABEL[result.metric]} ${result.direction === 'BELOW' ? '≤' : '≥'} ${formatAlertValue(result.metric, result.threshold)}`
                            const statusLabel = result.status === 'triggered' ? 'PASSED' : 'SKIPPED'
                            const tone =
                              result.status === 'triggered'
                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/5 border border-rose-500/15 text-rose-300'

                            return (
                              <div key={result.ruleId} className={`rounded-xs px-3.5 py-3 text-xs ${tone}`}>
                                <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-1.5 mb-2">
                                  <div className="font-bold font-orbitron tracking-wide">
                                    {result.protocolSlug} {statusLabel}
                                  </div>
                                  <span className="text-xs font-mono font-bold uppercase opacity-85">
                                    {result.status === 'triggered' ? 'Triggered' : 'Skipped'}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-zinc-300 font-mono leading-relaxed">
                                  Condition: {condition} <br />
                                  {result.currentValue == null
                                    ? result.reason
                                    : `${result.reason} Current value: ${formatAlertValue(result.metric, result.currentValue)}.`}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Brief history & triggers */}
                  <div className="console-panel corner-decor border border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs space-y-6 shadow-2xl">
                    {/* Telemetry sweep visual */}
                    <AlertTelemetryScanner
                      rules={rules}
                      events={events}
                      historyCount={history.length}
                      storageMode={alertStorageMode}
                      loading={alertsLoading || historyLoading}
                      dbStatus={dbStatus}
                    />

                    {/* Research history Timeline */}
                    <div className="rounded-xs border border-cyan-500/10 bg-zinc-950/60 p-4 space-y-4 shadow-md">
                      <p className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400 border-b border-zinc-900 pb-2">
                        Recent Brief History
                      </p>
                      {historyLoading ? (
                        <p className="text-xs text-zinc-400 font-mono leading-normal">&gt; Loading history...</p>
                      ) : history.length === 0 ? (
                        <p className="text-xs text-zinc-400 font-mono leading-normal">
                          &gt; No saved research runs yet. Generate reports to build your timeline.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {history.slice(0, 3).map((item) => (
                            <div key={item.id} className="rounded-xs border border-zinc-900 bg-zinc-950/80 p-3.5">
                              <div className="flex items-center justify-between gap-2 border-b border-zinc-900 pb-1.5 mb-2">
                                <Link
                                  href={`/research?q=${item.protocolSlug}`}
                                  className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 hover:underline"
                                >
                                  {item.protocolSlug}
                                </Link>
                                <span className="text-[10px] font-mono text-zinc-550 font-semibold">
                                  {new Date(item.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-300 font-mono">
                                {item.briefMarkdown}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent triggered briefs */}
                    <div className="rounded-xs border border-cyan-500/10 bg-zinc-950/60 p-4 space-y-4 shadow-md">
                      <p className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400 border-b border-zinc-900 pb-2">
                        Recent System Triggers
                      </p>
                      {events.length === 0 ? (
                        <p className="text-xs text-zinc-400 font-mono leading-normal">&gt; No alert events yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {normalizeAlertEvents(events)
                            .slice(0, 3)
                            .map((event) => (
                              <div
                                key={event.id}
                                className="rounded-xs border border-rose-500/15 bg-rose-500/5 px-3.5 py-3 text-xs text-rose-250"
                              >
                                <div className="flex items-start justify-between gap-2 border-b border-rose-500/10 pb-1.5 mb-2">
                                  <div className="font-bold font-orbitron tracking-wide text-rose-300">
                                    {event.protocolSlug} hit {ALERT_METRIC_LABEL[event.metric]} at{' '}
                                    {formatAlertValue(event.metric, event.currentValue)}
                                  </div>
                                  <div>
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="text-xs font-mono font-bold text-rose-300 hover:text-rose-100 hover:underline p-0 h-auto cursor-pointer"
                                      disabled={regeneratingEventId === event.id}
                                      onClick={async () => {
                                        try {
                                          setRegeneratingEventId(event.id)
                                          const res = await fetch(`/api/alerts/events/${event.id}/regenerate`, {
                                            method: 'POST',
                                          })
                                          const body = await res.json()
                                          if (res.status === 202) {
                                            toast.success('Regeneration queued — will update shortly')
                                            setPollingEventId(event.id)
                                          } else if (!res.ok) {
                                            toast.error(body?.error ?? 'Failed to regenerate summary')
                                            return
                                          } else {
                                            const updated = body.event
                                            setEvents((prev) =>
                                              prev.map((e) =>
                                                e.id === updated.id
                                                  ? {
                                                      ...e,
                                                      summary: updated.summary,
                                                      summaryGeneratedAt: updated.summaryGeneratedAt,
                                                    }
                                                  : e,
                                              ),
                                            )
                                            toast.success('Summary regenerated')
                                          }
                                        } catch (err) {
                                          console.error('[regen] error', err)
                                          toast.error('Failed to regenerate summary')
                                        } finally {
                                          setRegeneratingEventId(null)
                                        }
                                      }}
                                    >
                                      {regeneratingEventId === event.id ? 'Regenerating…' : '[Regenerate summary]'}
                                    </Button>
                                  </div>
                                </div>
                                {event.summary ? (
                                  <>
                                    <p className="mt-1 line-clamp-2 text-xs text-rose-100/80 leading-relaxed font-mono">
                                      {event.summary}
                                    </p>
                                    <p className="mt-2 text-[10px] font-mono text-rose-350">
                                      Generated:{' '}
                                      {event.summaryGeneratedAt
                                        ? new Date(event.summaryGeneratedAt).toLocaleString()
                                        : 'unknown'}
                                    </p>
                                  </>
                                ) : (
                                  <p className="mt-1 text-[10px] font-mono text-rose-350">No summary yet.</p>
                                )}
                                <div className="mt-3 flex gap-3 border-t border-rose-500/10 pt-2">
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="text-xs font-mono font-bold text-rose-300 hover:text-rose-100 hover:underline p-0 h-auto cursor-pointer"
                                    onClick={() => {
                                      if (event.summary) {
                                        setFullSummaryEventId(event.id)
                                        setFullSummaryOpen(true)
                                      } else {
                                        toast('No summary to view yet')
                                      }
                                    }}
                                  >
                                    [View full summary]
                                  </Button>
                                  {pollingEventId === event.id && (
                                    <span className="text-xs font-mono text-zinc-450">Polling for update…</span>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
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
