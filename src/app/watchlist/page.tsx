'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Activity, ExternalLink, Layers3, ShieldAlert, Trash2 } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { TerminalExecutionModal, ExecutionAction } from '@/components/ui/terminal-execution-modal'

import { useMultiChain } from '@/components/chain/chain-provider'
import { useMultiChainWatchlistByChain, removeFromWatchlist } from '@/lib/hooks/use-multichain-watchlist'
import { fetchJson } from '@/lib/api/fetch-json'
import { resolveProtocolFromList } from '@/lib/protocol/slug-resolver'
import MiniMetric from '@/components/ui/mini-metric'
import { ChainEnvironment, ChainType } from '@/lib/chain/types'
import type { SolanaProtocol } from '@/lib/types'
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
    return { label: 'No Market Data', tone: 'border-zinc-800 bg-zinc-950 text-zinc-550', isRisk: false }
  }

  const d1 = protocol.change_1d ?? 0
  const d7 = protocol.change_7d ?? 0

  if (d1 <= -10 || d7 <= -20) {
    return {
      label: 'Critical',
      tone: 'border-rose-500/20 bg-rose-500/5 text-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.1)] animate-pulse',
      isRisk: true,
    }
  }
  if (d1 <= -5 || d7 <= -12) {
    return { label: 'Watch', tone: 'border-amber-500/20 bg-amber-500/5 text-amber-400', isRisk: true }
  }
  return { label: 'Stable', tone: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400', isRisk: false }
}

const CHAIN_LABELS: Record<ChainType, string> = {
  [ChainType.Solana]: 'Solana Network',
  [ChainType.Ethereum]: 'Ethereum Mainnet',
  [ChainType.Polygon]: 'Polygon Suite',
  [ChainType.Arbitrum]: 'Arbitrum Rollup',
  [ChainType.Optimism]: 'Optimism Rollup',
  [ChainType.Cosmos]: 'Cosmos Hub',
  [ChainType.Base]: 'Base Rollup',
}

const CHAIN_TONES: Record<ChainType, string> = {
  [ChainType.Solana]: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.05)]',
  [ChainType.Ethereum]: 'border-zinc-800 bg-zinc-950/40 text-zinc-400',
  [ChainType.Polygon]: 'border-zinc-800 bg-zinc-950/40 text-zinc-400',
  [ChainType.Arbitrum]: 'border-zinc-800 bg-zinc-950/40 text-zinc-400',
  [ChainType.Optimism]: 'border-zinc-800 bg-zinc-950/40 text-zinc-400',
  [ChainType.Cosmos]: 'border-zinc-800 bg-zinc-950/40 text-zinc-400',
  [ChainType.Base]: 'border-zinc-800 bg-zinc-950/40 text-zinc-400',
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
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isTestNetwork(environment: ChainEnvironment) {
  return environment !== ChainEnvironment.Mainnet
}

function WatchlistAnalyticsPanel({ rows }: { rows: WatchlistMarketRow[] }) {
  const chainMetrics = useMemo(() => {
    const tvlByChain: Record<string, number> = {}
    let totalTvl = 0

    rows.forEach((row) => {
      const tvl = row.market?.tvl ?? 0
      tvlByChain[row.chainName] = (tvlByChain[row.chainName] ?? 0) + tvl
      totalTvl += tvl
    })

    const sorted = Object.entries(tvlByChain)
      .map(([name, tvl]) => ({
        name,
        tvl,
        percentage: totalTvl > 0 ? (tvl / totalTvl) * 100 : 0,
      }))
      .sort((a, b) => b.tvl - a.tvl)

    return { list: sorted, totalTvl }
  }, [rows])

  const riskBreakdown = useMemo(() => {
    let stable = 0
    let watch = 0
    let critical = 0

    rows.forEach((row) => {
      const d1 = row.market?.change_1d ?? 0
      const d7 = row.market?.change_7d ?? 0

      if (d1 <= -10 || d7 <= -20) {
        critical++
      } else if (d1 <= -5 || d7 <= -12) {
        watch++
      } else {
        stable++
      }
    })

    const total = rows.length || 1
    return {
      stable,
      watch,
      critical,
      stablePct: (stable / total) * 100,
      watchPct: (watch / total) * 100,
      criticalPct: (critical / total) * 100,
    }
  }, [rows])

  const getChainColorClass = (chainName: string) => {
    const name = chainName.toLowerCase()
    if (name.includes('solana')) return 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
    if (name.includes('ethereum')) return 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
    if (name.includes('base')) return 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.4)]'
    if (name.includes('arbitrum')) return 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]'
    if (name.includes('optimism')) return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
    if (name.includes('polygon')) return 'bg-fuchsia-600 shadow-[0_0_8px_rgba(192,38,211,0.4)]'
    if (name.includes('cosmos')) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
    return 'bg-zinc-500'
  }

  if (rows.length === 0) {
    return null
  }

  return (
    <SpotlightCard
      spotlightColor="rgba(6, 182, 212, 0.03)"
      borderColor="rgba(6, 182, 212, 0.15)"
      className="border-cyan-500/10 bg-zinc-950/40 shadow-2xl backdrop-blur-xl !p-5 corner-decor"
    >
      <div className="space-y-3 pb-3 border-b border-zinc-900 mb-4 text-left">
        <h3 className="text-sm font-orbitron font-black text-white uppercase tracking-wider">
          Watchlist Asset Analytics
        </h3>
        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
          &gt; System statistics monitoring active basket footprints.
        </p>
      </div>

      <div className="space-y-5 font-mono text-xs">
        {/* Stacked Chart */}
        <div className="space-y-2 text-left">
          <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-550">TVL ALLOCATION BY NETWORK</p>
          {chainMetrics.totalTvl === 0 ? (
            <div className="text-[10px] text-zinc-650 py-1">&gt; Metric inputs currently zero or unavailable.</div>
          ) : (
            <>
              <div className="h-3 w-full bg-zinc-900 rounded-xs overflow-hidden flex border border-zinc-800">
                {chainMetrics.list.map((c) => (
                  <div
                    key={c.name}
                    className={getChainColorClass(c.name)}
                    style={{ width: `${c.percentage}%` }}
                    title={`${c.name}: ${formatCompactUsd(c.tvl)} (${c.percentage.toFixed(1)}%)`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[9px]">
                {chainMetrics.list.map((c) => (
                  <div key={c.name} className="flex items-center gap-1.5 text-zinc-455">
                    <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${getChainColorClass(c.name)}`} />
                    <span className="truncate uppercase font-bold text-zinc-300">{c.name.split(' ')[0]}:</span>
                    <span className="text-zinc-550 font-bold">{c.percentage.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Risk Distribution */}
        <div className="space-y-2 text-left">
          <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-550">BASKET RISK THREAT FACTOR</p>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] text-emerald-400 font-bold">
                <span>STABLE VECTOR FOOTPRINT</span>
                <span>
                  {riskBreakdown.stable} / {rows.length} ({riskBreakdown.stablePct.toFixed(0)}%)
                </span>
              </div>
              <div className="h-1.5 bg-zinc-900 rounded-xs overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-500"
                  style={{ width: `${riskBreakdown.stablePct}%` }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] text-amber-400 font-bold">
                <span>WATCH WARNING LEVEL</span>
                <span>
                  {riskBreakdown.watch} / {rows.length} ({riskBreakdown.watchPct.toFixed(0)}%)
                </span>
              </div>
              <div className="h-1.5 bg-zinc-900 rounded-xs overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-all duration-500"
                  style={{ width: `${riskBreakdown.watchPct}%` }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] text-rose-400 font-bold">
                <span>CRITICAL DEVIATION FAULT</span>
                <span>
                  {riskBreakdown.critical} / {rows.length} ({riskBreakdown.criticalPct.toFixed(0)}%)
                </span>
              </div>
              <div className="h-1.5 bg-zinc-900 rounded-xs overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] transition-all duration-500"
                  style={{ width: `${riskBreakdown.criticalPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SpotlightCard>
  )
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

      return [
        {
          slug: row.slug,
          chainName: row.chainName,
          chainType: row.chainType,
          tvl,
          change1d: row.market?.change_1d ?? null,
          change7d: row.market?.change_7d ?? null,
        },
      ]
    })
    .sort((left, right) => right.tvl - left.tvl)

  if (protocols.length === 0) return null

  const chainBuckets = Array.from(new Map(rows.map((row) => [row.chainName, row.chainType]))).map(
    ([chainName, chainType]) => {
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
    },
  )

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
      const deltaText = typeof tvlDeltaPct === 'number' ? ` vs. last refresh (${formatSignedPct(tvlDeltaPct)})` : ''
      alerts.push({
        id: `tvl-drop:${protocol.slug}`,
        type: 'tvl_move',
        severity: 'critical',
        title: `${protocol.slug.toUpperCase()} under pressure`,
        detail: `TVL is ${formatCompactUsd(protocol.tvl)} and momentum is decaying${deltaText}. 24H ${protocol.change1d == null ? 'N/A' : formatSignedPct(protocol.change1d)}; 7D ${protocol.change7d == null ? 'N/A' : formatSignedPct(protocol.change7d)}.`,
        actionLabel: 'Open Research',
        actionKind: 'research',
        protocolSlug: protocol.slug,
      })
    } else if (liveRise || sharpRise) {
      const deltaText = typeof tvlDeltaPct === 'number' ? ` vs. last refresh (${formatSignedPct(tvlDeltaPct)})` : ''
      alerts.push({
        id: `tvl-rise:${protocol.slug}`,
        type: 'tvl_move',
        severity: 'high',
        title: `${protocol.slug.toUpperCase()} accelerating velocity`,
        detail: `TVL is ${formatCompactUsd(protocol.tvl)} and expansion registers high${deltaText}. 24H ${protocol.change1d == null ? 'N/A' : formatSignedPct(protocol.change1d)}; 7D ${protocol.change7d == null ? 'N/A' : formatSignedPct(protocol.change7d)}.`,
        actionLabel: 'Inspect Thesis',
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
        title: `${protocol.slug.toUpperCase()} liquidity compressing`,
        detail: `Both 24H and 7D trend lines move lower, signaling possible slip parameters increase. TVL at ${formatCompactUsd(protocol.tvl)} and delta is ${formatSignedPct(protocol.change1d ?? 0)} / ${formatSignedPct(protocol.change7d ?? 0)}.`,
        actionLabel: 'Open War Room',
        actionKind: 'war-room',
        protocolSlug: protocol.slug,
      })
    }
  })

  current.chains.forEach((chain) => {
    const prior = previousChainMap.get(chain.chainName)
    const shareDeltaPct = prior ? (chain.shareOfTrackedBasket - prior.shareOfTrackedBasket) * 100 : null
    const concentration = chain.topProtocolShare >= 0.42 || (typeof shareDeltaPct === 'number' && shareDeltaPct >= 8)
    const chainSpike =
      chain.shareOfTrackedBasket >= 0.4 || (typeof shareDeltaPct === 'number' && Math.abs(shareDeltaPct) >= 10)

    if (concentration && chain.topProtocolSlug) {
      alerts.push({
        id: `concentration:${chain.chainName}`,
        type: 'concentration_shift',
        severity: chain.topProtocolShare >= 0.52 ? 'critical' : 'high',
        title: `${chain.chainName} concentration expansion`,
        detail: `${chain.topProtocolSlug.toUpperCase()} represents ${formatSignedPct(chain.topProtocolShare * 100)} of ${chain.chainName}'s tracked index${typeof shareDeltaPct === 'number' ? ` (${formatSignedPct(shareDeltaPct)})` : ''}.`,
        actionLabel: 'Refresh Feed',
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
        title: `${chain.chainName} dominating basket flows`,
        detail: `${chain.protocolCount} protocols represent ${formatSignedPct(chain.shareOfTrackedBasket * 100)} of the tracked index basket${typeof shareDeltaPct === 'number' ? ` (${formatSignedPct(shareDeltaPct)})` : ''}.`,
        actionLabel: 'Inspect Protocol',
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
  const [execModalOpen, setExecModalOpen] = useState(false)
  const [execAction, setExecAction] = useState<ExecutionAction | null>(null)

  function handleExecuteAction(action: ExecutionAction) {
    setExecAction(action)
    setExecModalOpen(true)
  }
  const { activeChain, activeChainConnections, allChains } = useMultiChain()
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58()
  const { data: watchlistsByChainData } = useMultiChainWatchlistByChain(walletAddress)
  const watchlistsByChain = useMemo<Record<string, string[]>>(
    () => watchlistsByChainData ?? {},
    [watchlistsByChainData],
  )

  const protocolChainTypes = useMemo(() => Array.from(new Set(allChains.map((chain) => chain.type))), [allChains])

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
        const geckoId =
          (market as WatchlistMarketRow['market'] | undefined)?.gecko_id ??
          (market as WatchlistMarketRow['market'] | undefined)?.geckoId ??
          null

        return { slug, chainName: chain.name, chainType: chain.type, market, geckoId }
      })
    })
  }, [allChains, protocolsByChainType, watchlistsByChain])

  const geckoIds = useMemo(
    () =>
      Array.from(
        new Set(watchlistMarketRows.map((row) => row.geckoId).filter((value): value is string => Boolean(value))),
      ),
    [watchlistMarketRows],
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
    [watchlistMarketRows],
  )

  const detailQueries = useQueries({
    queries: detailTargets.map((row) => ({
      queryKey: ['defillama-protocol-detail', row],
      queryFn: async () =>
        fetchJson<DefiLlamaProtocolDetail>(`/api/defillama/protocol?slug=${encodeURIComponent(row)}`),
      staleTime: 60_000,
      refetchInterval: 60_000,
      retry: false,
    })),
  })

  const priceByGeckoId = useMemo(() => {
    return priceQueries.reduce<Record<string, { priceUsd: number | null; priceChange24h: number | null }>>(
      (acc, query, index) => {
        const geckoId = geckoIds[index]
        if (geckoId && query.data) {
          acc[geckoId] = query.data
        }
        return acc
      },
      {},
    )
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
  const currentAnomalySnapshot = useMemo(() => buildAnomalySnapshot(watchlistMarketRows), [watchlistMarketRows])
  const previousAnomalySnapshot = useMemo(() => loadAnomalySnapshot(anomalyStorageKey), [anomalyStorageKey])
  const anomalyAlerts = useMemo(
    () => buildAnomalyAlerts(currentAnomalySnapshot, previousAnomalySnapshot),
    [currentAnomalySnapshot, previousAnomalySnapshot],
  )

  function handleAnomalyAction(alert: AnomalyAlertItem) {
    if (alert.actionKind === 'refresh') {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['chain-protocols'] }),
        queryClient.invalidateQueries({ queryKey: ['coingecko-price'] }),
        queryClient.invalidateQueries({ queryKey: ['defillama-protocol-detail'] }),
      ])
      toast.success('Live telemetry refresh queued.')
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
      toast.success(`Removed ${slug} from watch monitor`)
      void queryClient.invalidateQueries({ queryKey: ['multichain-watchlist-by-chain'] })
      void queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    }
  }

  const chainViews = useMemo(() => {
    const environmentFilteredChains = allChains.filter((chain) => chain.environment === activeChain.environment)
    const chainsWithWatchlists = environmentFilteredChains.filter(
      (chain) => (watchlistsByChain[chain.name]?.length ?? 0) > 0,
    )

    const visibleChains =
      chainsWithWatchlists.length > 0
        ? chainsWithWatchlists
        : activeChainConnections.length > 0
          ? environmentFilteredChains.filter((chain) => activeChainConnections.includes(chain.type))
          : [activeChain]

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
  }, [
    activeChain,
    activeChainConnections,
    allChains,
    priceByGeckoId,
    priceBySlug,
    watchlistMarketRows,
    watchlistsByChain,
  ])

  const totalProtocols = chainViews.reduce((acc, item) => acc + item.total, 0)
  const riskyProtocols = chainViews.reduce((acc, item) => acc + item.riskyCount, 0)

  const compactWatchlistLayout = chainViews.length <= 1
  const hasTestNetworkData = chainViews.some(({ chain }) => isTestNetwork(chain.environment))

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-6 px-2 cyber-grid">
      <header className="space-y-4 text-left">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/research">
              <span className="inline-flex items-center justify-center gap-1.5 font-orbitron font-bold border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900 text-zinc-300 rounded-xs text-xs px-3.5 py-2 cursor-pointer transition-all">
                <ArrowLeft className="h-3.5 w-3.5 text-cyan-400" /> Research Center
              </span>
            </Link>
            <Badge
              variant="accent"
              className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-orbitron font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)] bg-cyan-950/20 text-cyan-400 border-cyan-500/20"
            >
              <Layers3 className="h-3.5 w-3.5 inline mr-1.5" /> Threat Watchlist
            </Badge>
          </div>

          {/* Console Metric Panel */}
          <div className="grid grid-cols-3 gap-2 rounded-xs border border-cyan-500/10 bg-zinc-950/90 p-3.5 backdrop-blur-xl shrink-0 font-mono text-xs text-left shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] min-w-[240px]">
            <div>
              <span className="text-[8px] font-bold text-zinc-550 block uppercase tracking-wider">Networks</span>
              <span className="text-sm font-bold text-white font-orbitron mt-0.5 block">{chainViews.length || 1}</span>
            </div>
            <div className="border-l border-zinc-900 pl-3">
              <span className="text-[8px] font-bold text-zinc-550 block uppercase tracking-wider">Targets</span>
              <span className="text-sm font-bold text-white font-orbitron mt-0.5 block">{totalProtocols}</span>
            </div>
            <div className="border-l border-zinc-900 pl-3">
              <span className="text-[8px] font-bold text-zinc-550 block uppercase tracking-wider">Risks</span>
              <span
                className={`text-sm font-bold font-orbitron mt-0.5 block ${riskyProtocols > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}
              >
                {riskyProtocols}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-orbitron font-black tracking-wide text-white md:text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.08)] uppercase">
            Active Threat Tracking Dashboard
          </h1>
          <p className="max-w-3xl text-zinc-400 text-xs sm:text-sm leading-relaxed">
            Compare TVL momentum side-by-side, inspect local and systemic anomalies in real-time, and route warning
            triggers directly into AI research audits.
          </p>
        </div>
        {hasTestNetworkData && (
          <div className="rounded-xs border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-xs font-mono text-amber-200/90">
            &gt; SYSTEM ADVISORY: STAGING ENVIRONMENT DEPLOYED. NUMERICAL TELEMETRY UTILIZES ESTIMATES.
          </div>
        )}
      </header>

      {/* Anomaly Alerts Section */}
      <section id="live-basket" className="scroll-mt-24 grid gap-4 xl:grid-cols-[1.1fr_0.9fr] text-left">
        <SpotlightCard
          spotlightColor="rgba(6, 182, 212, 0.03)"
          borderColor="rgba(6, 182, 212, 0.15)"
          className="border-cyan-500/10 bg-zinc-950/40 shadow-2xl backdrop-blur-xl !p-5 corner-decor"
        >
          <div className="space-y-3 pb-3 border-b border-zinc-900 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-orbitron font-black text-white uppercase tracking-wider">
                  Live Anomaly Feed
                </h3>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  &gt; System logs detecting TVL variances and liquidity compression spikes.
                </p>
              </div>
              <Badge
                variant="accent"
                className="gap-1.5 bg-cyan-950/30 text-cyan-400 border-cyan-500/20 font-orbitron font-bold text-[9px] uppercase tracking-wider"
              >
                <Activity className="h-3 w-3 animate-pulse" />
                {marketLoading ? 'CALCULATING' : `${anomalyAlerts.length} SIGNAL LOGS`}
              </Badge>
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {anomalyAlerts.length === 0 ? (
              <div className="rounded-xs border border-dashed border-zinc-800 bg-zinc-950/20 p-6 text-center text-zinc-550">
                &gt; Telemetry baseline stable. 0 active anomalies captured.
              </div>
            ) : (
              <div className="space-y-3">
                {anomalyAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-xs border border-zinc-900 bg-zinc-950/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={
                              alert.severity === 'critical'
                                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 font-mono text-[8px] uppercase tracking-wider font-bold animate-pulse'
                                : alert.severity === 'high'
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 font-mono text-[8px] uppercase tracking-wider font-bold'
                                  : 'border-zinc-850 bg-zinc-900 text-zinc-400 font-mono text-[8px] uppercase tracking-wider'
                            }
                          >
                            {alert.severity}
                          </Badge>
                          <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-550">
                            {alert.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <h3 className="text-sm font-orbitron font-bold text-white uppercase tracking-wider">
                          {alert.title}
                        </h3>
                        <p className="max-w-3xl text-xs leading-5 text-zinc-400 font-light">{alert.detail}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center shrink-0">
                        <Button
                          type="button"
                          onClick={() => handleAnomalyAction(alert)}
                          className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-855 text-zinc-350 hover:text-white font-orbitron font-bold text-xs uppercase tracking-wider rounded-xs h-9 px-4 cursor-pointer"
                        >
                          {alert.actionLabel}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                        {(alert.type === 'tvl_move' || alert.type === 'liquidity_compression') && (
                          <Button
                            type="button"
                            onClick={() =>
                              handleExecuteAction({
                                action: alert.type === 'tvl_move' ? 'hedge' : 'liquidate',
                                assetSymbol: alert.protocolSlug?.toUpperCase() || 'DEFI',
                                amount: 10000,
                              })
                            }
                            className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-bold text-xs uppercase tracking-wider rounded-xs shadow-[0_0_8px_rgba(6,182,212,0.25)] h-9 px-4 cursor-pointer"
                          >
                            Mitigate Risk
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SpotlightCard>

        {/* Signal stats panel and analytics dashboard */}
        <div className="space-y-4">
          <SpotlightCard
            spotlightColor="rgba(6, 182, 212, 0.03)"
            borderColor="rgba(6, 182, 212, 0.15)"
            className="border-cyan-500/10 bg-zinc-950/40 shadow-2xl backdrop-blur-xl !p-5 corner-decor"
          >
            <div className="space-y-3 pb-3 border-b border-zinc-900 mb-4">
              <h3 className="text-sm font-orbitron font-black text-white uppercase tracking-wider">
                Detector Coverage
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                &gt; System statistics monitoring active basket footprints.
              </p>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xs border border-zinc-900 bg-zinc-950/60 p-4">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-550">Basket TVL Sum</p>
                  <p className="mt-1.5 text-xl font-orbitron font-black text-white tracking-widest">
                    {currentAnomalySnapshot ? formatCompactUsd(currentAnomalySnapshot.totalTvl) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-xs border border-zinc-900 bg-zinc-950/60 p-4">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-550">Top Dominator Share</p>
                  <p className="mt-1.5 text-xl font-orbitron font-black text-white tracking-widest">
                    {currentAnomalySnapshot
                      ? formatSignedPct(currentAnomalySnapshot.dominantProtocolShare * 100)
                      : 'N/A'}
                  </p>
                </div>
                <div className="rounded-xs border border-zinc-900 bg-zinc-950/60 p-4">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-550">Networks Tracked</p>
                  <p className="mt-1.5 text-xl font-orbitron font-black text-white tracking-widest">
                    {currentAnomalySnapshot?.chains.length ?? 0}
                  </p>
                </div>
                <div className="rounded-xs border border-zinc-900 bg-zinc-950/60 p-4">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-550">Detector Health</p>
                  <p className="mt-1.5 text-xl font-orbitron font-black text-cyan-400 tracking-widest">STABLE</p>
                </div>
              </div>
              <div className="rounded-xs border border-cyan-500/10 bg-cyan-950/5 p-4 text-[11px] text-cyan-400/80 leading-relaxed">
                &gt; DETECTOR MODULE: Comparing telemetry values against local caches to bypass server RPC bottlenecks.
                Refresh values manually if pricing offsets diverge.
              </div>
            </div>
          </SpotlightCard>

          <WatchlistAnalyticsPanel rows={watchlistMarketRows} />
        </div>
      </section>

      {/* Monitored Chains lists */}
      <section
        className={`grid gap-4 ${compactWatchlistLayout ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3'} text-left`}
      >
        {chainViews.map(({ chain, slugs, marketRows, riskyCount }) => (
          <article
            id={`chain-${makeAnchorId(chain.name)}`}
            key={chain.name}
            className="scroll-mt-24 rounded-xl bg-zinc-950/50 p-5 border border-cyan-500/10 corner-decor backdrop-blur-md relative shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-900 pb-4">
              <div>
                <div
                  className={`inline-flex rounded-xs border px-2.5 py-0.5 text-[9px] font-orbitron font-bold uppercase tracking-wider ${CHAIN_TONES[chain.type]}`}
                >
                  {CHAIN_LABELS[chain.type]}
                </div>
                <h2 className="mt-3 text-lg font-orbitron font-bold text-white uppercase tracking-wider">
                  {chain.displayName}
                </h2>
                <p className="mt-1 text-xs text-zinc-500 font-medium font-mono">{slugs.length} Monitored Vectors</p>
                {isTestNetwork(chain.environment) && (
                  <p className="mt-2 text-[10px] font-mono text-amber-200/90 leading-normal">
                    &gt; ESTIMATED USD VALUES APPLIED
                  </p>
                )}
              </div>
              <div
                className={`rounded-xs border px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-widest ${riskyCount > 0 ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 animate-pulse' : 'border-zinc-800 bg-zinc-900 text-zinc-400'}`}
              >
                {riskyCount} Flags
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {slugs.length === 0 ? (
                <div className="rounded-xs border border-dashed border-zinc-850 bg-zinc-950/20 px-4 py-8 text-center text-zinc-550 font-mono text-xs">
                  &gt; Watch buffer empty. Deploy research queries to begin tracking.
                </div>
              ) : (
                marketRows.map(({ slug, market, priceUsd, priceChange24h }) => {
                  const status = riskState(market)
                  return (
                    <div
                      key={`${chain.name}:${slug}`}
                      className="rounded-xs border border-zinc-900 bg-zinc-950/60 p-4 space-y-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-orbitron font-bold text-sm tracking-wider leading-tight text-white uppercase">
                            {slug}
                          </p>
                          <p className="mt-1 text-[9px] font-mono text-zinc-500 uppercase">
                            {market?.category ?? 'Cross-Chain Asset'}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-xs border px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider ${status.tone}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                        <MiniMetric
                          label={isTestNetwork(chain.environment) ? 'Est. Price*' : 'Price'}
                          value={formatUsd(priceUsd)}
                          tone={(priceChange24h ?? 0) < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}
                        />
                        <MiniMetric
                          label="TVL"
                          value={market?.tvl ? `$${Math.round(market.tvl / 1_000_000)}M` : 'N/A'}
                        />
                        <MiniMetric
                          label="24h Change"
                          value={formatPct(market?.change_1d)}
                          tone={(market?.change_1d ?? 0) < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}
                        />
                        <MiniMetric
                          label="7d Change"
                          value={formatPct(market?.change_7d)}
                          tone={(market?.change_7d ?? 0) < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-900/60">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="border border-zinc-800 bg-zinc-900/40 text-zinc-450 hover:text-white hover:bg-zinc-800 rounded-xs h-7 text-[10px] font-mono font-bold uppercase tracking-wider flex-1"
                        >
                          <Link href={`/research?q=${slug}`} className="flex items-center justify-center gap-1">
                            Research <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="border border-zinc-800 bg-zinc-900/40 text-zinc-450 hover:text-white hover:bg-zinc-800 rounded-xs h-7 text-[10px] font-mono font-bold uppercase tracking-wider flex-1"
                        >
                          <Link href={`/war-room?protocol=${slug}`} className="flex items-center justify-center gap-1">
                            War Room <ShieldAlert className="h-3 w-3" />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemove(chain.type, chain.environment, slug)}
                          className="bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 border-rose-500/20 cursor-pointer h-7 text-[10px] font-mono font-bold uppercase tracking-wider px-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
      <TerminalExecutionModal isOpen={execModalOpen} onClose={() => setExecModalOpen(false)} action={execAction} />
    </div>
  )
}
