'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Activity, ChevronDown, ExternalLink, Layers3, Plus, Play, ShieldAlert } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { useMultiChain } from '@/components/chain/chain-provider'
import { useMultiChainWatchlistByChain } from '@/hooks/use-multichain-watchlist'
import { fetchJson } from '@/lib/api/fetch-json'
import { normalizeProtocolSlug, resolveProtocolFromList } from '@/shared/protocol/slug-resolver'
import MiniMetric from '@/components/ui/mini-metric'
import { ChainEnvironment, ChainType } from '@/lib/chain/types'
import type { SolanaProtocol } from '@/shared/types/protocol'
import { toast } from 'sonner'

type AlertMetric = 'CHANGE_1D' | 'CHANGE_7D'
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

type AnomalySeverity = 'critical' | 'high' | 'moderate'

type AnomalyType = 'tvl_move' | 'liquidity_compression' | 'concentration_shift' | 'chain_spike'

interface AnomalyAlertItem {
    id: string
    type: AnomalyType
    severity: AnomalySeverity
    title: string
    detail: string
    actionLabel: string
    actionKind: 'refresh' | 'research' | 'war-room'
    protocolSlug?: string | null
    chainName?: string
}

interface ProtocolSnapshotItem {
    slug: string
    chainName: string
    tvl: number
    change1d: number | null
    change7d: number | null
}

interface ChainSnapshotItem {
    chainName: string
    chainType: ChainType
    totalTvl: number
    protocolCount: number
    topProtocolSlug: string | null
    topProtocolTvl: number
    topProtocolShare: number
    shareOfTrackedBasket: number
}

interface AnomalySnapshot {
    capturedAt: string
    protocols: ProtocolSnapshotItem[]
    chains: ChainSnapshotItem[]
    totalTvl: number
    dominantProtocolSlug: string | null
    dominantProtocolShare: number
    dominantChainName: string | null
    dominantChainShare: number
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

function buildLocalAlertSummary(rule: AlertRuleItem, currentValue: number) {
    const metricLabel = ALERT_METRIC_LABEL[rule.metric]
    const relationLabel = currentValue === rule.threshold ? 'equal to' : currentValue < rule.threshold ? 'below' : 'above'
    return `${rule.protocolSlug} ${metricLabel} is ${currentValue.toFixed(2)}%, which is ${relationLabel} ${rule.threshold.toFixed(2)}%.`
}

function getLocalCurrentValueForRule(rule: AlertRuleItem, market?: SolanaProtocol) {
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

function formatPct(value: number | null | undefined): string {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A'
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
}

function formatUsd(value: number | null | undefined): string {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A'
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }).format(value)
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

function riskState(protocol?: SolanaProtocol): { label: string; tone: string; isRisk: boolean } {
    if (!protocol) {
        return { label: 'No Market Data', tone: 'bg-zinc-800 text-zinc-300', isRisk: false }
    }

    const d1 = protocol.change_1d ?? 0
    const d7 = protocol.change_7d ?? 0

    if (d1 <= -10 || d7 <= -20) {
        return { label: 'Critical', tone: 'bg-red-500/20 text-red-200', isRisk: true }
    }
    if (d1 <= -5 || d7 <= -12) {
        return { label: 'Watch', tone: 'bg-amber-500/20 text-amber-200', isRisk: true }
    }
    return { label: 'Stable', tone: 'bg-emerald-500/20 text-emerald-200', isRisk: false }
}

const ALERT_METRIC_LABEL: Record<AlertMetric, string> = {
    CHANGE_1D: '24h change',
    CHANGE_7D: '7d change',
}

const CHAIN_LABELS: Record<ChainType, string> = {
    [ChainType.Solana]: 'Solana',
    [ChainType.Ethereum]: 'Ethereum',
    [ChainType.Polygon]: 'Polygon',
    [ChainType.Arbitrum]: 'Arbitrum',
    [ChainType.Optimism]: 'Optimism',
    [ChainType.Cosmos]: 'Cosmos',
    [ChainType.Base]: 'Base',
}

const CHAIN_TONES: Record<ChainType, string> = {
    [ChainType.Solana]: 'bg-cyan-400/10 text-cyan-100 ring-cyan-300/20',
    [ChainType.Ethereum]: 'bg-blue-400/10 text-blue-100 ring-blue-300/20',
    [ChainType.Polygon]: 'bg-violet-400/10 text-violet-100 ring-violet-300/20',
    [ChainType.Arbitrum]: 'bg-sky-400/10 text-sky-100 ring-sky-300/20',
    [ChainType.Optimism]: 'bg-rose-400/10 text-rose-100 ring-rose-300/20',
    [ChainType.Cosmos]: 'bg-amber-400/10 text-amber-100 ring-amber-300/20',
    [ChainType.Base]: 'bg-emerald-400/10 text-emerald-100 ring-emerald-300/20',
}

const ANOMALY_STORAGE_PREFIX = 'aegis-anomaly-snapshot:'

function getAnomalyStorageKey(walletAddress?: string | null) {
    return `${ANOMALY_STORAGE_PREFIX}${walletAddress ?? 'guest'}`
}

function formatCompactUsd(value: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value)
}

function formatSignedPct(value: number) {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}%`
}

function makeAnchorId(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function isTestNetwork(environment: ChainEnvironment) {
    return environment !== ChainEnvironment.Mainnet
}

function loadAnomalySnapshot(storageKey: string): AnomalySnapshot | null {
    if (typeof window === 'undefined') return null

    try {
        const raw = window.localStorage.getItem(storageKey)
        if (!raw) return null

        const parsed = JSON.parse(raw) as AnomalySnapshot
        if (!parsed || !Array.isArray(parsed.protocols) || !Array.isArray(parsed.chains)) return null
        return parsed
    } catch {
        return null
    }
}

function saveAnomalySnapshot(storageKey: string, snapshot: AnomalySnapshot) {
    if (typeof window === 'undefined') return

    try {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot))
    } catch {
        // Best-effort cache only.
    }
}

function buildAnomalySnapshot(rows: WatchlistMarketRow[]): AnomalySnapshot | null {
    const protocols = rows
        .flatMap((row) => {
            const tvl = row.market?.tvl
            if (typeof tvl !== 'number' || !Number.isFinite(tvl) || tvl <= 0) return []

            return [{
                slug: row.slug,
                chainName: row.chainName,
                chainType: row.chainType,
                tvl,
                change1d: row.market?.change_1d ?? null,
                change7d: row.market?.change_7d ?? null,
            }]
        })
        .sort((left, right) => right.tvl - left.tvl)

    if (protocols.length === 0) return null

    const chainBuckets = Array.from(new Map(rows.map((row) => [row.chainName, row.chainType]))).map(([chainName, chainType]) => {
        const chainProtocols = protocols.filter((protocol) => protocol.chainName === chainName)
        const totalTvl = chainProtocols.reduce((sum, protocol) => sum + protocol.tvl, 0)
        const topProtocol = chainProtocols[0] ?? null
        return {
            chainName,
            chainType,
            totalTvl,
            protocolCount: chainProtocols.length,
            topProtocolSlug: topProtocol?.slug ?? null,
            topProtocolTvl: topProtocol?.tvl ?? 0,
            topProtocolShare: totalTvl > 0 && topProtocol ? topProtocol.tvl / totalTvl : 0,
            shareOfTrackedBasket: 0,
        }
    })

    const totalTvl = protocols.reduce((sum, protocol) => sum + protocol.tvl, 0)
    const dominantProtocol = protocols[0]
    const enrichedChains = chainBuckets.map((chain) => ({
        ...chain,
        shareOfTrackedBasket: totalTvl > 0 ? chain.totalTvl / totalTvl : 0,
    }))
    const dominantChain = [...enrichedChains].sort((left, right) => right.totalTvl - left.totalTvl)[0] ?? null

    return {
        capturedAt: new Date().toISOString(),
        protocols,
        chains: enrichedChains,
        totalTvl,
        dominantProtocolSlug: dominantProtocol.slug,
        dominantProtocolShare: totalTvl > 0 ? dominantProtocol.tvl / totalTvl : 0,
        dominantChainName: dominantChain?.chainName ?? null,
        dominantChainShare: dominantChain?.shareOfTrackedBasket ?? 0,
    }
}

function buildAnomalyAlerts(current: AnomalySnapshot | null, previous: AnomalySnapshot | null): AnomalyAlertItem[] {
    if (!current) return []

    const alerts: AnomalyAlertItem[] = []
    const previousProtocolMap = new Map(previous?.protocols.map((item) => [item.slug, item]) ?? [])
    const previousChainMap = new Map(previous?.chains.map((item) => [item.chainName, item]) ?? [])

    current.protocols.forEach((protocol) => {
        const prior = previousProtocolMap.get(protocol.slug)
        const tvlDeltaPct = prior && prior.tvl > 0 ? ((protocol.tvl - prior.tvl) / prior.tvl) * 100 : null
        const sharpDrop = typeof tvlDeltaPct === 'number' && tvlDeltaPct <= -18
        const sharpRise = typeof tvlDeltaPct === 'number' && tvlDeltaPct >= 22
        const liveDrop = (protocol.change1d ?? 0) <= -15 || (protocol.change7d ?? 0) <= -30
        const liveRise = (protocol.change1d ?? 0) >= 18 || (protocol.change7d ?? 0) >= 40

        if (liveDrop || sharpDrop) {
            const deltaText = typeof tvlDeltaPct === 'number' ? ` vs. the last refresh (${formatSignedPct(tvlDeltaPct)})` : ''
            alerts.push({
                id: `tvl-drop:${protocol.slug}`,
                type: 'tvl_move',
                severity: 'critical',
                title: `${protocol.slug} is under pressure`,
                detail: `TVL is ${formatCompactUsd(protocol.tvl)} and the trend is soft${deltaText}. 24h ${protocol.change1d == null ? 'N/A' : formatSignedPct(protocol.change1d)}; 7d ${protocol.change7d == null ? 'N/A' : formatSignedPct(protocol.change7d)}.`,
                actionLabel: 'Open research',
                actionKind: 'research',
                protocolSlug: protocol.slug,
            })
        } else if (liveRise || sharpRise) {
            const deltaText = typeof tvlDeltaPct === 'number' ? ` vs. the last refresh (${formatSignedPct(tvlDeltaPct)})` : ''
            alerts.push({
                id: `tvl-rise:${protocol.slug}`,
                type: 'tvl_move',
                severity: 'high',
                title: `${protocol.slug} is accelerating`,
                detail: `TVL is ${formatCompactUsd(protocol.tvl)} and momentum is expanding${deltaText}. 24h ${protocol.change1d == null ? 'N/A' : formatSignedPct(protocol.change1d)}; 7d ${protocol.change7d == null ? 'N/A' : formatSignedPct(protocol.change7d)}.`,
                actionLabel: 'Inspect thesis',
                actionKind: 'research',
                protocolSlug: protocol.slug,
            })
        }

        const compressionScore = Math.abs(protocol.change1d ?? 0) + Math.abs(protocol.change7d ?? 0)
        if ((protocol.change1d ?? 0) <= -8 && (protocol.change7d ?? 0) <= -18) {
            alerts.push({
                id: `liquidity:${protocol.slug}`,
                type: 'liquidity_compression',
                severity: compressionScore > 60 ? 'critical' : 'high',
                title: `${protocol.slug} liquidity is compressing`,
                detail: `Both 24h and 7d trend lines are moving lower, which usually shows up before exit quality worsens. TVL is ${formatCompactUsd(protocol.tvl)} and the 24h / 7d trend is ${formatSignedPct(protocol.change1d ?? 0)} / ${formatSignedPct(protocol.change7d ?? 0)}.`,
                actionLabel: 'Open war room',
                actionKind: 'war-room',
                protocolSlug: protocol.slug,
            })
        }
    })

    current.chains.forEach((chain) => {
        const prior = previousChainMap.get(chain.chainName)
        const shareDeltaPct = prior ? (chain.shareOfTrackedBasket - prior.shareOfTrackedBasket) * 100 : null
        const concentration = chain.topProtocolShare >= 0.42 || (typeof shareDeltaPct === 'number' && shareDeltaPct >= 8)
        const chainSpike = chain.shareOfTrackedBasket >= 0.4 || (typeof shareDeltaPct === 'number' && Math.abs(shareDeltaPct) >= 10)

        if (concentration && chain.topProtocolSlug) {
            alerts.push({
                id: `concentration:${chain.chainName}`,
                type: 'concentration_shift',
                severity: chain.topProtocolShare >= 0.52 ? 'critical' : 'high',
                title: `${chain.chainName} concentration is rising`,
                detail: `${chain.topProtocolSlug} now represents ${formatSignedPct(chain.topProtocolShare * 100)} of ${chain.chainName}'s tracked basket${typeof shareDeltaPct === 'number' ? ` (${formatSignedPct(shareDeltaPct)})` : ''}.`,
                actionLabel: 'Refresh feed',
                actionKind: 'refresh',
                chainName: chain.chainName,
                protocolSlug: chain.topProtocolSlug,
            })
        }

        if (chainSpike) {
            alerts.push({
                id: `chain:${chain.chainName}`,
                type: 'chain_spike',
                severity: chain.shareOfTrackedBasket >= 0.5 ? 'critical' : 'moderate',
                title: `${chain.chainName} is dominating flow`,
                detail: `${chain.protocolCount} protocols account for ${formatSignedPct(chain.shareOfTrackedBasket * 100)} of the tracked basket${typeof shareDeltaPct === 'number' ? ` (${formatSignedPct(shareDeltaPct)})` : ''}.`,
                actionLabel: 'Open top protocol',
                actionKind: 'research',
                chainName: chain.chainName,
                protocolSlug: chain.topProtocolSlug,
            })
        }
    })

    return alerts
        .sort((left, right) => {
            const severityRank: Record<AnomalySeverity, number> = { critical: 0, high: 1, moderate: 2 }
            return severityRank[left.severity] - severityRank[right.severity]
        })
        .slice(0, 5)
}

export default function WatchlistPage() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const { activeChain, activeChainConnections, allChains } = useMultiChain()
    const wallet = useWallet()
    const walletAddress = wallet.publicKey?.toBase58()
    const { data: watchlistsByChainData, isLoading: watchlistsLoading } = useMultiChainWatchlistByChain(walletAddress)
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

    const priceLoading = priceQueries.some((query) => query.isLoading) || detailQueries.some((query) => query.isLoading)
    const marketLoading = protocolQueries.some((query) => query.isLoading) || priceLoading

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

    const availableAlertProtocolSlugs = useMemo(
        () => Array.from(new Set(watchlistMarketRows.map((row) => row.slug))),
        [watchlistMarketRows]
    )

    const selectedAlertMarketRow = useMemo(
        () => watchlistMarketRows.find((row) => normalizeProtocolSlug(row.slug) === normalizeProtocolSlug(alertProtocolSlug)),
        [alertProtocolSlug, watchlistMarketRows]
    )

    const selectedAlertCurrentValue = useMemo(() => {
        if (!selectedAlertMarketRow?.market) return null
        return alertMetric === 'CHANGE_7D'
            ? selectedAlertMarketRow.market.change_7d ?? null
            : selectedAlertMarketRow.market.change_1d ?? null
    }, [alertMetric, selectedAlertMarketRow])
    const visibleAlertRules = useMemo(
        () => (showAllAlertRules ? rules : rules.slice(0, 3)),
        [rules, showAllAlertRules]
    )
    const alertWalletAddress = walletAddress ?? guestAlertWalletAddress
    const anomalyStorageKey = useMemo(() => getAnomalyStorageKey(alertWalletAddress), [alertWalletAddress])
    const currentAnomalySnapshot = useMemo(
        () => buildAnomalySnapshot(watchlistMarketRows),
        [watchlistMarketRows]
    )
    const previousAnomalySnapshot = useMemo(
        () => loadAnomalySnapshot(anomalyStorageKey),
        [anomalyStorageKey]
    )
    const anomalyAlerts = useMemo(
        () => buildAnomalyAlerts(currentAnomalySnapshot, previousAnomalySnapshot),
        [currentAnomalySnapshot, previousAnomalySnapshot]
    )

    function handleAnomalyAction(alert: AnomalyAlertItem) {
        if (alert.actionKind === 'refresh') {
            void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['chain-protocols'] }),
                queryClient.invalidateQueries({ queryKey: ['coingecko-price'] }),
                queryClient.invalidateQueries({ queryKey: ['defillama-protocol-detail'] }),
            ])
            toast.success('Live feed refresh queued.')
            return
        }

        if (!alert.protocolSlug) return

        if (alert.actionKind === 'war-room') {
            router.push(`/war-room?protocol=${encodeURIComponent(alert.protocolSlug)}`)
            return
        }

        router.push(`/research?q=${encodeURIComponent(alert.protocolSlug)}`)
    }

    useEffect(() => {
        if (!currentAnomalySnapshot) return
        saveAnomalySnapshot(anomalyStorageKey, currentAnomalySnapshot)
    }, [anomalyStorageKey, currentAnomalySnapshot])

    useEffect(() => {
        if (typeof window === 'undefined') return

        const storageKey = 'aegis-alert-guest-id'
        const existing = window.localStorage.getItem(storageKey)
        if (existing) {
            setGuestAlertWalletAddress(existing)
            return
        }

        const generated = `guest-${crypto.randomUUID()}`
        window.localStorage.setItem(storageKey, generated)
        setGuestAlertWalletAddress(generated)
    }, [])

    useEffect(() => {
        if (!alertProtocolSlug && availableAlertProtocolSlugs.length > 0) {
            setAlertProtocolSlug(availableAlertProtocolSlugs[0])
        }
    }, [alertProtocolSlug, availableAlertProtocolSlugs])

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
        const market = watchlistMarketRows.find((row) => normalizeProtocolSlug(row.slug) === normalizeProtocolSlug(rule.protocolSlug))?.market
        const liveValue = getLocalCurrentValueForRule(rule, market)
        setSelectedTestRule(rule)
        setTestRuleValue((liveValue ?? rule.threshold).toFixed(2))
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

        const market = watchlistMarketRows.find((row) => normalizeProtocolSlug(row.slug) === normalizeProtocolSlug(rule.protocolSlug))?.market
        const liveValue = getLocalCurrentValueForRule(rule, market)
        const triggered = isLocalAlertTriggered(rule, currentValue)
        const summary = buildLocalAlertSummary(rule, currentValue)
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
            summary: `Tested against ${currentValue.toFixed(2)}%. ${liveValue == null ? 'No live market value was available.' : `Live value was ${liveValue.toFixed(2)}%.`} ${summary}`,
        }

        setTestResults((prev) => [testResult, ...prev.filter((existing) => existing.ruleId !== rule.id)])

        toast.success(triggered ? `Preview: ${rule.protocolSlug} would trigger at ${currentValue.toFixed(2)}%.` : `Preview: ${rule.protocolSlug} would not trigger at ${currentValue.toFixed(2)}%.`)
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
                        const market = selectedAlertMarketRow?.slug && normalizeProtocolSlug(selectedAlertMarketRow.slug) === normalizeProtocolSlug(rule.protocolSlug)
                            ? selectedAlertMarketRow.market
                            : watchlistMarketRows.find((row) => normalizeProtocolSlug(row.slug) === normalizeProtocolSlug(rule.protocolSlug))?.market

                        const currentValue = getLocalCurrentValueForRule(rule, market)
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
                toast.success(`Alert check complete: ${triggeredEvents.length} triggered, ${skippedEvents} skipped.`)
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
            toast.success(`Alert check complete: ${triggeredCount} triggered, ${skippedCount} skipped.`)
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

        // Wallet profile email handling removed.

        return () => {
            cancelled = true
        }
    }, [walletAddress, alertWalletAddress])

    const chainViews = useMemo(() => {
        const chainsWithWatchlists = allChains.filter((chain) => (watchlistsByChain[chain.name]?.length ?? 0) > 0)

        const visibleChains = chainsWithWatchlists.length > 0
            ? chainsWithWatchlists
            : (activeChainConnections.length > 0
                ? allChains.filter((chain) => activeChainConnections.includes(chain.type))
                : [activeChain])

        return visibleChains
            .map((chain) => {
                const slugs = watchlistsByChain[chain.name] ?? []
                const marketRows = watchlistMarketRows
                    .filter((row) => slugs.includes(row.slug))
                    .map((row) => {
                        const price = priceBySlug[row.slug] ?? (row.geckoId ? priceByGeckoId[row.geckoId] : undefined)
                        return {
                            slug: row.slug,
                            market: row.market,
                            priceUsd: price?.priceUsd ?? null,
                            priceChange24h: price?.priceChange24h ?? null,
                        }
                    })

                const riskyCount = marketRows.filter(({ market }) => riskState(market).isRisk).length

                return {
                    chain,
                    slugs,
                    marketRows,
                    riskyCount,
                    total: slugs.length,
                }
            })
            .filter((value): value is NonNullable<typeof value> => Boolean(value))
    }, [activeChain, activeChainConnections, allChains, priceByGeckoId, priceBySlug, watchlistMarketRows, watchlistsByChain])

    const totalProtocols = chainViews.reduce((acc, item) => acc + item.total, 0)
    const riskyProtocols = chainViews.reduce((acc, item) => acc + item.riskyCount, 0)

    const comparisonChains = useMemo(
        () => chainViews.filter((item) => item.slugs.length > 0).slice(0, 4),
        [chainViews]
    )

    const compactWatchlistLayout = chainViews.length <= 1
    const hasTestNetworkData = chainViews.some(({ chain }) => isTestNetwork(chain.environment))

    return (
        <div className="min-h-screen text-zinc-100 selection:bg-cyan-400/20 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.2),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[10%] -left-[8%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />
                <div className="absolute top-[18%] -right-[8%] h-[32%] w-[32%] rounded-full bg-blue-500/10 blur-[100px]" />
            </div>

            <div className="relative mx-auto max-w-6xl space-y-10 px-4 py-10 md:space-y-12 md:px-6 md:py-14">
                <header className="space-y-5">
                    <Link
                        href="/research"
                        className="group inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:text-cyan-200"
                    >
                        <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                        Back to Research
                    </Link>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-200">
                                <Layers3 className="h-3.5 w-3.5" />
                                Multichain Watchlist
                            </div>
                            <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">
                                Track protocols across <span className="text-cyan-200">multiple chains</span>
                            </h1>
                            <p className="max-w-3xl text-zinc-300">
                                Keep one watchlist per chain, compare protocol momentum side-by-side, and jump into research or war-room simulations from the same surface.
                            </p>
                        </div>

                        <div className="grid w-full grid-cols-3 gap-2 rounded-2xl bg-zinc-900/45 p-3 backdrop-blur-xl sm:gap-3 sm:p-4">
                            <StatPill label="Chains" value={String(chainViews.length || 1)} />
                            <StatPill label="Protocols" value={String(totalProtocols)} />
                            <StatPill label="Flags" value={String(riskyProtocols)} tone={riskyProtocols > 0 ? 'text-rose-200' : 'text-emerald-200'} />
                        </div>
                    </div>
                    {hasTestNetworkData && (
                        <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                            You are viewing a test network. USD numbers here are learning estimates based on market feeds, not real money in your wallet.
                        </div>
                    )}
                </header>
                <section id="live-basket" className="scroll-mt-24 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <Card className="border-cyan-300/10 bg-zinc-950/55 shadow-2xl shadow-cyan-950/15 backdrop-blur-xl">
                        <CardHeader className="space-y-3 pb-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-lg font-black text-white">Live anomaly feed</CardTitle>
                                    <CardDescription className="text-zinc-400">
                                        Real-time alerts from the protocol feed. The cards update automatically as market data refreshes.
                                    </CardDescription>
                                </div>
                                <Badge variant="accent" className="gap-2">
                                    <Activity className="h-3.5 w-3.5" />
                                    {marketLoading ? 'Updating' : `${anomalyAlerts.length} signals`}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {anomalyAlerts.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-zinc-400">
                                    No active anomalies right now. That usually means the tracked basket is stable or the latest refresh has not diverged enough to trigger a signal.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {anomalyAlerts.map((alert) => (
                                        <div key={alert.id} className="rounded-2xl border border-white/10 bg-zinc-900/65 p-4">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                alert.severity === 'critical'
                                                                    ? 'border-rose-400/20 bg-rose-400/10 text-rose-100'
                                                                    : alert.severity === 'high'
                                                                        ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
                                                                        : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
                                                            }
                                                        >
                                                            {alert.severity}
                                                        </Badge>
                                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                                                            {alert.type.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-base font-black text-white">{alert.title}</h3>
                                                    <p className="max-w-3xl text-sm leading-6 text-zinc-300">{alert.detail}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAnomalyAction(alert)}
                                                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-cyan-200"
                                                >
                                                    {alert.actionLabel}
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-zinc-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
                        <CardHeader className="space-y-3 pb-3">
                            <CardTitle className="text-lg font-black text-white">Signal coverage</CardTitle>
                            <CardDescription className="text-zinc-400">A compact view of what the detector sees across the current basket.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Tracked TVL</p>
                                    <p className="mt-2 text-2xl font-black text-white">{currentAnomalySnapshot ? formatCompactUsd(currentAnomalySnapshot.totalTvl) : 'N/A'}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Dominant share</p>
                                    <p className="mt-2 text-2xl font-black text-white">{currentAnomalySnapshot ? formatSignedPct(currentAnomalySnapshot.dominantProtocolShare * 100) : 'N/A'}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Chains monitored</p>
                                    <p className="mt-2 text-2xl font-black text-white">{currentAnomalySnapshot?.chains.length ?? 0}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Snapshot age</p>
                                    <p className="mt-2 text-2xl font-black text-white">{currentAnomalySnapshot ? 'Live' : 'Waiting'}</p>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/5 p-4 text-sm text-cyan-100/90">
                                Alerts are generated from the live protocol feed and compared with the previous refresh, so the feed stays free and responsive.
                            </div>
                        </CardContent>
                    </Card>
                </section>
                <section className={`grid gap-4 ${compactWatchlistLayout ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
                    {chainViews.map(({ chain, slugs, marketRows, riskyCount }) => (
                        <article id={`chain-${makeAnchorId(chain.name)}`} key={chain.name} className="scroll-mt-24 rounded-3xl bg-zinc-900/45 p-5 backdrop-blur-xl ring-1 ring-white/5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ring-1 ${CHAIN_TONES[chain.type]}`}>{CHAIN_LABELS[chain.type]}</div>
                                    <h2 className="mt-3 text-2xl font-black text-white">{chain.displayName}</h2>
                                    <p className="mt-1 text-sm text-zinc-400">{slugs.length} tracked protocol{slugs.length === 1 ? '' : 's'}</p>
                                    {isTestNetwork(chain.environment) && (
                                        <p className="mt-2 text-xs text-amber-200/90">Test network: USD values are estimates for practice only.</p>
                                    )}
                                </div>
                                <div className="rounded-xl bg-zinc-950/70 px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                                    {riskyCount} flagged
                                </div>
                            </div>

                            <div className="mt-4 space-y-3">
                                {slugs.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-zinc-700/70 bg-zinc-950/40 px-4 py-6 text-sm text-zinc-400">
                                        Nothing tracked yet on {chain.displayName}. Add a protocol from Research to start comparing chains.
                                    </div>
                                ) : (
                                    marketRows.map(({ slug, market, priceUsd, priceChange24h }) => {
                                        const status = riskState(market)
                                        return (
                                            <div key={`${chain.name}:${slug}`} className="rounded-2xl bg-zinc-950/60 p-4 ring-1 ring-white/5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="break-words text-sm font-semibold capitalize leading-tight text-zinc-100">{slug}</p>
                                                        <p className="mt-1 text-xs text-zinc-500">{market?.category ?? 'Chain-agnostic signal'}</p>
                                                    </div>
                                                    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${status.tone}`}>{status.label}</span>
                                                </div>

                                                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                                                    <MiniMetric label={isTestNetwork(chain.environment) ? 'Est. Price*' : 'Price'} value={formatUsd(priceUsd)} tone={(priceChange24h ?? 0) < 0 ? 'text-rose-200' : 'text-emerald-200'} />
                                                    <MiniMetric label="TVL" value={market?.tvl ? `$${Math.round(market.tvl / 1_000_000)}M` : 'N/A'} />
                                                    <MiniMetric label="24h" value={formatPct(market?.change_1d)} tone={(market?.change_1d ?? 0) < 0 ? 'text-rose-200' : 'text-emerald-200'} />
                                                    <MiniMetric label="7d" value={formatPct(market?.change_7d)} tone={(market?.change_7d ?? 0) < 0 ? 'text-rose-200' : 'text-emerald-200'} />
                                                </div>

                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <Link href={`/research?q=${slug}`} className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-200 transition-all hover:bg-zinc-700">
                                                        Research <ExternalLink className="h-3 w-3" />
                                                    </Link>
                                                    <Link href={`/war-room?protocol=${slug}`} className="inline-flex items-center gap-1 rounded-lg bg-cyan-300/20 px-3 py-2 text-xs font-bold text-cyan-100 transition-all hover:bg-cyan-300/30">
                                                        War room <ShieldAlert className="h-3 w-3" />
                                                    </Link>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </article>
                    ))}
                </section>

                <section className={`grid gap-6 ${compactWatchlistLayout ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
                    <div className="rounded-3xl bg-zinc-900/45 p-5 backdrop-blur-xl ring-1 ring-white/5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Cross-chain flow</p>
                                <h2 className="text-xl font-black text-white">Comparative lens</h2>
                            </div>
                            <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                                {marketLoading ? 'Updating market feeds' : 'Live market data'}
                            </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {comparisonChains.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-zinc-700/70 bg-zinc-950/40 px-4 py-5 text-sm text-zinc-400 md:col-span-2">
                                    Add at least one protocol to a watchlist to see the comparison cards here.
                                </div>
                            ) : (
                                comparisonChains.map(({ chain, slugs: chainSlugs }) => {
                                    const momentum = slugsMomentumScore(chain.type, chainSlugs, protocolsByChainType[chain.type] ?? [])
                                    const label = momentum > 75 ? 'Hot' : momentum > 55 ? 'Balanced' : 'Quiet'

                                    return (
                                        <div key={chain.name} className="rounded-2xl bg-zinc-950/60 p-4 ring-1 ring-white/5">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-white">{chain.displayName}</p>
                                                    <p className="text-xs text-zinc-500">{chainSlugs.length} tracked protocol{chainSlugs.length === 1 ? '' : 's'}</p>
                                                </div>
                                                <span className="rounded-full bg-zinc-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-300">{label}</span>
                                            </div>
                                            <div className="mt-3 h-2 rounded-full bg-zinc-800">
                                                <div className="h-2 rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400" style={{ width: `${Math.min(100, momentum)}%` }} />
                                            </div>
                                            <p className="mt-2 text-xs text-zinc-400">
                                                Suggested posture: {momentum > 75 ? 'trim exposure' : momentum > 55 ? 'monitor and compare' : 'accumulate selectively'}
                                            </p>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    <div className="rounded-3xl bg-zinc-900/45 p-5 backdrop-blur-xl ring-1 ring-white/5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Research memory</p>
                                <h2 className="text-xl font-black text-white">Recent briefs & alerts</h2>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-zinc-950/70 px-3 py-1 text-xs font-semibold text-zinc-300">
                                <Activity className="h-4 w-4 text-cyan-200" />
                                {alertsLoading || historyLoading ? 'Syncing' : alertStorageMode === 'local' ? 'Local test mode' : 'Synced'}
                            </div>
                        </div>

                        <div className="mt-4 space-y-4">
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

                                {/* Alert email UI removed */}

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
                                            Live {ALERT_METRIC_LABEL[alertMetric]}: {selectedAlertCurrentValue == null ? 'not available' : `${selectedAlertCurrentValue.toFixed(2)}%`}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Metric</label>
                                        <select
                                            value={alertMetric}
                                            onChange={(event) => setAlertMetric(event.target.value as AlertMetric)}
                                            className="h-11 w-full rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                                            disabled={!alertWalletAddress || creatingAlert}
                                        >
                                            <option value="CHANGE_1D">24h change</option>
                                            <option value="CHANGE_7D">7d change</option>
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
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Threshold %</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={alertThreshold}
                                            onChange={(event) => setAlertThreshold(event.target.value)}
                                            placeholder="10"
                                            className="h-11 w-full rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
                                            disabled={!alertWalletAddress || creatingAlert}
                                        />
                                        <p className="mt-1 text-[11px] text-zinc-500">Use the live value above if you want this rule to fire on the next check.</p>
                                    </div>

                                    <div className="flex items-end">
                                        <button
                                            type="submit"
                                            disabled={!alertWalletAddress || creatingAlert}
                                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <Plus className="h-4 w-4" />
                                            {creatingAlert ? 'Creating…' : 'Save alert'}
                                        </button>
                                    </div>
                                </form>
                            </div>

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
                                                            {ALERT_METRIC_LABEL[rule.metric]} {rule.direction === 'BELOW' ? '≤' : '≥'} {rule.threshold.toFixed(2)}%
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
                                                        className="rounded-lg bg-cyan-300/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Test this rule
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAlertRule(rule)}
                                                        disabled={updatingRuleId === rule.id || deletingRuleId === rule.id}
                                                        className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {updatingRuleId === rule.id ? 'Updating…' : rule.enabled ? 'Disable' : 'Enable'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteAlertRule(rule)}
                                                        disabled={updatingRuleId === rule.id || deletingRuleId === rule.id}
                                                        className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                                        >
                                            {showAllAlertRules ? 'Show fewer' : `Show all ${rules.length}`}
                                        </button>
                                    </div>
                                )}
                            </div>

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
                                            const condition = `${ALERT_METRIC_LABEL[result.metric]} ${result.direction === 'BELOW' ? '≤' : '≥'} ${result.threshold.toFixed(2)}%`
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
                                                        {result.currentValue == null ? result.reason : `${result.reason} Current value: ${result.currentValue.toFixed(2)}%.`}
                                                    </p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

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
                                                            className="text-xs opacity-90 hover:underline"
                                                            disabled={regeneratingEventId === event.id}
                                                            onClick={async () => {
                                                                try {
                                                                    setRegeneratingEventId(event.id)
                                                                    const res = await fetch(`/api/alerts/events/${event.id}/regenerate`, { method: 'POST' })
                                                                    const body = await res.json()
                                                                    if (res.status === 202) {
                                                                        toast.success('Regeneration queued — will update shortly')
                                                                        // start polling this event until summary appears
                                                                        setPollingEventId(event.id);
                                                                        (async function poll() {
                                                                            const start = Date.now()
                                                                            while (Date.now() - start < 60000) {
                                                                                await new Promise((r) => setTimeout(r, 3000))
                                                                                try {
                                                                                    const r = await fetch(`/api/alerts/events/${event.id}`)
                                                                                    if (!r.ok) continue
                                                                                    const b = await r.json()
                                                                                    const remoteEvent = b.event as AlertEventItem
                                                                                    if (remoteEvent?.summary) {
                                                                                        setEvents((prev) => prev.map((e) => (e.id === remoteEvent.id ? { ...e, summary: remoteEvent.summary, summaryGeneratedAt: remoteEvent.summaryGeneratedAt } : e)))
                                                                                        toast.success('Summary available')
                                                                                        setPollingEventId(null)
                                                                                        break
                                                                                    }
                                                                                } catch {
                                                                                    // ignore and continue polling
                                                                                }
                                                                            }
                                                                            setPollingEventId(null)
                                                                        })()
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
                                                        className="text-xs opacity-90 hover:underline"
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
                    </div>
                </section>

                {watchlistsLoading ? (
                    <div className="rounded-xl bg-zinc-900/55 px-4 py-3 text-sm text-zinc-300">
                        Loading multichain watchlists...
                    </div>
                ) : null}
            </div>
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
                                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                                    onClick={() => setFullSummaryOpen(false)}
                                >
                                    Close
                                </button>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <DetailPill label="Metric" value={ALERT_METRIC_LABEL[evt.metric]} />
                                <DetailPill label="Condition" value={condition} />
                                <DetailPill label="Current value" value={`${evt.currentValue.toFixed(2)}%`} />
                                <DetailPill label="Triggered at" value={new Date(evt.triggeredAt).toLocaleString()} />
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
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-semibold text-zinc-200 transition hover:bg-white/10"
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
                                    {ALERT_METRIC_LABEL[selectedTestRule.metric]} {selectedTestRule.direction === 'BELOW' ? '≤' : '≥'} {selectedTestRule.threshold.toFixed(2)}%
                                </p>
                            </div>
                            <label className="grid gap-2 text-sm text-zinc-300">
                                Test value
                                <input
                                    type="number"
                                    step="0.01"
                                    value={testRuleValue}
                                    onChange={(event) => setTestRuleValue(event.target.value)}
                                    className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition focus:border-cyan-400/60"
                                />
                            </label>
                            <p className="text-xs text-zinc-500">
                                Current live value for reference:{' '}
                                {(() => {
                                    const market = watchlistMarketRows.find((row) => normalizeProtocolSlug(row.slug) === normalizeProtocolSlug(selectedTestRule.protocolSlug))?.market
                                    const liveValue = getLocalCurrentValueForRule(selectedTestRule, market)
                                    return liveValue == null ? 'unavailable' : `${liveValue.toFixed(2)}%`
                                })()}
                            </p>
                            {testResults[0]?.ruleId === selectedTestRule.id ? (
                                <div className={`rounded-2xl px-4 py-3 text-sm ${testResults[0].triggered ? 'bg-emerald-500/10 text-emerald-100' : 'bg-amber-500/10 text-amber-100'}`}>
                                    <p className="font-semibold">Latest manual result</p>
                                    <p className="mt-1">{testResults[0].summary}</p>
                                </div>
                            ) : null}
                        </div>
                    )}
                    <DialogFooter className="sm:justify-between">
                        <button
                            type="button"
                            onClick={() => setTestRuleOpen(false)}
                            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                if (!selectedTestRule) return
                                await runSpecificAlertTest(selectedTestRule, testRuleValue)
                            }}
                            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-cyan-950 transition hover:bg-cyan-300"
                        >
                            Evaluate test
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function StatPill({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="rounded-xl bg-zinc-950/70 px-3 py-2.5 text-center shadow-inner shadow-black/20 sm:px-4 sm:py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:text-[10px]">{label}</p>
            <p className={`mt-1 text-xl font-black leading-none sm:text-2xl ${tone ?? 'text-white'}`}>{value}</p>
        </div>
    )
}

function DetailPill({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{label}</p>
            <p className="mt-2 text-sm font-semibold text-zinc-100">{value}</p>
        </div>
    )
}

// `MiniMetric` moved to a shared component at `src/components/ui/mini-metric.tsx`

function slugsMomentumScore(
    chainType: ChainType,
    slugs: string[],
    protocols: SolanaProtocol[]
): number {
    if (chainType !== ChainType.Solana) {
        return 58 + slugs.length * 5
    }

    const marketSignals = slugs
        .map((slug) => resolveProtocolFromList(normalizeProtocolSlug(slug), protocols))
        .filter((market): market is SolanaProtocol => Boolean(market))

    if (marketSignals.length === 0) return 55 + slugs.length * 4

    const averageChange = marketSignals.reduce((acc, market) => acc + (market.change_1d ?? 0) + (market.change_7d ?? 0) / 2, 0) / marketSignals.length
    const score = 62 + averageChange * 1.4 + slugs.length * 3
    return Math.max(20, Math.min(95, score))
}