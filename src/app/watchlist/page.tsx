'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Activity, ExternalLink, Layers3, ShieldAlert, Trash2 } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import { useMultiChain } from '@/components/chain/chain-provider'
import { useMultiChainWatchlistByChain, removeFromWatchlist } from '@/hooks/use-multichain-watchlist'
import { fetchJson } from '@/lib/api/fetch-json'
import { normalizeProtocolSlug, resolveProtocolFromList } from '@/shared/protocol/slug-resolver'
import MiniMetric from '@/components/ui/mini-metric'
import { ChainEnvironment, ChainType } from '@/lib/chain/types'
import type { SolanaProtocol } from '@/shared/types'
import { toast } from 'sonner'



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

    const anomalyStorageKey = useMemo(() => getAnomalyStorageKey(walletAddress), [walletAddress])
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

    const handleRemove = (chainType: ChainType, environment: string, slug: string) => {
        const success = removeFromWatchlist(chainType, environment, slug, walletAddress)
        if (success) {
            toast.success(`Removed ${slug} from watchlist`)
            queryClient.invalidateQueries({ queryKey: ['multichain-watchlist-by-chain'] })
            queryClient.invalidateQueries({ queryKey: ['watchlist'] })
        }
    }

    const chainViews = useMemo(() => {
        const environmentFilteredChains = allChains.filter((chain) => chain.environment === activeChain.environment)
        const chainsWithWatchlists = environmentFilteredChains.filter((chain) => (watchlistsByChain[chain.name]?.length ?? 0) > 0)

        const visibleChains = chainsWithWatchlists.length > 0
            ? chainsWithWatchlists
            : (activeChainConnections.length > 0
                ? environmentFilteredChains.filter((chain) => activeChainConnections.includes(chain.type))
                : [activeChain])

        return visibleChains
            .map((chain) => {
                const slugs = watchlistsByChain[chain.name] ?? []
                const marketRows = watchlistMarketRows
                    .filter((row) => row.chainName === chain.name && slugs.includes(row.slug))
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
        <div className="mx-auto max-w-6xl space-y-8 py-6">
            <header className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Link href="/research">
                            <Button variant="outline" size="sm" className="flex items-center gap-1.5 font-bold">
                                <ArrowLeft className="h-3.5 w-3.5" /> Back to Research
                            </Button>
                        </Link>
                        <Badge variant="accent" className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-semibold">
                            <Layers3 className="h-3.5 w-3.5 inline mr-1.5" /> Multichain Watchlist
                        </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded-2xl bg-zinc-900/45 p-3 backdrop-blur-xl sm:gap-3 sm:p-4 shrink-0">
                        <StatPill label="Chains" value={String(chainViews.length || 1)} />
                        <StatPill label="Protocols" value={String(totalProtocols)} />
                        <StatPill label="Flags" value={String(riskyProtocols)} tone={riskyProtocols > 0 ? 'text-rose-200' : 'text-emerald-200'} />
                    </div>
                </div>
                <div className="space-y-2">
                    <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
                        Track protocols across <span className="text-cyan-200">multiple chains</span>
                    </h1>
                    <p className="max-w-3xl text-zinc-400 text-sm leading-relaxed">
                        Keep one watchlist per chain, compare protocol momentum side-by-side, and jump into research or war-room simulations from the same surface.
                    </p>
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
                                                <Button
                                                    type="button"
                                                    onClick={() => handleAnomalyAction(alert)}
                                                    className="shrink-0 bg-cyan-300 hover:bg-cyan-200 text-zinc-950 font-bold"
                                                >
                                                    {alert.actionLabel}
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </Button>
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
                                                    <Button asChild variant="outline" size="sm" className="bg-zinc-800 text-zinc-200 border-white/5 hover:bg-zinc-700">
                                                        <Link href={`/research?q=${slug}`}>
                                                            Research <ExternalLink className="h-3 w-3 ml-1" />
                                                        </Link>
                                                    </Button>
                                                    <Button asChild variant="outline" size="sm" className="bg-cyan-300/10 hover:bg-cyan-300/20 text-cyan-300 border-cyan-300/20">
                                                        <Link href={`/war-room?protocol=${slug}`}>
                                                            War room <ShieldAlert className="h-3 w-3 ml-1" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleRemove(chain.type, chain.environment, slug)}
                                                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 border-rose-500/20 cursor-pointer"
                                                    >
                                                        Remove <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </article>
                    ))}
                </section>

                <section className="grid gap-6">
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
                                                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${Math.min(100, momentum || 0)}%` }} />
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
                </section>

                {watchlistsLoading ? (
                    <div className="rounded-xl bg-zinc-900/55 px-4 py-3 text-sm text-zinc-300">
                        Loading multichain watchlists...
                    </div>
                ) : null}
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

function slugsMomentumScore(
    chainType: ChainType,
    slugs: string[],
    protocols: SolanaProtocol[]
): number {
    if (chainType !== ChainType.Solana) {
        const score = 58 + slugs.length * 5
        return Number.isFinite(score) ? score : 58
    }

    const marketSignals = slugs
        .map((slug) => resolveProtocolFromList(normalizeProtocolSlug(slug), protocols))
        .filter((market): market is SolanaProtocol => Boolean(market))

    if (marketSignals.length === 0) return 55 + slugs.length * 4

    let totalChange = 0
    let count = 0
    marketSignals.forEach((market) => {
        const change1d = typeof market.change_1d === 'number' && Number.isFinite(market.change_1d) ? market.change_1d : 0
        const change7d = typeof market.change_7d === 'number' && Number.isFinite(market.change_7d) ? market.change_7d : 0
        totalChange += change1d + change7d / 2
        count++
    })

    const averageChange = count > 0 ? totalChange / count : 0
    const score = 62 + averageChange * 1.4 + slugs.length * 3
    const finalScore = Number.isFinite(score) ? score : 55 + slugs.length * 4
    return Math.max(20, Math.min(95, finalScore))
}