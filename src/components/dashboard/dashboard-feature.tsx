'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Activity, ArrowRight, Cpu, Layers3, Network, Search, ShieldCheck, Swords, TrendingUp } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'

import { useMultiChain } from '@/components/chain/chain-provider'
import { useMultiChainWatchlist } from '@/lib/hooks/use-multichain-watchlist'
import { ChainType } from '@/lib/chain/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid'
import { Sparkles } from '@/components/ui/sparkles'
import { PrimaryWorkflow } from '@/components/workflow/primary-workflow'

function RadarScanner() {
  return (
    <div className="relative w-40 h-40 mx-auto border border-cyan-500/20 rounded-full flex items-center justify-center bg-zinc-950/80 shadow-[0_0_15px_rgba(6,182,212,0.1)] overflow-hidden shrink-0">
      <Sparkles id="radar-sparkles" particleDensity={30} minSize={0.4} maxSize={1.2} particleColor="#06b6d4" className="opacity-30" />
      {/* Concentric circles */}
      <div className="absolute w-32 h-32 border border-cyan-500/10 rounded-full" />
      <div className="absolute w-20 h-20 border border-cyan-500/15 rounded-full" />
      <div className="absolute w-10 h-10 border border-cyan-500/20 rounded-full" />

      {/* Crosshairs */}
      <div className="absolute w-full h-[1px] bg-cyan-500/10" />
      <div className="absolute h-full w-[1px] bg-cyan-500/10" />

      {/* Blinking Targets */}
      <span className="absolute top-10 left-8 w-2 h-2 rounded-full bg-emerald-500 animate-ping duration-1000" />
      <span className="absolute top-10 left-8 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />

      <span className="absolute bottom-12 right-12 w-2 h-2 rounded-full bg-cyan-500 animate-ping duration-700" />
      <span className="absolute bottom-12 right-12 w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]" />

      <span className="absolute top-20 right-10 w-2 h-2 rounded-full bg-amber-500 animate-ping duration-1500" />
      <span className="absolute top-20 right-10 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />

      {/* Sweep line */}
      <div
        className="absolute inset-0 origin-center bg-[conic-gradient(from_0deg,rgba(6,182,212,0.15)_0deg,transparent_90deg)] rounded-full animate-spin"
        style={{ animationDuration: '6s' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(7,11,19,0.9)_95%)] pointer-events-none" />
      <span className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] font-medium text-cyan-200/50">
        Live coverage
      </span>
    </div>
  )
}

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
  const statusRows = [
    ['Active network', activeChainName],
    ['Tracked chains', String(chainCoverage)],
    ['Watched protocols', String(watchedProtocols)],
    ['Wallet session', connected ? 'connected' : 'guest'],
  ]

  return (
    <div className="console-panel w-full space-y-2 rounded-lg p-3 font-mono text-[11px] text-zinc-300">
      <div className="mb-1.5 flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="flex items-center gap-1.5 font-semibold text-zinc-100">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Workspace state
        </span>
        <span className="text-[10px] font-medium text-zinc-500">live app data</span>
      </div>
      <div className="grid gap-1.5 text-left">
        {statusRows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 rounded border border-white/5 bg-white/[0.025] px-2 py-1"
          >
            <span className="text-zinc-500">{label}</span>
            <span className="truncate font-semibold text-cyan-100">{value}</span>
          </div>
        ))}
      </div>
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
            <Badge
              variant="outline"
              className="aegis-kicker w-fit"
            >
              <Layers3 className="h-3.5 w-3.5" />
              Multichain research workspace
            </Badge>

            <div className="space-y-4">
              <h1 className="aegis-heading max-w-4xl leading-[1.06]">
                Research protocols, track risk, and rehearse market stress in one focused workspace.
              </h1>
              <p className="aegis-muted max-w-2xl">
                Aegis brings protocol briefs, watchlists, alert rules, and portfolio simulations into an analyst-grade
                interface built for fast DeFi decisions across Solana and EVM networks.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                asChild
                className="aegis-button-primary h-11"
              >
                <Link href="/research">
                  <Search className="h-4 w-4" />
                  Start research
                </Link>
              </Button>
              <Button
                asChild
                className="aegis-button-secondary h-11"
              >
                <Link href="/research/compare">
                  <Swords className="h-4 w-4" />
                  Compare protocols
                </Link>
              </Button>
              <Button
                asChild
                className="aegis-button-secondary h-11"
              >
                <Link href="/war-room">
                  Open war room
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-5 rounded-lg border border-white/10 bg-white/[0.035] p-5 shadow-inner lg:col-span-4">
            <RadarScanner />
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
            Workspace overview
          </h2>
          <p className="aegis-muted">Live state, watchlist coverage, and next actions across your active chains.</p>
        </div>

        <BentoGrid>
          {/* Card 1: Active Chain Info */}
          <BentoGridItem
            title="Active Network State"
            description="Details of the network targeted by active research simulations."
            icon={<Network className="h-4 w-4 text-cyan-400" />}
            className="md:col-span-1 text-left"
          >
            <div className="mt-4 flex flex-col justify-between h-[5.5rem]">
              <p className="text-2xl font-semibold tracking-tight text-white">
                {activeChain.displayName}
              </p>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <span className="text-xs font-medium text-emerald-200">
                  RPC connected
                </span>
              </div>
            </div>
          </BentoGridItem>

          {/* Card 2: Workspace Overview */}
          <BentoGridItem
            title="Workspace Overview"
            description="Summary of active telemetry grids and watch parameters."
            icon={<Cpu className="h-4 w-4 text-cyan-400" />}
            className="md:col-span-2 text-left"
          >
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-medium text-zinc-500">Chain coverage</p>
                <p className="mt-1 text-2xl font-semibold text-cyan-100">
                  {activeChainConnections.length || 1}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-medium text-zinc-500">Watched protocols</p>
                <p className="mt-1 text-2xl font-semibold text-cyan-100">
                  {flattenedWatchlist.length}
                </p>
              </div>
            </div>
          </BentoGridItem>

          {/* Card 3: Recent Watchlist */}
          <BentoGridItem
            title="Recent Watchlist"
            description="Top monitored entries across connected networks."
            icon={<ShieldCheck className="h-4 w-4 text-cyan-400" />}
            className="md:col-span-2 text-left"
          >
            <div className="mt-3">
              {flattenedWatchlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center space-y-3">
                  <ShieldCheck className="h-6 w-6 text-zinc-600 stroke-[1.5]" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-zinc-200">
                      No watched protocols yet
                    </p>
                    <p className="text-xs text-zinc-500">
                      Add protocols from Research to monitor market movement and alert rules.
                    </p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className="aegis-button-secondary h-8 px-4 text-xs"
                  >
                    <Link href="/research">Browse Research</Link>
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
            title="Risk Telemetry State"
            description="Current workspace monitoring coverage."
            icon={<Activity className="h-4 w-4 text-cyan-400" />}
            className="md:col-span-1 text-left"
          >
            <div className="mt-4 flex flex-col justify-between h-[5.5rem]">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold text-white">{flattenedWatchlist.length}</span>
                <span className="text-xs font-medium text-zinc-500">
                  Watched
                </span>
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
