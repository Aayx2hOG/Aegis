'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Activity, ChevronDown, ExternalLink, Layers3, Plus, Play, ShieldAlert, Trash2 } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { useMultiChain } from '@/components/chain/chain-provider'
import { useMultiChainWatchlistByChain } from '@/hooks/use-multichain-watchlist'
import { fetchJson } from '@/lib/api/fetch-json'
import { normalizeProtocolSlug, resolveProtocolFromList } from '@/shared/protocol/slug-resolver'
import { ChainEnvironment, ChainType } from '@/lib/chain/types'
import type { SolanaProtocol } from '@/shared/types'
import { toast } from 'sonner'

type AlertMetric = 'CHANGE_1D' | 'CHANGE_7D' | 'TVL_USD' | 'PRICE_USD'
type AlertDirection = 'BELOW' | 'ABOVE'

interface ResearchHistoryItem {
    id: string
    protocolSlug: string
    briefMarkdown: string
    createdAt: string
}

interface AlertRuleItem {
    id: string
    protocolSlug: string
    metric: AlertMetric
    threshold: number
    direction: AlertDirection
    enabled: boolean
    createdAt: string
}

interface AlertEventItem {
    ruleId?: string
    id: string
    protocolSlug: string
    metric: AlertMetric
    threshold: number
    direction: AlertDirection
    currentValue: number
    triggeredAt: string
    summary?: string
    summaryGeneratedAt?: string
}

interface AlertTestResultItem {
    id: string
    ruleId: string
    protocolSlug: string
    metric: AlertMetric
    threshold: number
    direction: AlertDirection
    currentValue: number
    triggered: boolean
    createdAt: string
    summary: string
}

interface AlertEvaluationResultItem {
    ruleId: string
    protocolSlug: string
    metric: AlertMetric
    threshold: number
    direction: AlertDirection
    status: 'triggered' | 'skipped'
    currentValue: number | null
    reason: string
}

type CoinGeckoResponse = {
    market_data?: {
        current_price?: {
            usd?: number | null
        }
        price_change_percentage_24h?: number | null
    }
}

type DefiLlamaProtocolDetail = {
    slug?: string
    tokensInUsd?: Array<{ date: number; tokens?: Record<string, number> }>
    tokens?: Array<{ date: number; tokens?: Record<string, number> }>
    mcap?: number | null
    symbol?: string | null
    address?: string | null
}

type WatchlistMarketRow = {
    slug: string
    chainName: string
    chainType: ChainType
    market?: SolanaProtocol & {
        gecko_id?: string | null
        geckoId?: string | null
    }
    geckoId: string | null
}

type LocalAlertStore = {
    rules: AlertRuleItem[]
    events: AlertEventItem[]
    updatedAt: string
}

const LOCAL_ALERT_STORAGE_PREFIX = 'aegis-alerts:'

function getLocalAlertStorageKey(walletAddress: string) {
    return `${LOCAL_ALERT_STORAGE_PREFIX}${walletAddress}`
}

function createLocalAlertId(prefix: string) {
    return `${prefix}-${crypto.randomUUID()}`
}

function readLocalAlertStore(walletAddress: string): LocalAlertStore {
    if (typeof window === 'undefined') {
        return { rules: [], events: [], updatedAt: new Date().toISOString() }
    }

    try {
        const raw = window.localStorage.getItem(getLocalAlertStorageKey(walletAddress))
        if (!raw) return { rules: [], events: [], updatedAt: new Date().toISOString() }

        const parsed = JSON.parse(raw) as Partial<LocalAlertStore>
        return {
            rules: Array.isArray(parsed.rules) ? (parsed.rules as AlertRuleItem[]) : [],
            events: Array.isArray(parsed.events) ? (parsed.events as AlertEventItem[]) : [],
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
        }
    } catch {
        return { rules: [], events: [], updatedAt: new Date().toISOString() }
    }
}

function writeLocalAlertStore(walletAddress: string, store: LocalAlertStore) {
    if (typeof window === 'undefined') return

    try {
        window.localStorage.setItem(getLocalAlertStorageKey(walletAddress), JSON.stringify(store))
    } catch {
        console.error('Failed to save local alerts')
    }
}

function formatAlertValue(metric: AlertMetric, value: number): string {
    if (metric === 'TVL_USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            notation: 'compact',
            maximumFractionDigits: 1,
        }).format(value)
    }
    if (metric === 'PRICE_USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 2,
        }).format(value)
    }
    return `${value.toFixed(2)}%`
}

function buildLocalAlertSummary(rule: AlertRuleItem, currentValue: number) {
    const metricLabel = ALERT_METRIC_LABEL[rule.metric]
    const relationLabel = currentValue === rule.threshold ? 'equal to' : currentValue < rule.threshold ? 'below' : 'above'
    const formattedVal = formatAlertValue(rule.metric, currentValue)
    const formattedThreshold = formatAlertValue(rule.metric, rule.threshold)
    return `${rule.protocolSlug} ${metricLabel} is ${formattedVal}, which is ${relationLabel} ${formattedThreshold}.`
}

function getLocalCurrentValueForRule(rule: AlertRuleItem, market?: SolanaProtocol, price?: number | null) {
    if (rule.metric === 'TVL_USD') return market?.tvl ?? null
    if (rule.metric === 'PRICE_USD') return price ?? null
    if (!market) return null
    return rule.metric === 'CHANGE_7D' ? market.change_7d ?? null : market.change_1d ?? null
}

function isLocalAlertTriggered(rule: AlertRuleItem, currentValue: number) {
    return rule.direction === 'BELOW' ? currentValue <= rule.threshold : currentValue >= rule.threshold
}

function getAlertEventKey(event: AlertEventItem) {
    return event.ruleId ?? `${event.protocolSlug}:${event.metric}:${event.direction}:${event.threshold.toFixed(4)}`
}

function normalizeAlertEvents(events: AlertEventItem[]) {
    const deduped = new Map<string, AlertEventItem>()

    events
        .slice()
        .sort((left, right) => new Date(right.triggeredAt).getTime() - new Date(left.triggeredAt).getTime())
        .forEach((event) => {
            const key = getAlertEventKey(event)
            if (!deduped.has(key)) {
                deduped.set(key, event)
            }
        })

    return Array.from(deduped.values())
}

function getLatestTokenPriceFromProtocolDetail(detail?: DefiLlamaProtocolDetail): number | null {
    if (!detail) return null

    const latestUsdEntry = detail.tokensInUsd?.[detail.tokensInUsd.length - 1]
    const latestTokenEntry = detail.tokens?.[detail.tokens.length - 1]
    if (!latestUsdEntry || !latestTokenEntry) return null

    const usdTokens = latestUsdEntry.tokens ?? {}
    const rawTokens = latestTokenEntry.tokens ?? {}
    const symbols = Object.keys(usdTokens)

    for (const symbol of symbols) {
        const usdValue = usdTokens[symbol]
        const tokenAmount = rawTokens[symbol]
        if (typeof usdValue === 'number' && typeof tokenAmount === 'number' && tokenAmount > 0) {
            const derived = usdValue / tokenAmount
            if (Number.isFinite(derived) && derived > 0) return derived
        }
    }

    return null
}

const ALERT_METRIC_LABEL: Record<AlertMetric, string> = {
    CHANGE_1D: '24h change',
    CHANGE_7D: '7d change',
    TVL_USD: 'TVL',
    PRICE_USD: 'Token Price',
}

export default function AlertsPage() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const { activeChain, allChains } = useMultiChain()
    const wallet = useWallet()
    const walletAddress = wallet.publicKey?.toBase58()
    const { data: watchlistsByChainData } = useMultiChainWatchlistByChain(walletAddress)
    const watchlistsByChain = useMemo<Record<string, string[]>>(() => watchlistsByChainData ?? {}, [watchlistsByChainData])

    const protocolChainTypes = useMemo(
        () => Array.from(new Set(allChains.map((chain) => chain.type))),
        [allChains]
    )

    const protocolQueries = useQueries({
        queries: protocolChainTypes.map((chainType) => ({
            queryKey: ['chain-protocols', chainType],
            queryFn: async () => {
                const controller = new AbortController()
                const timeout = setTimeout(() => controller.abort(), 12_000)

                try {
                    return await fetchJson<SolanaProtocol[]>(`/api/defillama?chain=${encodeURIComponent(chainType)}`, {
                        signal: controller.signal,
                    })
                } finally {
                    clearTimeout(timeout)
                }
            },
            staleTime: 60_000,
            refetchInterval: 60_000,
            retry: false,
        })),
    })

    const protocolsByChainType = useMemo(() => {
        return protocolChainTypes.reduce<Partial<Record<ChainType, SolanaProtocol[]>>>((acc, chainType, index) => {
            acc[chainType] = (protocolQueries[index]?.data as SolanaProtocol[] | undefined) ?? []
            return acc
        }, {})
    }, [protocolChainTypes, protocolQueries])

    const watchlistMarketRows = useMemo(() => {
        return allChains.flatMap((chain) => {
            const protocols = protocolsByChainType[chain.type] ?? []
            return (watchlistsByChain[chain.name] ?? []).map<WatchlistMarketRow>((slug) => {
                const market = resolveProtocolFromList(slug, protocols)
                const geckoId = (market as WatchlistMarketRow['market'] | undefined)?.gecko_id
                    ?? (market as WatchlistMarketRow['market'] | undefined)?.geckoId
                    ?? null

                return { slug, chainName: chain.name, chainType: chain.type, market, geckoId }
            })
        })
    }, [allChains, protocolsByChainType, watchlistsByChain])

    const geckoIds = useMemo(
        () => Array.from(new Set(watchlistMarketRows.map((row) => row.geckoId).filter((value): value is string => Boolean(value)))),
        [watchlistMarketRows]
    )

    const priceQueries = useQueries({
        queries: geckoIds.map((geckoId) => ({
            queryKey: ['coingecko-price', geckoId],
            queryFn: async () => {
                const res = await fetchJson<CoinGeckoResponse>(`/api/coingecko?id=${encodeURIComponent(geckoId)}`)
                return {
                    priceUsd: res.market_data?.current_price?.usd ?? null,
                    priceChange24h: res.market_data?.price_change_percentage_24h ?? null,
                }
            },
            staleTime: 60_000,
            refetchInterval: 60_000,
            retry: false,
        })),
    })

    const detailTargets = useMemo(
        () => watchlistMarketRows.filter((row) => !row.geckoId).map((row) => row.slug),
        [watchlistMarketRows]
    )

    const detailQueries = useQueries({
        queries: detailTargets
            .map((row) => ({
                queryKey: ['defillama-protocol-detail', row],
                queryFn: async () => fetchJson<DefiLlamaProtocolDetail>(`/api/defillama/protocol?slug=${encodeURIComponent(row)}`),
                staleTime: 60_000,
                refetchInterval: 60_000,
                retry: false,
            })),
    })

    const priceByGeckoId = useMemo(() => {
        return priceQueries.reduce<Record<string, { priceUsd: number | null; priceChange24h: number | null }>>((acc, query, index) => {
            const geckoId = geckoIds[index]
            if (geckoId && query.data) {
                acc[geckoId] = query.data
            }
            return acc
        }, {})
    }, [geckoIds, priceQueries])

    const priceBySlug = useMemo(() => {
        const result: Record<string, { priceUsd: number | null; priceChange24h: number | null }> = {}

        watchlistMarketRows.forEach((row) => {
            if (row.geckoId) {
                const price = priceByGeckoId[row.geckoId]
                if (price) result[row.slug] = price
                return
            }

            const detail = detailQueries[detailTargets.indexOf(row.slug)]?.data as DefiLlamaProtocolDetail | undefined
            const priceUsd = getLatestTokenPriceFromProtocolDetail(detail)
            if (priceUsd != null) {
                result[row.slug] = { priceUsd, priceChange24h: null }
            }
        })

        return result
    }, [detailQueries, detailTargets, priceByGeckoId, watchlistMarketRows])

    const [history, setHistory] = useState<ResearchHistoryItem[]>([])
    const [rules, setRules] = useState<AlertRuleItem[]>([])
    const [events, setEvents] = useState<AlertEventItem[]>([])
    const [testResults, setTestResults] = useState<AlertTestResultItem[]>([])
    const [evaluationResults, setEvaluationResults] = useState<AlertEvaluationResultItem[]>([])
    const [, setDbStatus] = useState<string | null>(null)
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
    const [guestAlertWalletAddress, setGuestAlertWalletAddress] = useState<string | null>(null)
    const [alertStorageMode, setAlertStorageMode] = useState<'database' | 'local' | 'loading'>('loading')
    const [showAllAlertRules, setShowAllAlertRules] = useState(false)

    const findMarketProtocol = useMemo(() => {
        return (protocolSlug: string): SolanaProtocol | undefined => {
            const normalizedTarget = normalizeProtocolSlug(protocolSlug)

            const flatProtocols = Object.values(protocolsByChainType).flat().filter((p): p is SolanaProtocol => Boolean(p))
            const match = resolveProtocolFromList(normalizedTarget, flatProtocols)
            if (match) return match

            const rowMatch = watchlistMarketRows.find((row) => normalizeProtocolSlug(row.slug) === normalizedTarget || (row.market && normalizeProtocolSlug(row.market.slug) === normalizedTarget))
            return rowMatch?.market
        }
    }, [protocolsByChainType, watchlistMarketRows])

    const availableAlertProtocolSlugs = useMemo(
        () => Array.from(new Set(watchlistMarketRows.map((row) => row.slug))),
        [watchlistMarketRows]
    )

    const selectedAlertMarketRow = useMemo(
        () => watchlistMarketRows.find((row) => normalizeProtocolSlug(row.slug) === normalizeProtocolSlug(alertProtocolSlug)),
        [alertProtocolSlug, watchlistMarketRows]
    )

    const selectedAlertCurrentValue = useMemo(() => {
        if (!selectedAlertMarketRow) return null
        if (alertMetric === 'TVL_USD') {
            return selectedAlertMarketRow.market?.tvl ?? null
        }
        if (alertMetric === 'PRICE_USD') {
            return priceBySlug[selectedAlertMarketRow.slug]?.priceUsd ?? null
        }
        return alertMetric === 'CHANGE_7D'
            ? selectedAlertMarketRow.market?.change_7d ?? null
            : selectedAlertMarketRow.market?.change_1d ?? null
    }, [alertMetric, selectedAlertMarketRow, priceBySlug])

    const visibleAlertRules = useMemo(
        () => (showAllAlertRules ? rules : rules.slice(0, 3)),
        [rules, showAllAlertRules]
    )

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

    async function createAlertRule(options?: { threshold?: number; useLocal?: boolean }): Promise<{ mode: 'database' | 'local'; rule: AlertRuleItem } | null> {
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
        const formattedLive = liveValue == null ? 'No live market value was available.' : `Live value was ${formatAlertValue(rule.metric, liveValue)}.`
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

        toast.success(triggered 
            ? `Test PASSED: ${rule.protocolSlug} rule passed at ${formattedCurrent}.` 
            : `Test FAILED: ${rule.protocolSlug} rule failed at ${formattedCurrent}.`
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
                const nextRules = store.rules.map((existing) => existing.id === rule.id ? { ...existing, enabled: !existing.enabled } : existing)
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
        if (!currentAlertWalletAddress) return
        setGuestAlertWalletAddress(currentAlertWalletAddress)
    }, [alertWalletAddress])

    // Local storage generated address setup
    const [currentAlertWalletAddress, setCurrentAlertWalletAddress] = useState<string | null>(null)
    useEffect(() => {
        if (typeof window === 'undefined') return

        const storageKey = 'aegis-alert-guest-id'
        const existing = window.localStorage.getItem(storageKey)
        if (existing) {
            setCurrentAlertWalletAddress(existing)
            return
        }

        const generated = `guest-${crypto.randomUUID()}`
        window.localStorage.setItem(storageKey, generated)
        setCurrentAlertWalletAddress(generated)
    }, [])

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
        if (!alertWalletAddress) return;

        const eventSource = new EventSource(`/api/alerts/stream?walletAddress=${encodeURIComponent(alertWalletAddress)}`);

        eventSource.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data) as {
                    type: 'EVENT_CREATED' | 'SUMMARY_COMPLETED';
                    event: AlertEventItem;
                };

                if (payload.type === 'EVENT_CREATED') {
                    setEvents((prev) => {
                        const items = normalizeAlertEvents(prev);
                        if (items.some((e) => e.id === payload.event.id)) return prev;
                        return [payload.event, ...items];
                    });
                    toast.error(`⚠️ Alert Triggered: ${payload.event.protocolSlug} breached threshold!`, {
                        description: `${payload.event.metric} is now ${payload.event.currentValue.toFixed(2)}%`,
                        duration: 8000,
                    });
                } else if (payload.type === 'SUMMARY_COMPLETED') {
                    setEvents((prev) =>
                        normalizeAlertEvents(prev).map((e) =>
                            e.id === payload.event.id
                                ? { ...e, summary: payload.event.summary, summaryGeneratedAt: payload.event.summaryGeneratedAt }
                                : e
                        )
                    );
                    setPollingEventId((current) => current === payload.event.id ? null : current);
                    toast.success(`🤖 AI Brief generated for ${payload.event.protocolSlug}!`, {
                        description: payload.event.summary ? `${payload.event.summary.slice(0, 100)}...` : undefined,
                        duration: 6000,
                    });
                }
            } catch (err) {
                console.error('[SSE Client] Error parsing event:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('[SSE Client] Connection error:', err);
        };

        return () => {
            eventSource.close();
        };
    }, [alertWalletAddress]);

    return (
        <div className="min-h-screen text-zinc-100 selection:bg-cyan-400/20 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.2),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[10%] -left-[8%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />
                <div className="absolute top-[18%] -right-[8%] h-[32%] w-[32%] rounded-full bg-blue-500/10 blur-[100px]" />
            </div>

            <div className="relative mx-auto max-w-6xl space-y-10 px-4 py-10 md:space-y-12 md:px-6 md:py-14">
                <header className="space-y-5">
                    <Link
                        href="/watchlist"
                        className="group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:text-cyan-200"
                    >
                        <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                        Back to Watchlist
                    </Link>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-200">
                                <Layers3 className="h-3.5 w-3.5" />
                                Alerts
                            </div>
                            <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">
                                Alerts & <span className="text-cyan-200">Briefs</span>
                            </h1>
                            <p className="max-w-3xl text-zinc-300">
                                Create and evaluate alert rules, manually test parameters on watched protocols, and view your research brief timeline.
                            </p>
                        </div>
                    </div>
                </header>

                <section className="grid gap-6 lg:grid-cols-2">
                    {/* Alerts Rule Creation & Testing Form */}
                    <div className="rounded-3xl bg-zinc-900/45 p-5 backdrop-blur-xl ring-1 ring-white/5 space-y-6">
                        <div className="rounded-2xl border border-cyan-300/10 bg-zinc-950/60 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Create first alert</p>
                                    <p className="mt-1 text-sm text-zinc-400">Set one rule on a watched protocol, then run a live evaluation to verify it fires.</p>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => runAlertEvaluation()}
                                        disabled={!alertWalletAddress || evaluatingAlerts}
                                        title="Checks every saved alert against the latest market data"
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300/20 px-3 py-2 text-xs font-bold uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[150px]"
                                    >
                                        <Play className="h-3.5 w-3.5" />
                                        {evaluatingAlerts ? 'Running check…' : 'Run saved alerts'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={createAndTestAlert}
                                        disabled={!alertWalletAddress || creatingAlert || evaluatingAlerts || selectedAlertCurrentValue == null}
                                        title="Creates an alert at the current live value, then checks it immediately"
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[180px]"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Create & test
                                    </button>
                                </div>
                            </div>

                            <div className="mt-3 grid gap-2 text-[11px] text-zinc-500 sm:grid-cols-2">
                                <p>Run saved alerts: checks every enabled rule against the latest market data.</p>
                                <p>Create & test: saves the new rule and tests only that specific rule right away.</p>
                            </div>

                            <form
                                className="mt-4 grid gap-3 md:grid-cols-2"
                                onSubmit={async (event) => {
                                    event.preventDefault()
                                    await createAlertRule()
                                }}
                            >
                                <div className="md:col-span-2">
                                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Protocol slug</label>
                                    <div className="relative">
                                        <select
                                            value={alertProtocolSlug}
                                            onChange={(event) => setAlertProtocolSlug(event.target.value)}
                                            className="h-11 w-full appearance-none rounded-xl border border-cyan-300/15 bg-black px-3 pr-10 text-sm text-white outline-none transition hover:border-cyan-300/30 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20 [color-scheme:dark]"
                                            disabled={!alertWalletAddress || creatingAlert}
                                        >
                                            <option value="" disabled>
                                                Select a protocol from your watchlist
                                            </option>
                                            {availableAlertProtocolSlugs.map((slug) => (
                                                <option key={slug} value={slug} className="bg-black text-white">
                                                    {slug}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/70" />
                                    </div>
                                    <p className="mt-1 text-[11px] text-zinc-500">Choose a protocol from your current watchlist.</p>
                                    <p className="mt-2 text-[11px] text-zinc-400">
                                        Live {ALERT_METRIC_LABEL[alertMetric]}: {selectedAlertCurrentValue == null ? 'not available' : formatAlertValue(alertMetric, selectedAlertCurrentValue)}
                                    </p>
                                </div>

                                <div>
                                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Metric</label>
                                    <select
                                        value={alertMetric}
                                        onChange={(event) => {
                                            const nextMetric = event.target.value as AlertMetric
                                            setAlertMetric(nextMetric)
                                            if (nextMetric === 'TVL_USD') setAlertThreshold('10000000')
                                            else if (nextMetric === 'PRICE_USD') setAlertThreshold('1.00')
                                            else setAlertThreshold('10')
                                        }}
                                        className="h-11 w-full rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                                        disabled={!alertWalletAddress || creatingAlert}
                                    >
                                        <option value="CHANGE_1D">24h change</option>
                                        <option value="CHANGE_7D">7d change</option>
                                        <option value="TVL_USD">TVL ($)</option>
                                        <option value="PRICE_USD">Token Price ($)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Direction</label>
                                    <select
                                        value={alertDirection}
                                        onChange={(event) => setAlertDirection(event.target.value as AlertDirection)}
                                        className="h-11 w-full rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                                        disabled={!alertWalletAddress || creatingAlert}
                                    >
                                        <option value="BELOW">Below threshold</option>
                                        <option value="ABOVE">Above threshold</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                                        {alertMetric === 'CHANGE_1D' || alertMetric === 'CHANGE_7D' ? 'Threshold %' : 'Threshold ($)'}
                                    </label>
                                    <input
                                        type="number"
                                        step={alertMetric === 'PRICE_USD' ? '0.0001' : alertMetric === 'TVL_USD' ? '1000' : '0.1'}
                                        value={alertThreshold}
                                        onChange={(event) => setAlertThreshold(event.target.value)}
                                        placeholder={alertMetric === 'PRICE_USD' ? '1.50' : alertMetric === 'TVL_USD' ? '10000000' : '10'}
                                        className="h-11 w-full rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                                        disabled={!alertWalletAddress || creatingAlert}
                                    />
                                    <p className="mt-1 text-[11px] text-zinc-500">
                                        {alertMetric === 'TVL_USD'
                                            ? 'Enter absolute TVL in USD (e.g. 50000000 for $50M).'
                                            : alertMetric === 'PRICE_USD'
                                            ? 'Enter target token price in USD (e.g. 1.25).'
                                            : 'Use the live value above if you want this rule to fire on the next check.'}
                                    </p>
                                </div>

                                <div className="flex items-end">
                                    <button
                                        type="submit"
                                        disabled={!alertWalletAddress || creatingAlert}
                                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                    >
                                        <Plus className="h-4 w-4" />
                                        {creatingAlert ? 'Creating…' : 'Save alert'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Alert Rules List */}
                        <div className="rounded-2xl bg-zinc-950/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Alert rules</p>
                                {rules.length > 0 && <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{rules.length} saved</span>}
                            </div>
                            {rules.length === 0 ? (
                                <p className="mt-2 text-sm text-zinc-400">No rules yet. Create one above to start monitoring a protocol.</p>
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {visibleAlertRules.map((rule) => (
                                        <div key={rule.id} className="rounded-xl bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="font-semibold text-zinc-100">{rule.protocolSlug}</p>
                                                    <p className="text-[11px] text-zinc-400">
                                                        {ALERT_METRIC_LABEL[rule.metric]} {rule.direction === 'BELOW' ? '≤' : '≥'} {formatAlertValue(rule.metric, rule.threshold)}
                                                    </p>
                                                </div>
                                                <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${rule.enabled ? 'bg-emerald-500/15 text-emerald-200' : 'bg-zinc-800 text-zinc-400'}`}>
                                                    {rule.enabled ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openTestRuleDialog(rule)}
                                                    disabled={updatingRuleId === rule.id || deletingRuleId === rule.id}
                                                    className="rounded-lg bg-cyan-300/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                                >
                                                    Test this rule
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAlertRule(rule)}
                                                    disabled={updatingRuleId === rule.id || deletingRuleId === rule.id}
                                                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                                >
                                                    {updatingRuleId === rule.id ? 'Updating…' : rule.enabled ? 'Disable' : 'Enable'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => deleteAlertRule(rule)}
                                                    disabled={updatingRuleId === rule.id || deletingRuleId === rule.id}
                                                    className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                                >
                                                    {deletingRuleId === rule.id ? 'Deleting…' : 'Delete'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {rules.length > 3 && (
                                <div className="mt-3 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => setShowAllAlertRules((current) => !current)}
                                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 cursor-pointer"
                                    >
                                        {showAllAlertRules ? 'Show fewer' : `Show all ${rules.length}`}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Last check results */}
                        <div className="rounded-2xl bg-zinc-950/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Last check</p>
                                {evaluationResults.length > 0 && <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{evaluationResults.length} rules</span>}
                            </div>
                            {evaluationResults.length === 0 ? (
                                <p className="mt-2 text-sm text-zinc-400">Run saved alerts to see which rules passed or failed.</p>
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {evaluationResults.map((result) => {
                                        const condition = `${ALERT_METRIC_LABEL[result.metric]} ${result.direction === 'BELOW' ? '≤' : '≥'} ${formatAlertValue(result.metric, result.threshold)}`
                                        const statusLabel = result.status === 'triggered' ? 'PASSED' : 'FAILED'
                                        const tone = result.status === 'triggered'
                                            ? 'bg-emerald-500/10 text-emerald-100'
                                            : 'bg-rose-500/10 text-rose-100'

                                        return (
                                            <div key={result.ruleId} className={`rounded-xl px-3 py-2 text-sm ${tone}`}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="font-semibold">
                                                        {result.protocolSlug} {statusLabel} - {condition}
                                                    </div>
                                                    <span className="text-[10px] uppercase tracking-wide text-zinc-400">{result.status === 'triggered' ? 'Triggered' : 'Skipped'}</span>
                                                </div>
                                                <p className="mt-1 text-xs text-zinc-300">
                                                    {result.currentValue == null ? result.reason : `${result.reason} Current value: ${formatAlertValue(result.metric, result.currentValue)}.`}
                                                </p>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Brief history & triggers */}
                    <div className="rounded-3xl bg-zinc-900/45 p-5 backdrop-blur-xl ring-1 ring-white/5 space-y-6">
                        {/* Research history Timeline */}
                        <div className="rounded-2xl bg-zinc-950/60 p-4">
                            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Recent brief history</p>
                            {historyLoading ? (
                                <p className="mt-2 text-sm text-zinc-400">Loading history...</p>
                            ) : history.length === 0 ? (
                                <p className="mt-2 text-sm text-zinc-400">No saved research runs yet. Generate reports to build your timeline.</p>
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {history.slice(0, 3).map((item) => (
                                        <div key={item.id} className="rounded-xl bg-zinc-900/70 p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <Link href={`/research?q=${item.protocolSlug}`} className="text-sm font-bold uppercase tracking-wide text-cyan-200 hover:underline">
                                                    {item.protocolSlug}
                                                </Link>
                                                <span className="text-[10px] text-zinc-500">{new Date(item.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-300">{item.briefMarkdown}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Recent triggered briefs */}
                        <div className="rounded-2xl bg-zinc-950/60 p-4">
                            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Recent triggers</p>
                            {events.length === 0 ? (
                                <p className="mt-2 text-sm text-zinc-400">No alert events yet.</p>
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {normalizeAlertEvents(events).slice(0, 3).map((event) => (
                                        <div key={event.id} className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="font-semibold">{event.protocolSlug} hit {ALERT_METRIC_LABEL[event.metric]} at {event.currentValue.toFixed(2)}%</div>
                                                <div>
                                                    <button
                                                        className="text-xs opacity-90 hover:underline cursor-pointer"
                                                        disabled={regeneratingEventId === event.id}
                                                        onClick={async () => {
                                                            try {
                                                                setRegeneratingEventId(event.id)
                                                                const res = await fetch(`/api/alerts/events/${event.id}/regenerate`, { method: 'POST' })
                                                                const body = await res.json()
                                                                if (res.status === 202) {
                                                                    toast.success('Regeneration queued — will update shortly')
                                                                    setPollingEventId(event.id)
                                                                } else if (!res.ok) {
                                                                    toast.error(body?.error ?? 'Failed to regenerate summary')
                                                                    return
                                                                } else {
                                                                    const updated = body.event
                                                                    setEvents((prev) => prev.map((e) => (e.id === updated.id ? { ...e, summary: updated.summary, summaryGeneratedAt: updated.summaryGeneratedAt } : e)))
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
                                                        {regeneratingEventId === event.id ? 'Regenerating…' : 'Regenerate summary'}
                                                    </button>
                                                </div>
                                            </div>
                                            {event.summary ? (
                                                <>
                                                    <p className="mt-1 line-clamp-2 text-xs text-rose-100/80">{event.summary}</p>
                                                    <p className="mt-1 text-[10px] text-rose-200">Generated: {event.summaryGeneratedAt ? new Date(event.summaryGeneratedAt).toLocaleString() : 'unknown'}</p>
                                                </>
                                            ) : (
                                                <p className="mt-1 text-[10px] text-rose-200">No summary yet.</p>
                                            )}
                                            <div className="mt-2 flex gap-2">
                                                <button
                                                    className="text-xs opacity-90 hover:underline cursor-pointer"
                                                    onClick={() => {
                                                        if (event.summary) {
                                                            setFullSummaryEventId(event.id)
                                                            setFullSummaryOpen(true)
                                                        } else {
                                                            toast('No summary to view yet')
                                                        }
                                                    }}
                                                >
                                                    View full summary
                                                </button>
                                                {pollingEventId === event.id && <span className="text-xs text-zinc-400">Polling for update…</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            {/* SSE full summary details dialog */}
            {fullSummaryOpen && fullSummaryEventId ? (() => {
                const evt = events.find((e) => e.id === fullSummaryEventId)
                if (!evt) return null
                const condition = `${ALERT_METRIC_LABEL[evt.metric]} ${evt.direction === 'BELOW' ? '≤' : '≥'} ${evt.threshold.toFixed(2)}%`

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                        <div className="max-h-[84vh] w-[min(900px,95%)] overflow-auto rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Alert details</p>
                                    <h3 className="mt-2 text-xl font-black text-white">{evt.protocolSlug}</h3>
                                    <p className="mt-1 text-sm text-zinc-400">Why this alert fired and what exactly was checked.</p>
                                </div>
                                <button
                                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white cursor-pointer"
                                    onClick={() => setFullSummaryOpen(false)}
                                >
                                    Close
                                </button>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Metric</p>
                                    <p className="mt-2 text-sm font-semibold text-zinc-100">{ALERT_METRIC_LABEL[evt.metric]}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Condition</p>
                                    <p className="mt-2 text-sm font-semibold text-zinc-100">{condition}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Current value</p>
                                    <p className="mt-2 text-sm font-semibold text-zinc-100">{`${evt.currentValue.toFixed(2)}%`}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Triggered at</p>
                                    <p className="mt-2 text-sm font-semibold text-zinc-100">{new Date(evt.triggeredAt).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Full summary</p>
                                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-200">
                                    {evt.summary ?? 'No summary available.'}
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                                <span>Generated: {evt.summaryGeneratedAt ? new Date(evt.summaryGeneratedAt).toLocaleString() : 'unknown'}</span>
                                <button
                                    type="button"
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-semibold text-zinc-200 transition hover:bg-white/10 cursor-pointer"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(
                                                [
                                                    `Protocol: ${evt.protocolSlug}`,
                                                    `Metric: ${ALERT_METRIC_LABEL[evt.metric]}`,
                                                    `Condition: ${condition}`,
                                                    `Current value: ${evt.currentValue.toFixed(2)}%`,
                                                    `Triggered at: ${new Date(evt.triggeredAt).toLocaleString()}`,
                                                    `Generated: ${evt.summaryGeneratedAt ? new Date(evt.summaryGeneratedAt).toLocaleString() : 'unknown'}`,
                                                    '',
                                                    evt.summary ?? 'No summary available.',
                                                ].join('\n')
                                            )
                                            toast.success('Copied full summary to clipboard.')
                                        } catch {
                                            toast.error('Could not copy the summary.')
                                        }
                                    }}
                                >
                                    Copy full summary
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })() : null}

            {/* Rule testing dialog */}
            <Dialog open={testRuleOpen} onOpenChange={setTestRuleOpen}>
                <DialogContent className="border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Manual test rule</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Enter a value to see whether the rule would pass or fail. This does not create a real alert.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedTestRule && (
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">
                                <p className="font-semibold text-zinc-100">{selectedTestRule.protocolSlug}</p>
                                <p className="mt-1 text-zinc-400">
                                    {ALERT_METRIC_LABEL[selectedTestRule.metric]} {selectedTestRule.direction === 'BELOW' ? '≤' : '≥'} {formatAlertValue(selectedTestRule.metric, selectedTestRule.threshold)}
                                </p>
                            </div>
                            <label className="grid gap-2 text-sm text-zinc-300">
                                Test value
                                <input
                                    type="number"
                                    step={selectedTestRule.metric === 'PRICE_USD' ? '0.0001' : selectedTestRule.metric === 'TVL_USD' ? '1000' : '0.1'}
                                    value={testRuleValue}
                                    onChange={(event) => setTestRuleValue(event.target.value)}
                                    className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition focus:border-cyan-400/60"
                                />
                            </label>
                            <p className="text-xs text-zinc-500">
                                Current live value for reference:{' '}
                                {(() => {
                                    const market = findMarketProtocol(selectedTestRule.protocolSlug)
                                    const price = priceBySlug[selectedTestRule.protocolSlug]?.priceUsd ?? null
                                    const liveValue = getLocalCurrentValueForRule(selectedTestRule, market, price)
                                    return liveValue == null ? 'unavailable' : formatAlertValue(selectedTestRule.metric, liveValue)
                                })()}
                            </p>
                            {testResults[0]?.ruleId === selectedTestRule.id ? (
                                <div className={`rounded-2xl border p-4 text-sm space-y-2 backdrop-blur-md ${testResults[0].triggered 
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' 
                                    : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold uppercase tracking-wider text-[10px]">Latest manual result</p>
                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${testResults[0].triggered
                                            ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30'
                                            : 'bg-rose-500/20 text-rose-100 border border-rose-500/30'
                                        }`}>
                                            {testResults[0].triggered ? '🟢 PASSED (Alert Fires)' : '🔴 FAILED (No Alert)'}
                                        </span>
                                    </div>
                                    <p className="text-zinc-300 text-xs leading-relaxed">{testResults[0].summary}</p>
                                </div>
                            ) : null}
                        </div>
                    )}
                    <DialogFooter className="sm:justify-between">
                        <button
                            type="button"
                            onClick={() => setTestRuleOpen(false)}
                            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                if (!selectedTestRule) return
                                await runSpecificAlertTest(selectedTestRule, testRuleValue)
                            }}
                            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-cyan-950 transition hover:bg-cyan-300 cursor-pointer"
                        >
                            Evaluate test
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
