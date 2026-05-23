'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpenText, Radar, ShieldAlert, Layers3, Sparkles } from 'lucide-react'

import { useMultiChain } from '@/components/chain/chain-provider'
import { useMultiChainWatchlist } from '@/hooks/use-multichain-watchlist'
import { ChainType } from '@/lib/chain/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    const { data: watchlistsByChainData } = useMultiChainWatchlist()
    const watchlistsByChain = useMemo<Partial<Record<ChainType, string[]>>>(
        () => watchlistsByChainData ?? {},
        [watchlistsByChainData]
    )

    const flattenedWatchlist = useMemo(
        () => Array.from(new Set(Object.values(watchlistsByChain).flat())),
        [watchlistsByChain]
    )
    const previewSlugs = useMemo(() => flattenedWatchlist.slice(0, 3), [flattenedWatchlist])
    const recentWatchlist = useMemo(
        () =>
            previewSlugs.map((slug) => ({
                slug,
                chains: Object.entries(watchlistsByChain)
                    .filter(([, slugs]) => slugs.includes(slug))
                    .map(([chainType]) => chainType),
            })),
        [previewSlugs, watchlistsByChain]
    )

    return (
        <div className="min-h-screen text-zinc-100 selection:bg-cyan-400/20 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.2),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[10%] -left-[8%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />
                <div className="absolute top-[18%] -right-[8%] h-[32%] w-[32%] rounded-full bg-blue-500/10 blur-[100px]" />
            </div>

            <div className="relative mx-auto max-w-6xl space-y-10 px-4 py-10 md:space-y-12 md:px-6 md:py-14">
                <section className="grid gap-6 lg:grid-cols-[1.25fr_0.85fr] lg:items-stretch">
                    <Card className="overflow-hidden border-white/10 bg-zinc-950/55 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
                        <CardHeader className="space-y-5 pb-0">
                            <Badge variant="accent" className="w-fit gap-2 px-3 py-1.5 uppercase tracking-[0.22em]">
                                <Layers3 className="h-3.5 w-3.5" />
                                Aegis Command Center
                            </Badge>
                            <div className="space-y-3">
                                <CardTitle className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl">
                                    Multichain Research
                                    <span className="block text-cyan-200">Workspace</span>
                                </CardTitle>
                                <CardDescription className="max-w-2xl text-base text-zinc-300 md:text-lg">
                                    Track protocols across chains, compare momentum side-by-side, and jump directly into war-room analysis when a position starts to drift.
                                </CardDescription>
                            </div>
                        </CardHeader>

                        <CardContent className="mt-8 space-y-5">
                            <p className="max-w-2xl text-sm leading-6 text-zinc-300 md:text-base">
                                {activeChain.displayName} is active with {activeChainConnections.length} connected chain{activeChainConnections.length === 1 ? '' : 's'} and {flattenedWatchlist.length} protocol{flattenedWatchlist.length === 1 ? '' : 's'} under watch.
                            </p>

                            <div className="flex flex-wrap gap-3">
                                <Button asChild className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                                    <Link href="/research">Launch Research</Link>
                                </Button>
                                <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                                    <Link href="/war-room">Open War Room</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-zinc-950/55 shadow-2xl shadow-blue-950/20 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-lg font-black text-white">At a glance</CardTitle>
                            <CardDescription className="text-zinc-400">
                                Just the core numbers that matter right now.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <MetricPill label="Tracked" value={String(flattenedWatchlist.length)} />
                                <MetricPill label="Chains" value={String(activeChainConnections.length || 1)} />
                                <MetricPill label="Mode" value={activeChainConnections.length > 1 ? 'Comparative' : 'Focused'} />
                                <MetricPill label="Status" value={flattenedWatchlist.length > 0 ? 'Live' : 'Empty'} />
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                    <Card className="border-white/10 bg-zinc-950/45 shadow-2xl shadow-black/20 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-lg font-black text-white">Quick actions</CardTitle>
                            <CardDescription className="text-zinc-400">Only the routes you actually use from the home page.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-3">
                            <CompactAction href="/research" title="Research" icon={<BookOpenText className="h-4 w-4" />} />
                            <CompactAction href="/war-room" title="War Room" icon={<ShieldAlert className="h-4 w-4" />} />
                            <CompactAction href="/watchlist" title="Watchlist" icon={<Radar className="h-4 w-4" />} />
                        </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-zinc-950/45 shadow-2xl shadow-black/20 backdrop-blur-xl">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-lg font-black text-white">Recent watchlist</CardTitle>
                                    <CardDescription className="text-zinc-400">Top items from your active chain sets.</CardDescription>
                                </div>
                                <Badge variant="accent" className="gap-2">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Live
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {flattenedWatchlist.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-zinc-400">
                                    No protocols in the watchlist yet. Start in Research and add one from a chain view.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {recentWatchlist.map(({ slug, chains }) => (
                                        <div key={slug} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                            <div>
                                                <p className="font-semibold capitalize text-white">{slug}</p>
                                                <p className="text-xs text-zinc-400">
                                                    {chains.length} chain{chains.length === 1 ? '' : 's'} tracked
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap justify-end gap-2">
                                                {chains.slice(0, 2).map((chainType) => (
                                                    <span key={`${slug}:${chainType}`} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${CHAIN_TONES[chainType] ?? 'bg-zinc-800 text-zinc-300'}`}>
                                                        {allChains.find((chain) => chain.type === chainType)?.displayName ?? chainType}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {flattenedWatchlist.length > previewSlugs.length && (
                                        <p className="text-xs text-zinc-500">+{flattenedWatchlist.length - previewSlugs.length} more protocol{flattenedWatchlist.length - previewSlugs.length === 1 ? '' : 's'} in watchlists.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>

                <div className="flex justify-center">
                    <Link href="/watchlist" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition-colors hover:text-cyan-100">
                        Open full watchlist
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </div>
    )
}

function MetricPill({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-white">{value}</p>
        </div>
    )
}

function CompactAction({ href, title, icon }: { href: string; title: string; icon: React.ReactNode }) {
    return (
        <Button asChild variant="outline" className="h-auto justify-start border-white/10 bg-white/5 px-4 py-4 text-left text-white hover:bg-white/10 hover:text-white">
            <Link href={href} className="flex items-center gap-3">
                <span className="inline-flex rounded-lg border border-cyan-400/15 bg-cyan-400/10 p-2 text-cyan-200">{icon}</span>
                <span className="font-semibold">{title}</span>
            </Link>
        </Button>
    )
}