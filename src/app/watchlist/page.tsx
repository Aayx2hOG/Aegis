'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Activity, AlertTriangle, ExternalLink, Layers3, Radar, ShieldAlert, Sparkles } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'

import { useMultiChain } from '@/components/chain/chain-provider'
import { useMultiChainWatchlist } from '@/hooks/use-multichain-watchlist'
import { useWatchlist } from '@/hooks/use-watchlist'
import { useSolanaProtocols } from '@/hooks/use-defillama'
import { normalizeProtocolSlug, resolveProtocolFromList } from '@/shared/protocol/slug-resolver'
import { ChainType } from '@/lib/chain/types'
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
    id: string
    protocolSlug: string
    metric: AlertMetric
    threshold: number
    direction: AlertDirection
    currentValue: number
    triggeredAt: string
}

function formatPct(value: number | null | undefined): string {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A'
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
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

export default function WatchlistPage() {
    const { activeChain, activeChainConnections, allChains } = useMultiChain()
    const { data: watchlistsByChainData, isLoading: watchlistsLoading } = useMultiChainWatchlist()
    const { data: solanaProtocols = [], isLoading: marketLoading } = useSolanaProtocols()
    const wallet = useWallet()
    const walletAddress = wallet.publicKey?.toBase58()
    const watchlistsByChain: Partial<Record<ChainType, string[]>> = watchlistsByChainData ?? {}

    const [history, setHistory] = useState<ResearchHistoryItem[]>([])
    const [rules, setRules] = useState<AlertRuleItem[]>([])
    const [events, setEvents] = useState<AlertEventItem[]>([])
    const [dbStatus, setDbStatus] = useState<string | null>(null)
    const [historyLoading, setHistoryLoading] = useState(false)
    const [alertsLoading, setAlertsLoading] = useState(false)

    useEffect(() => {
        if (!walletAddress) {
            setHistory([])
            setRules([])
            setEvents([])
            setDbStatus(null)
            return
        }

        const encodedWalletAddress = encodeURIComponent(walletAddress)

        let cancelled = false

        async function loadHistory() {
            setHistoryLoading(true)
            try {
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
            setAlertsLoading(true)
            try {
                const res = await fetch(`/api/alerts/rules?walletAddress=${encodedWalletAddress}`)
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
    }, [walletAddress])

    const solanaWatch = useWatchlist()

    const chainViews = useMemo(() => {
        const visibleChainTypes = activeChainConnections.length > 0 ? activeChainConnections : [activeChain.type]

        return visibleChainTypes
            .map((chainType) => {
                const chain = allChains.find((item) => item.type === chainType)
                if (!chain) return null

                const slugs = watchlistsByChain[chainType] ?? []
                const marketRows = chainType === ChainType.Solana
                    ? slugs.map((slug) => {
                        const enriched = solanaWatch.watchlistItems.find((i) => i.slug === slug)
                        const market = enriched ? (enriched as unknown as SolanaProtocol) : resolveProtocolFromList(slug, solanaProtocols)
                        return { slug, market }
                    })
                    : slugs.map((slug) => ({ slug, market: undefined }))

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
    }, [activeChain.type, activeChainConnections, allChains, solanaProtocols, watchlistsByChain])

    const totalProtocols = chainViews.reduce((acc, item) => acc + item.total, 0)
    const riskyProtocols = chainViews.reduce((acc, item) => acc + item.riskyCount, 0)

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

                        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-zinc-900/45 p-4 backdrop-blur-xl">
                            <StatPill label="Chains" value={String(chainViews.length || 1)} />
                            <StatPill label="Protocols" value={String(totalProtocols)} />
                            <StatPill label="Flags" value={String(riskyProtocols)} tone={riskyProtocols > 0 ? 'text-rose-200' : 'text-emerald-200'} />
                        </div>
                    </div>
                </header>

                {!walletAddress && (
                    <div className="rounded-xl bg-zinc-900/55 px-4 py-3 text-xs text-zinc-300">
                        Guest mode is active. Your watchlists are saved locally in this browser. Connect a wallet to sync research history and alert automation.
                    </div>
                )}

                {dbStatus && <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{dbStatus}</div>}

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {chainViews.map(({ chain, slugs, marketRows, riskyCount }) => (
                        <article key={chain.name} className="rounded-3xl bg-zinc-900/45 p-5 backdrop-blur-xl ring-1 ring-white/5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ring-1 ${CHAIN_TONES[chain.type]}`}>{CHAIN_LABELS[chain.type]}</div>
                                    <h2 className="mt-3 text-2xl font-black text-white">{chain.displayName}</h2>
                                    <p className="mt-1 text-sm text-zinc-400">{slugs.length} tracked protocol{slugs.length === 1 ? '' : 's'}</p>
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
                                    marketRows.map(({ slug, market }) => {
                                        const status = riskState(market)
                                        return (
                                            <div key={`${chain.name}:${slug}`} className="rounded-2xl bg-zinc-950/60 p-4 ring-1 ring-white/5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold capitalize text-zinc-100">{slug}</p>
                                                        <p className="mt-1 text-xs text-zinc-500">{market?.category ?? 'Chain-agnostic signal'}</p>
                                                    </div>
                                                    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${status.tone}`}>{status.label}</span>
                                                </div>

                                                <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                                                    <MiniMetric label="Price" value={(market as any)?.priceUsd ? `$${Number((market as any).priceUsd).toFixed(2)}` : 'N/A'} tone={(market as any)?.priceChange24h < 0 ? 'text-rose-200' : 'text-emerald-200'} />
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

                <section className="grid gap-6 lg:grid-cols-2">
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
                            {allChains.slice(0, 4).map((chain) => {
                                const watchlistCount = watchlistsByChain[chain.type]?.length ?? 0
                                const momentum = chain.type === ChainType.Solana ? (slugsMomentumScore(chain.type, watchlistsByChain, solanaProtocols)) : 60 + watchlistCount * 4
                                const label = momentum > 75 ? 'Hot' : momentum > 55 ? 'Balanced' : 'Quiet'

                                return (
                                    <div key={chain.name} className="rounded-2xl bg-zinc-950/60 p-4 ring-1 ring-white/5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-white">{chain.displayName}</p>
                                                <p className="text-xs text-zinc-500">{watchlistCount} tracked protocol{watchlistCount === 1 ? '' : 's'}</p>
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
                            })}
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
                                {alertsLoading || historyLoading ? 'Syncing' : 'Synced'}
                            </div>
                        </div>

                        <div className="mt-4 space-y-4">
                            <div className="rounded-2xl bg-zinc-950/60 p-4">
                                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Alert rules</p>
                                {rules.length === 0 ? (
                                    <p className="mt-2 text-sm text-zinc-400">No rules yet. Create them from the alerts API and they will show up here automatically.</p>
                                ) : (
                                    <div className="mt-3 space-y-2">
                                        {rules.slice(0, 3).map((rule) => (
                                            <div key={rule.id} className="rounded-xl bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200">
                                                {rule.protocolSlug}: {ALERT_METRIC_LABEL[rule.metric]} {rule.direction === 'BELOW' ? '&le;' : '&ge;'} {rule.threshold.toFixed(2)}%
                                            </div>
                                        ))}
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
                                        {events.slice(0, 3).map((event) => (
                                            <div key={event.id} className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                                                {event.protocolSlug} hit {ALERT_METRIC_LABEL[event.metric]} at {event.currentValue.toFixed(2)}%
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {watchlistsLoading && (
                    <div className="rounded-xl bg-zinc-900/55 px-4 py-3 text-sm text-zinc-300">
                        Loading multichain watchlists...
                    </div>
                )}
            </div>
        </div>
    )
}

function StatPill({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="rounded-xl bg-zinc-950/70 px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
            <p className={`mt-1 text-2xl font-black ${tone ?? 'text-white'}`}>{value}</p>
        </div>
    )
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="rounded-lg bg-zinc-900/70 p-2">
            <p className="text-zinc-500">{label}</p>
            <p className={`font-semibold ${tone ?? 'text-zinc-100'}`}>{value}</p>
        </div>
    )
}

function slugsMomentumScore(
    chainType: ChainType,
    watchlistsByChain: Partial<Record<ChainType, string[]>>,
    protocols: SolanaProtocol[]
): number {
    const slugs = watchlistsByChain[chainType] ?? []
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