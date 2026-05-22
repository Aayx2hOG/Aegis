'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowRight, BookOpenText, Radar, ShieldAlert, Telescope, Layers3 } from 'lucide-react'

import { useMultiChain, } from '@/components/chain/chain-provider'
import { useMultiChainWatchlist } from '@/hooks/use-multichain-watchlist'
import { useSolanaProtocols } from '@/hooks/use-defillama'
import { ChainType } from '@/lib/chain/types'
import { normalizeProtocolSlug, resolveProtocolFromList } from '@/shared/protocol/slug-resolver'
import type { ResearchBrief } from '@/shared/types/research'

function formatPct(value: number | null | undefined): string {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A'
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}%`
}

function extractBriefSnapshot(markdown: string): string {
    const ignoredHeadings = ['overview', 'key metrics', 'on-chain activity', 'risk & opportunity', 'summary verdict']
    const lines = markdown.split('\n').map((line) => line.trim())

    for (const raw of lines) {
        if (!raw || raw === '---') continue
        if (raw.startsWith('#')) continue
        if (raw.startsWith('|') || raw.startsWith('```')) continue

        const cleaned = raw.replace(/^[-*]\s+/, '').trim()
        if (!cleaned) continue
        if (ignoredHeadings.includes(cleaned.toLowerCase().replace(/:$/, ''))) continue

        return cleaned
    }

    return 'Signal snapshot is still being assembled. Open Watchlist for full context.'
}

const CHAIN_TONES: Record<string, string> = {
    solana: 'bg-cyan-400/10 text-cyan-200',
    ethereum: 'bg-blue-400/10 text-blue-200',
    arbitrum: 'bg-sky-400/10 text-sky-200',
    optimism: 'bg-rose-400/10 text-rose-200',
    polygon: 'bg-violet-400/10 text-violet-200',
    base: 'bg-emerald-400/10 text-emerald-200',
    cosmos: 'bg-amber-400/10 text-amber-200',
}

export function DashboardFeature() {
    const { activeChain, activeChainConnections, allChains } = useMultiChain()
    const { data: watchlistsByChainData, isLoading: watchlistLoading } = useMultiChainWatchlist()
    const { data: protocols = [] } = useSolanaProtocols()
    const watchlistsByChain = useMemo<Partial<Record<ChainType, string[]>>>(
        () => watchlistsByChainData ?? {},
        [watchlistsByChainData]
    )
    const [briefs, setBriefs] = useState<Record<string, ResearchBrief | 'loading' | 'error'>>({})

    const flattenedWatchlist = useMemo(
        () => Array.from(new Set(Object.values(watchlistsByChain).flat())),
        [watchlistsByChain]
    )
    const previewSlugs = useMemo(() => flattenedWatchlist.slice(0, 3), [flattenedWatchlist])
    const previewRows = useMemo(
        () =>
            previewSlugs.map((slug) => ({
                slug,
                market: resolveProtocolFromList(slug, protocols),
                chains: Object.entries(watchlistsByChain)
                    .filter(([, slugs]) => slugs.includes(slug))
                    .map(([chainType]) => chainType),
            })),
        [previewSlugs, protocols, watchlistsByChain]
    )
    const hiddenCount = Math.max(0, flattenedWatchlist.length - previewSlugs.length)

    useEffect(() => {
        if (watchlistLoading || previewSlugs.length === 0) return

        previewSlugs.forEach((slug) => {
            if (!briefs[slug]) {
                fetchBrief(slug)
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewSlugs, watchlistLoading])

    async function fetchBrief(slug: string) {
        setBriefs((prev) => ({ ...prev, [slug]: 'loading' }))
        try {
            const res = await fetch('/api/research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ protocol: normalizeProtocolSlug(slug) }),
            })
            if (!res.ok) throw new Error('Failed to fetch')
            const data: ResearchBrief = await res.json()
            setBriefs((prev) => ({ ...prev, [slug]: data }))
        } catch {
            setBriefs((prev) => ({ ...prev, [slug]: 'error' }))
        }
    }

    return (
        <div className="min-h-screen text-zinc-100 selection:bg-cyan-400/20 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.2),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[10%] -left-[8%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />
                <div className="absolute top-[18%] -right-[8%] h-[32%] w-[32%] rounded-full bg-blue-500/10 blur-[100px]" />
            </div>

            <div className="relative mx-auto max-w-6xl space-y-10 px-4 py-10 md:space-y-12 md:px-6 md:py-14">
                <section className="space-y-6 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-200">
                        <Layers3 className="h-3.5 w-3.5" />
                        Aegis Command Center
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">
                        Multichain Research
                        <span className="block text-cyan-200">Workspace</span>
                    </h1>
                    <p className="mx-auto max-w-2xl text-zinc-300">
                        Track protocols across chains, compare momentum side-by-side, and jump directly into war-room analysis when a position starts to drift.
                    </p>
                </section>

                <section className={`rounded-3xl border p-5 text-left shadow-2xl backdrop-blur-xl ${activeChain.type === ChainType.Solana ? 'border-cyan-300/20 bg-cyan-400/10' : activeChain.type === ChainType.Ethereum ? 'border-blue-300/20 bg-blue-400/10' : 'border-zinc-300/20 bg-zinc-900/60'}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Current view</p>
                            <h2 className="mt-1 text-2xl font-black text-white">{activeChain.displayName}</h2>
                            <p className="mt-1 max-w-2xl text-sm text-zinc-300">
                                The dashboard is now tuned for {activeChain.displayName}. Switching chains changes this hero card, the active-chain banner, and the chain-specific previews below.
                            </p>
                        </div>
                        <div className="rounded-2xl bg-zinc-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200 ring-1 ring-white/10">
                            {activeChain.type === ChainType.Solana
                                ? `${activeChain.environment === 'devnet' ? 'Solana devnet testing' : 'Solana mainnet production'}`
                                : `${activeChain.displayName} chain context`}
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <QuickLinkCard
                        href="/research"
                        title="Launch Research"
                        description="Generate live protocol intelligence briefs from market feeds and chain-aware context."
                        icon={<BookOpenText className="h-5 w-5" />}
                    />
                    <QuickLinkCard
                        href="/war-room"
                        title="Open War Room"
                        description="Run scenario simulations and compare deployment posture across chains."
                        icon={<ShieldAlert className="h-5 w-5" />}
                    />
                    <QuickLinkCard
                        href="/watchlist"
                        title="Manage Watchlist"
                        description="Track protocol priorities per chain and keep your monitored stack current."
                        icon={<Radar className="h-5 w-5" />}
                    />
                </section>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <StatCard label="Tracked Protocols" value={String(flattenedWatchlist.length)} sub="Across all active chains" />
                    <StatCard label="Active Chains" value={String(activeChainConnections.length || 1)} sub={activeChain.displayName} />
                    <StatCard label="Mode" value={activeChainConnections.length > 1 ? 'Comparative' : 'Focused'} sub="Chain-aware research" />
                </div>

                {flattenedWatchlist.length === 0 && !watchlistLoading ? (
                    <div className="glass-card rounded-3xl bg-zinc-900/45 p-16 text-center shadow-2xl">
                        <div className="mb-6 flex justify-center text-cyan-200/80">
                            <Telescope className="h-10 w-10" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold">Watchlist is Empty</h2>
                        <p className="mb-8 text-zinc-400">Start by researching a protocol and adding it to a chain-specific watchlist.</p>
                        <Link href="/research" className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-6 py-3 font-bold text-white transition-all hover:bg-zinc-700">
                            Go to Research <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-400">
                            <Activity className="h-4 w-4 text-cyan-200" />
                            Chain Watchlist Preview
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {allChains.slice(0, 4).map((chain) => {
                                const count = watchlistsByChain[chain.type]?.length ?? 0
                                return (
                                    <div key={chain.name} className="rounded-2xl bg-zinc-900/50 p-4 ring-1 ring-white/5 backdrop-blur-xl">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-white">{chain.displayName}</p>
                                                <p className="text-xs text-zinc-500">{count} tracked protocol{count === 1 ? '' : 's'}</p>
                                            </div>
                                            <div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${CHAIN_TONES[chain.name.split('-')[0]] ?? 'bg-zinc-800 text-zinc-300'}`}>
                                                {count > 0 ? 'Live' : 'Idle'}
                                            </div>
                                        </div>
                                        <div className="mt-3 h-2 rounded-full bg-zinc-800">
                                            <div className="h-2 rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400" style={{ width: `${Math.min(100, count * 20)}%` }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {previewRows.map(({ slug, market, chains }) => (
                                <div key={slug} className="glass-card group overflow-hidden rounded-2xl bg-zinc-900/50 shadow-xl transition-all hover:bg-zinc-900/65">
                                    <div className="p-6 space-y-4">
                                        <div className="flex justify-between items-start gap-2">
                                            <div>
                                                <h3 className="text-xl font-black tracking-tight text-white capitalize">{slug}</h3>
                                                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">{chains.length} chain{chains.length === 1 ? '' : 's'}</p>
                                            </div>
                                            <div className="rounded bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-200">Tracked</div>
                                        </div>

                                        {briefs[slug] === 'loading' ? (
                                            <div className="py-8 flex flex-col items-center justify-center space-y-3">
                                                <span className="loading loading-spinner loading-md text-cyan-300" />
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Aegis Thinking...</span>
                                            </div>
                                        ) : briefs[slug] === 'error' ? (
                                            <div className="py-4 text-center">
                                                <p className="text-red-400 text-xs mb-2">Failed to update brief</p>
                                                <button onClick={() => fetchBrief(slug)} className="cursor-pointer text-[10px] font-bold uppercase text-zinc-400 underline hover:text-white">Retry</button>
                                            </div>
                                        ) : briefs[slug] ? (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                <p className="text-zinc-400 text-sm line-clamp-3">{extractBriefSnapshot((briefs[slug] as ResearchBrief).brief)}</p>
                                                <div className="grid grid-cols-3 gap-2 rounded-lg bg-zinc-950/70 p-2 text-[11px]">
                                                    <div>
                                                        <p className="text-zinc-500">TVL</p>
                                                        <p className="font-semibold text-zinc-100">{market?.tvl ? `$${Math.round(market.tvl / 1_000_000)}M` : 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-zinc-500">24h</p>
                                                        <p className={`font-semibold ${(market?.change_1d ?? 0) < 0 ? 'text-red-300' : 'text-emerald-300'}`}>{formatPct(market?.change_1d)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-zinc-500">7d</p>
                                                        <p className={`font-semibold ${(market?.change_7d ?? 0) < 0 ? 'text-red-300' : 'text-emerald-300'}`}>{formatPct(market?.change_7d)}</p>
                                                    </div>
                                                </div>
                                                <Link href="/watchlist" className="block rounded-lg bg-zinc-800 py-2 text-center text-xs font-bold transition-colors hover:bg-zinc-700">
                                                    Open Watchlist Workspace
                                                </Link>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {hiddenCount > 0 && (
                            <p className="text-xs text-zinc-500">
                                +{hiddenCount} more protocol{hiddenCount === 1 ? '' : 's'} in your watchlists. Open Watchlist to review complete chain coverage and action controls.
                            </p>
                        )}
                    </div>
                )}
            </div>

            <style jsx global>{`
        .glass-card {
          backdrop-filter: blur(20px);
        }
      `}</style>
        </div>
    )
}

function QuickLinkCard({
    href,
    title,
    description,
    icon,
}: {
    href: string
    title: string
    description: string
    icon: React.ReactNode
}) {
    return (
        <Link href={href} className="group rounded-2xl bg-zinc-900/45 p-5 shadow-xl transition-all hover:bg-zinc-900/65">
            <div className="mb-3 inline-flex rounded-lg bg-cyan-400/12 p-2 text-cyan-200">{icon}</div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="mt-2 text-sm text-zinc-400">{description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-cyan-200/90">
                Open
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
        </Link>
    )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div className="rounded-2xl bg-zinc-900/45 p-5 text-center shadow-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-white">{value}</p>
            <p className="mt-1 text-xs text-zinc-400">{sub}</p>
        </div>
    )
}