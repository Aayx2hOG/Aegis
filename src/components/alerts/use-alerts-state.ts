'use client'

import { useEffect, useMemo, useState } from 'react'
import type { WalletContextState } from '@solana/wallet-adapter-react'
import { useWalletAuth } from '@/lib/hooks/use-wallet-auth'
import { normalizeProtocolSlug } from '@/lib/protocol/slug-resolver'
import { useAlertMarketData } from '@/components/alerts/use-alert-market-data'
import { useGuestAlertWalletAddress } from '@/components/alerts/use-guest-alert-wallet-address'
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

export function useAlertsState(wallet: WalletContextState) {
  const walletAddress = wallet.publicKey?.toBase58()
  const { authenticate, isAuthenticating } = useWalletAuth(wallet)
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
  const [walletAuthRequired, setWalletAuthRequired] = useState(false)

  const selectedAlertCurrentValue = useMemo(() => {
    return getSelectedAlertCurrentValue(alertProtocolSlug, alertMetric)
  }, [alertMetric, alertProtocolSlug, getSelectedAlertCurrentValue])

  const visibleAlertRules = useMemo(() => (showAllAlertRules ? rules : rules.slice(0, 3)), [rules, showAllAlertRules])

  const alertWalletAddress = walletAddress ?? guestAlertWalletAddress

  async function fetchAlertState(targetWalletAddress: string) {
    const res = await fetch(`/api/alerts/rules?walletAddress=${encodeURIComponent(targetWalletAddress)}`)
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      const error = new Error(body?.error ?? 'Alerts unavailable.')
      error.name = res.status === 401 ? 'WalletAuthRequired' : 'AlertFetchError'
      throw error
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
      setWalletAuthRequired(false)
    } catch (err) {
      if (err instanceof Error && err.name === 'WalletAuthRequired' && walletAddress) {
        setAlertStorageMode('loading')
        setRules([])
        setEvents([])
        setWalletAuthRequired(true)
        setDbStatus('Sign your connected wallet to load saved database alerts.')
        return
      }

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
        credentials: 'same-origin',
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
        if (res.status === 401 && walletAddress) {
          setWalletAuthRequired(true)
          setDbStatus('Sign your connected wallet to save database alerts.')
          throw new Error('Wallet authentication required')
        }
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
      if (err instanceof Error && err.message === 'Wallet authentication required' && walletAddress) {
        toast.error('Sign your wallet first to save database alerts.')
        return null
      }

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
        credentials: 'same-origin',
        body: JSON.stringify({ walletAddress: alertWalletAddress }),
      })

      const body = (await res.json().catch(() => null)) as {
        error?: string
        triggered?: number
        skipped?: number
        results?: AlertEvaluationResultItem[]
      } | null
      if (!res.ok) {
        if (res.status === 401 && walletAddress) {
          setWalletAuthRequired(true)
          setDbStatus('Sign your connected wallet to run saved database alerts.')
          return
        }
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
          if (!cancelled) {
            if (res.status === 401 && walletAddress) {
              setWalletAuthRequired(true)
              setAlertStorageMode('loading')
              setRules([])
              setEvents([])
              setDbStatus('Sign your connected wallet to load saved database alerts.')
            } else {
              setDbStatus(body?.error ?? 'Alerts unavailable.')
            }
          }
          return
        }
        const body = (await res.json()) as { rules: AlertRuleItem[]; recentEvents: AlertEventItem[] }
        if (!cancelled) {
          setRules(body.rules ?? [])
          setEvents(body.recentEvents ?? [])
          setDbStatus(null)
          setAlertStorageMode('database')
          setWalletAuthRequired(false)
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

  async function authenticateWalletAndReload() {
    try {
      await authenticate()
      setWalletAuthRequired(false)
      setDbStatus(null)
      await reloadAlerts()
      toast.success('Wallet authenticated. Saved alerts loaded.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wallet authentication failed.')
    }
  }

  useEffect(() => {
    if (!alertWalletAddress || walletAuthRequired) return

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
  }, [alertWalletAddress, walletAuthRequired])

  return {
    walletAddress,
    authenticateWalletAndReload,
    isAuthenticating,
    availableAlertProtocolSlugs,
    findMarketProtocol,
    priceBySlug,
    history,
    rules,
    events,
    setEvents,
    testResults,
    evaluationResults,
    dbStatus,
    historyLoading,
    alertsLoading,
    alertProtocolSlug,
    setAlertProtocolSlug,
    alertMetric,
    setAlertMetric,
    alertDirection,
    setAlertDirection,
    alertThreshold,
    setAlertThreshold,
    creatingAlert,
    evaluatingAlerts,
    updatingRuleId,
    deletingRuleId,
    regeneratingEventId,
    setRegeneratingEventId,
    pollingEventId,
    setPollingEventId,
    fullSummaryEventId,
    setFullSummaryEventId,
    fullSummaryOpen,
    setFullSummaryOpen,
    testRuleOpen,
    setTestRuleOpen,
    selectedTestRule,
    testRuleValue,
    setTestRuleValue,
    alertStorageMode,
    showAllAlertRules,
    setShowAllAlertRules,
    walletAuthRequired,
    selectedAlertCurrentValue,
    visibleAlertRules,
    alertWalletAddress,
    createAlertRule,
    openTestRuleDialog,
    createAndTestAlert,
    runSpecificAlertTest,
    runAlertEvaluation,
    toggleAlertRule,
    deleteAlertRule,
  }
}
