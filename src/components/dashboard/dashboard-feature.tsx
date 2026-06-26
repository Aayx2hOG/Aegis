'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Activity, Cpu, Layers3, Network, Search, ShieldCheck, TrendingUp } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'

import { useMultiChain } from '@/components/chain/chain-provider'
import { useMultiChainWatchlist } from '@/lib/hooks/use-multichain-watchlist'
import { ChainType } from '@/lib/chain/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid'
import { PrimaryWorkflow } from '@/components/workflow/primary-workflow'

function WorkspaceSnapshot({
  chainCoverage,
  watchedProtocols,
  connected,
  activeChainName,
}: {
  chainCoverage: number
  watchedProtocols: number
  connected: boolean
  activeChainName: string
}) {
  const stats = [
    { label: 'Network', value: activeChainName },
    { label: 'Tracked chains', value: String(chainCoverage) },
    { label: 'Saved protocols', value: String(watchedProtocols) },
    { label: 'Session', value: connected ? 'Connected' : 'Guest' },
  ]

  return (
    <div className="finance-surface w-full p-4">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="finance-label text-cyan-300">Command center</p>
          <p className="mt-1 text-sm font-semibold text-white">Live workspace state</p>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
          Synced
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-zinc-950/55 px-3 py-2"
          >
            <span className="text-xs text-zinc-500">{stat.label}</span>
            <span className="truncate text-sm font-semibold text-zinc-100">{stat.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-cyan-300"
          style={{ width: `${Math.min(100, Math.max(12, watchedProtocols * 12))}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">Coverage expands as protocols are added to the watchlist.</p>
    </div>
  )
}

// Professional, neutral chain tags
const CHAIN_TONES: Record<string, string> = {
  solana: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-xs shadow-cyan-500/5',
  ethereum: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  arbitrum: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  optimism: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  polygon: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  base: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  cosmos: 'bg-zinc-800 text-zinc-300 border-zinc-700',
}

export function DashboardFeature() {
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58()
  const { activeChain, activeChainConnections, allChains } = useMultiChain()
  const { data: watchlistsByChainData } = useMultiChainWatchlist(walletAddress)
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
    <div className="aegis-shell cyber-grid min-h-screen">
      <SpotlightCard
        spotlightColor="rgba(6, 182, 212, 0.055)"
        borderColor="rgba(103, 232, 249, 0.22)"
        className="aegis-panel relative p-6 md:p-8 lg:p-10"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />
        <div className="relative z-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-5 text-left lg:col-span-8">
            <Badge variant="outline" className="aegis-kicker w-fit">
              <Layers3 className="h-3.5 w-3.5" />
              Dashboard
            </Badge>

            <div className="space-y-4">
              <h1 className="aegis-heading max-w-4xl leading-[1.06]">Know what to check next.</h1>
              <p className="aegis-muted max-w-2xl">
                Use Aegis as one loop: research a protocol, save it for monitoring, create an alert, and run a War Room
                simulation only when risk needs deeper review.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild className="aegis-button-primary h-11">
                <Link href="/research">
                  <Search className="h-4 w-4" />
                  Start research
                </Link>
              </Button>
              <Button asChild className="aegis-button-secondary h-11">
                <Link href="/alerts">
                  <ShieldCheck className="h-4 w-4" />
                  Create alerts
                </Link>
              </Button>
              <Button asChild className="aegis-button-secondary h-11">
                <Link href="/war-room">
                  <Activity className="h-4 w-4" />
                  Simulate risk
                </Link>
              </Button>
            </div>
          </div>

          <div className="lg:col-span-4">
            <WorkspaceSnapshot
              chainCoverage={activeChainConnections.length || 1}
              watchedProtocols={flattenedWatchlist.length}
              connected={Boolean(walletAddress)}
              activeChainName={activeChain.displayName}
            />
          </div>
        </div>
      </SpotlightCard>

      <PrimaryWorkflow />

      <section className="space-y-6">
        <div className="flex flex-col gap-1 text-left">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
            <span className="h-2 w-2 rounded-full bg-cyan-300" />
            Monitoring overview
          </h2>
          <p className="aegis-muted">Live state, watchlist coverage, and rule-based alert readiness.</p>
        </div>

        <BentoGrid>
          {/* Card 1: Active Chain Info */}
          <BentoGridItem
            title="Active Network State"
            description="Network used for current protocol data and alert checks."
            icon={<Network className="h-4 w-4 text-cyan-400" />}
            className="md:col-span-1 text-left"
          >
            <div className="mt-4 flex flex-col justify-between h-[5.5rem]">
              <p className="text-2xl font-semibold tracking-tight text-white">{activeChain.displayName}</p>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <span className="text-xs font-medium text-emerald-200">RPC connected</span>
              </div>
            </div>
          </BentoGridItem>

          {/* Card 2: Workspace Overview */}
          <BentoGridItem
            title="Core Monitoring Scope"
            description="Saved protocols and chain coverage used by alert checks."
            icon={<Cpu className="h-4 w-4 text-cyan-400" />}
            className="md:col-span-2 text-left"
          >
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-medium text-zinc-500">Chain coverage</p>
                <p className="mt-1 text-2xl font-semibold text-cyan-100">{activeChainConnections.length || 1}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-medium text-zinc-500">Watched protocols</p>
                <p className="mt-1 text-2xl font-semibold text-cyan-100">{flattenedWatchlist.length}</p>
              </div>
            </div>
          </BentoGridItem>

          {/* Card 3: Recent Watchlist */}
          <BentoGridItem
            title="Saved Protocols"
            description="Recent protocols saved from Research."
            icon={<ShieldCheck className="h-4 w-4 text-cyan-400" />}
            className="md:col-span-2 text-left"
          >
            <div className="mt-3">
              {flattenedWatchlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center space-y-3">
                  <ShieldCheck className="h-6 w-6 text-zinc-600 stroke-[1.5]" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-zinc-200">No saved protocols yet</p>
                    <p className="text-xs text-zinc-500">
                      Start in Research, then save protocols that need repeated monitoring.
                    </p>
                  </div>
                  <Button asChild size="sm" className="aegis-button-secondary h-8 px-4 text-xs">
                    <Link href="/research">Start Research</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {recentWatchlist.map(({ slug, chains }) => (
                    <div
                      key={slug}
                      className="group/item rounded-lg border border-white/10 bg-white/[0.035] px-3.5 py-3 text-left transition-all hover:border-cyan-300/25"
                    >
                      <p className="text-sm font-semibold capitalize text-white transition-colors group-hover/item:text-cyan-100">
                        {slug}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {chains.slice(0, 1).map((chainType) => (
                          <span
                            key={`${slug}:${chainType}`}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                              CHAIN_TONES[chainType] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700'
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
            title="Monitoring State"
            description="Whether this workspace has saved protocols ready for alerts."
            icon={<Activity className="h-4 w-4 text-cyan-400" />}
            className="md:col-span-1 text-left"
          >
            <div className="mt-4 flex flex-col justify-between h-[5.5rem]">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold text-white">{flattenedWatchlist.length}</span>
                <span className="text-xs font-medium text-zinc-500">Watched</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">Monitor mode</span>
                <Badge
                  variant="outline"
                  className={`gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    flattenedWatchlist.length > 0
                      ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                      : 'border-zinc-700 bg-zinc-900/60 text-zinc-300'
                  }`}
                >
                  <TrendingUp className="h-3 w-3" />
                  {flattenedWatchlist.length > 0 ? 'Tracking' : 'Idle'}
                </Badge>
              </div>
            </div>
          </BentoGridItem>
        </BentoGrid>
      </section>
    </div>
  )
}
