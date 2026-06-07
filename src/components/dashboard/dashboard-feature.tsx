'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  BookOpenText,
  Layers3,
  Network,
  Cpu,
  ShieldCheck,
  TrendingUp,
  Activity,
} from 'lucide-react'

import { useMultiChain } from '@/components/chain/chain-provider'
import { useMultiChainWatchlist } from '@/hooks/use-multichain-watchlist'
import { ChainType } from '@/lib/chain/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid'

// Professional, neutral chain tags
const CHAIN_TONES: Record<string, string> = {
  solana: 'bg-zinc-900 text-zinc-300 border-zinc-800/80 shadow-none',
  ethereum: 'bg-zinc-900 text-zinc-300 border-zinc-800/80 shadow-none',
  arbitrum: 'bg-zinc-900 text-zinc-300 border-zinc-800/80 shadow-none',
  optimism: 'bg-zinc-900 text-zinc-300 border-zinc-800/80 shadow-none',
  polygon: 'bg-zinc-900 text-zinc-300 border-zinc-800/80 shadow-none',
  base: 'bg-zinc-900 text-zinc-300 border-zinc-800/80 shadow-none',
  cosmos: 'bg-zinc-900 text-zinc-300 border-zinc-800/80 shadow-none',
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
    <div className="mx-auto max-w-6xl space-y-12 py-6">
      {/* Refined Hero Spotlight Area */}
      <SpotlightCard
        spotlightColor="rgba(255, 255, 255, 0.03)"
        borderColor="rgba(255, 255, 255, 0.1)"
        className="relative overflow-hidden rounded-3xl border border-zinc-800/60 bg-zinc-950/20 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.6)] md:p-12"
      >
        <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
          <Badge
            variant="outline"
            className="w-fit gap-1.5 px-3 py-1 uppercase tracking-[0.2em] bg-zinc-900 text-zinc-400 border-zinc-800/80 text-[10px] font-semibold"
          >
            <Layers3 className="h-3 w-3 text-zinc-400" />
            Intelligence Terminal
          </Badge>

          <div className="space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl leading-[1.12] drop-shadow-[0_0_15px_rgba(255,255,255,0.08)]">
              Multichain research,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 font-extrabold">
                organized for fast decisions
              </span>
              .
            </h1>
            <p className="max-w-xl text-xs sm:text-sm leading-relaxed text-zinc-400 font-normal">
              Keep the active chain, watchlist, and analysis entry points in one clean workspace. Start
              with the current chain or move directly into research when a protocol needs attention.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <Button
              asChild
              className="bg-white text-zinc-950 hover:bg-zinc-200 transition-all px-6 h-11 rounded-lg font-bold select-none cursor-pointer shadow-[0_0_12px_rgba(255,255,255,0.08)] hover:shadow-[0_0_18px_rgba(255,255,255,0.18)]"
            >
              <Link href="/research">Launch Research</Link>
            </Button>
            <Button
              asChild
              className="border border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:text-white hover:bg-zinc-900 transition-all px-6 h-11 rounded-lg font-bold select-none cursor-pointer"
            >
              <Link href="/research/compare">⚔️ Compare Protocols</Link>
            </Button>
            <Button
              asChild
              className="border border-zinc-800/60 bg-zinc-900/30 text-zinc-300 hover:text-white hover:bg-zinc-900/80 transition-all px-6 h-11 rounded-lg font-bold select-none cursor-pointer"
            >
              <Link href="/war-room">Open War Room</Link>
            </Button>
          </div>
        </div>
      </SpotlightCard>

      {/* Overview, Telemetry and Watchlist Grid (Bento Grid) */}
      <section className="space-y-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-white tracking-tight">Active Telemetry</h2>
          <p className="text-xs text-zinc-500">Real-time state and tracked items across multi-chain sets.</p>
        </div>

        <BentoGrid>
          {/* Card 1: Active Chain Info */}
          <BentoGridItem
            title="Active Network State"
            description="Details of the network currently targeted by your research sessions."
            icon={<Network className="h-4 w-4 text-zinc-400" />}
            className="md:col-span-1 border-zinc-800/80 bg-zinc-900/20 hover:border-zinc-700"
          >
            <div className="mt-4 flex flex-col justify-between h-[5.5rem]">
              <p className="text-2xl font-bold text-white tracking-tight">
                {activeChain.displayName}
              </p>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">
                  RPC Endpoint Online
                </span>
              </div>
            </div>
          </BentoGridItem>

          {/* Card 2: Workspace Overview */}
          <BentoGridItem
            title="Workspace Overview"
            description="Summary of active telemetry feeds and data sources."
            icon={<Cpu className="h-4 w-4 text-zinc-400" />}
            className="md:col-span-2 border-zinc-800/80 bg-zinc-900/20 hover:border-zinc-700"
          >
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-zinc-950/45 p-4 border border-zinc-800/40">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                  Chain Coverage
                </p>
                <p className="mt-1.5 text-lg font-bold text-zinc-100">
                  {activeChainConnections.length || 1} Linked
                </p>
              </div>
              <div className="rounded-xl bg-zinc-950/45 p-4 border border-zinc-800/40">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                  Watchlist footprint
                </p>
                <p className="mt-1.5 text-lg font-bold text-zinc-100">
                  {flattenedWatchlist.length} Protocols
                </p>
              </div>
            </div>
          </BentoGridItem>

          {/* Card 3: Recent Watchlist */}
          <BentoGridItem
            title="Recent Watchlist Items"
            description="Top entries and status triggers from active chain sets."
            icon={<ShieldCheck className="h-4 w-4 text-zinc-400" />}
            className="md:col-span-2 border-zinc-800/80 bg-zinc-900/20 hover:border-zinc-700"
          >
            <div className="mt-3">
              {flattenedWatchlist.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 p-6 text-center text-xs text-zinc-500">
                  No protocols are in the watchlist yet. Open Research and add one to start tracking.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {recentWatchlist.map(({ slug, chains }) => (
                    <div
                      key={slug}
                      className="group/item rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 hover:border-zinc-700 transition-all"
                    >
                      <p className="font-semibold capitalize text-xs text-white group-hover/item:text-zinc-200 transition-colors">
                        {slug}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {chains.slice(0, 1).map((chainType) => (
                          <span
                            key={`${slug}:${chainType}`}
                            className={`rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide border ${
                              CHAIN_TONES[chainType] ?? 'bg-zinc-900 text-zinc-300 border-zinc-800'
                            }`}
                          >
                            {allChains.find((chain) => chain.type === chainType)?.displayName ?? chainType}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </BentoGridItem>

          {/* Card 4: Monitor status */}
          <BentoGridItem
            title="Watchlist Status"
            description="Telemetry tracking and signals state."
            icon={<Activity className="h-4 w-4 text-zinc-400" />}
            className="md:col-span-1 border-zinc-800/80 bg-zinc-900/20 hover:border-zinc-700"
          >
            <div className="mt-4 flex flex-col justify-between h-[5.5rem]">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-white">
                  {flattenedWatchlist.length}
                </span>
                <span className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider">Protocols</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-medium">Telemetry feeds</span>
                <Badge
                  variant="outline"
                  className="gap-1 bg-zinc-900 text-zinc-350 border-zinc-800 font-bold text-[9px] uppercase tracking-wider px-2 py-0.5"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Live
                </Badge>
              </div>
            </div>
          </BentoGridItem>
        </BentoGrid>
      </section>
    </div>
  )
}
