'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { BookOpenText, Sparkles, Layers3, Network, Link2, Activity } from 'lucide-react'

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
    [watchlistsByChainData],
  )

  const flattenedWatchlist = useMemo(
    () => Array.from(new Set(Object.values(watchlistsByChain).flat())),
    [watchlistsByChain],
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
    [previewSlugs, watchlistsByChain],
  )

  return (
    <div className="selection:bg-cyan-400/20">
      <div className="relative mx-auto max-w-6xl space-y-8 px-4 py-8 md:space-y-10 md:px-6 md:py-10">
        <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_16px_60px_rgba(0,0,0,0.22)] md:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-start">
            <div className="space-y-5">
              <Badge variant="accent" className="w-fit gap-2 px-3 py-1.5 uppercase tracking-[0.22em]">
                <Layers3 className="h-3.5 w-3.5" />
                Aegis Command Center
              </Badge>

              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-5xl">
                  Multichain research, organized for fast decisions.
                </h1>
                <p className="max-w-xl text-xs sm:text-sm leading-relaxed text-zinc-400">
                  Keep the active chain, watchlist, and analysis entry points in one clean workspace. Start with the
                  current chain or move directly into research when a protocol needs attention.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                  <Link href="/research">Launch Research</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/war-room">Open War Room</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
              <MetricPill label="Active chain" value={activeChain.displayName} icon={<Network className="h-4 w-4" />} />
              <MetricPill
                label="Tracked protocols"
                value={String(flattenedWatchlist.length)}
                icon={<BookOpenText className="h-4 w-4" />}
              />
              <MetricPill
                label="Connected chains"
                value={String(activeChainConnections.length || 1)}
                icon={<Link2 className="h-4 w-4" />}
              />
              <MetricPill
                label="Watchlist status"
                value={flattenedWatchlist.length > 0 ? 'Live' : 'Empty'}
                icon={<Activity className="h-4 w-4" />}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <Card className="border-white/10 bg-white/[0.04] shadow-[0_16px_60px_rgba(0,0,0,0.16)]">
            <CardHeader>
              <CardTitle className="text-lg font-black text-white">Workspace overview</CardTitle>
              <CardDescription className="text-zinc-400">A short summary of what the page offers next.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Chain coverage" value={`${activeChainConnections.length || 1} linked`} />
              <InfoRow label="Watchlist footprint" value={`${flattenedWatchlist.length} protocols`} />
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] shadow-[0_16px_60px_rgba(0,0,0,0.16)]">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-black text-white">Recent watchlist</CardTitle>
                  <CardDescription className="text-zinc-400">Top entries from your active chain sets.</CardDescription>
                </div>
                <Badge variant="accent" className="gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Live
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {flattenedWatchlist.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-400">
                  No protocols are in the watchlist yet. Open Research and add one from a chain view to start building
                  the set.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentWatchlist.map(({ slug, chains }) => (
                    <div
                      key={slug}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold capitalize text-white">{slug}</p>
                        <p className="text-xs text-zinc-400">
                          {chains.length} chain{chains.length === 1 ? '' : 's'} tracked
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {chains.slice(0, 2).map((chainType) => (
                          <span
                            key={`${slug}:${chainType}`}
                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${CHAIN_TONES[chainType] ?? 'bg-zinc-800 text-zinc-300'}`}
                          >
                            {allChains.find((chain) => chain.type === chainType)?.displayName ?? chainType}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}

function MetricPill({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-white/20 hover:from-white/[0.06] hover:to-white/[0.02]">
      {/* Subtle glowing accent background */}
      <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-cyan-400/5 blur-xl transition-all duration-300 group-hover:bg-cyan-400/10" />

      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 transition-colors group-hover:text-zinc-400">
          {label}
        </p>
        {icon && <span className="text-zinc-500 transition-colors duration-300 group-hover:text-cyan-400">{icon}</span>}
      </div>
      <p className="mt-4 text-lg font-black leading-snug text-white sm:text-xl md:text-2xl tracking-tight">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  )
}
