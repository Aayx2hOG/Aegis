'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { Layers3, Network, Cpu, ShieldCheck, TrendingUp, Activity } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'

import { useMultiChain } from '@/components/chain/chain-provider'
import { useMultiChainWatchlist } from '@/lib/hooks/use-multichain-watchlist'
import { ChainType } from '@/lib/chain/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid'
import { Meteors } from '@/components/ui/meteors'
import { Sparkles } from '@/components/ui/sparkles'

// Simulated logs list for active ticker feed
const SIMULATED_LOGS = [
  'SCANNING: Solana liquidity pools (Raydium, Orca)...',
  'OK: JitoSOL yield validated at 7.82% APR.',
  'DETECTION: EVM bridge transaction queues clear.',
  'WARNING: Aerodrome Base USDC pool concentration > 45%.',
  'TELEMETRY: Subscribed to 7 active chain feeds.',
  'SCANNING: Base network RPC latency stable at 38ms.',
  'MONITOR: Portfolio stress index low (24/100).',
  'DETECTION: Uniswap V3 Ethereum liquidity depth matches catalog.',
  'SCANNING: Kamino lending rate delta verified.',
]

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
      <span className="absolute bottom-1.5 left-0 right-0 text-center text-[7px] font-mono text-cyan-500/35 uppercase tracking-widest">
        MONITOR STATE
      </span>
    </div>
  )
}

function ActiveTicker() {
  const [logs, setLogs] = useState<string[]>(['AEGIS system initialization...', 'Connecting telemetry feeds...'])

  useEffect(() => {
    const interval = setInterval(() => {
      const randomLog = SIMULATED_LOGS[Math.floor(Math.random() * SIMULATED_LOGS.length)]
      const timestamp = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      setLogs((prev) => [`[${timestamp}] ${randomLog}`, ...prev.slice(0, 2)])
    }, 4500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="console-panel rounded-md p-3 font-mono text-[10px] text-cyan-400 space-y-1 select-none border border-cyan-500/10 min-h-[92px] shadow-[inset_0_0_15px_rgba(0,0,0,0.85)] bg-zinc-950/90 w-full">
      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-1.5 mb-1.5">
        <span className="font-bold flex items-center gap-1.5 tracking-wider uppercase">
          <span className="h-1 w-1 bg-cyan-400 animate-ping rounded-full" />
          AEGIS TELEMETRY GRID
        </span>
        <span className="text-zinc-550 uppercase text-[8px] tracking-widest font-black">SYS SCANNER</span>
      </div>
      <div className="space-y-1 text-left">
        {logs.map((log, idx) => (
          <div
            key={idx}
            className="truncate tracking-wide opacity-90 first:opacity-100 first:text-white transition-opacity duration-300"
          >
            {log}
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
    <div className="mx-auto max-w-6xl space-y-12 py-6 cyber-grid min-h-screen px-2">
      {/* Refined Hero Spotlight Area */}
      <SpotlightCard
        spotlightColor="rgba(6, 182, 212, 0.04)"
        borderColor="rgba(6, 182, 212, 0.2)"
        className="relative overflow-hidden rounded-xl border border-cyan-500/15 bg-zinc-950/20 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.8)] md:p-10 corner-decor"
      >
        <Meteors number={15} />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 flex flex-col gap-5 text-left">
            <Badge
              variant="outline"
              className="w-fit gap-1.5 px-3 py-1 uppercase tracking-[0.2em] bg-cyan-950/30 text-cyan-400 border-cyan-500/20 text-[9px] font-orbitron font-bold"
            >
              <Layers3 className="h-3.5 w-3.5 text-cyan-400" />
              Intelligence Terminal
            </Badge>

            <div className="space-y-4">
              <h1 className="text-3xl font-orbitron font-black uppercase tracking-wide text-white md:text-5xl leading-[1.12] drop-shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                Multichain DeFi research,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-100 font-black">
                  organized for decisions
                </span>
                .
              </h1>
              <p className="max-w-xl text-xs sm:text-sm leading-relaxed text-zinc-400 font-medium">
                Keep the active chain, threat watchlist, and research vectors in one workspace. Synthesize briefings or
                stress-test mock scenarios directly from a secure command terminal.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <Button
                asChild
                className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-all px-6 h-11 rounded-xs font-orbitron font-bold uppercase tracking-wider select-none cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.35)]"
              >
                <Link href="/research">Launch Research</Link>
              </Button>
              <Button
                asChild
                className="border border-zinc-800 bg-zinc-900/40 text-zinc-350 hover:text-white hover:bg-zinc-800 transition-all px-6 h-11 rounded-xs font-orbitron font-bold uppercase tracking-wider select-none cursor-pointer"
              >
                <Link href="/research/compare">⚔️ Compare Protocols</Link>
              </Button>
              <Button
                asChild
                className="border border-cyan-500/10 bg-cyan-500/5 text-cyan-400 hover:text-white hover:bg-cyan-500/20 transition-all px-6 h-11 rounded-xs font-orbitron font-bold uppercase tracking-wider select-none cursor-pointer"
              >
                <Link href="/war-room">Open War Room</Link>
              </Button>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col items-center gap-6 border border-cyan-500/10 p-5 rounded-lg bg-zinc-950/40 shadow-inner">
            <RadarScanner />
            <ActiveTicker />
          </div>
        </div>
      </SpotlightCard>

      {/* Overview, Telemetry and Watchlist Grid (Bento Grid) */}
      <section className="space-y-6">
        <div className="flex flex-col gap-1 text-left">
          <h2 className="text-lg font-orbitron font-bold text-white tracking-wider flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-ping" />
            Active Telemetry Feed
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            Real-time state and threat items across multichain assets.
          </p>
        </div>

        <BentoGrid>
          {/* Card 1: Active Chain Info */}
          <BentoGridItem
            title="Active Network State"
            description="Details of the network targeted by active research simulations."
            icon={<Network className="h-4 w-4 text-cyan-400" />}
            className="md:col-span-1 border-cyan-500/10 bg-zinc-950/50 hover:border-cyan-500/30 transition-all corner-decor text-left"
          >
            <div className="mt-4 flex flex-col justify-between h-[5.5rem]">
              <p className="text-2xl font-orbitron font-black text-white tracking-widest uppercase glow-cyan">
                {activeChain.displayName}
              </p>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono uppercase font-bold text-emerald-400 tracking-wider">
                  RPC Network Connected
                </span>
              </div>
            </div>
          </BentoGridItem>

          {/* Card 2: Workspace Overview */}
          <BentoGridItem
            title="Workspace Overview"
            description="Summary of active telemetry grids and watch parameters."
            icon={<Cpu className="h-4 w-4 text-cyan-400" />}
            className="md:col-span-2 border-cyan-500/10 bg-zinc-950/50 hover:border-cyan-500/30 transition-all corner-decor text-left"
          >
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xs bg-zinc-950 border border-zinc-800/80 p-4 shadow-[inset_0_0_8px_rgba(0,0,0,0.5)]">
                <p className="text-[8px] font-mono font-bold uppercase tracking-wider text-zinc-550">Chain Coverage</p>
                <p className="mt-1 text-xl font-orbitron font-bold text-cyan-400 font-black">
                  {activeChainConnections.length || 1} LINKED
                </p>
              </div>
              <div className="rounded-xs bg-zinc-950 border border-zinc-800/80 p-4 shadow-[inset_0_0_8px_rgba(0,0,0,0.5)]">
                <p className="text-[8px] font-mono font-bold uppercase tracking-wider text-zinc-550">
                  Threat Watchlist
                </p>
                <p className="mt-1 text-xl font-orbitron font-bold text-cyan-400 font-black">
                  {flattenedWatchlist.length} BUCKETS
                </p>
              </div>
            </div>
          </BentoGridItem>

          {/* Card 3: Recent Watchlist */}
          <BentoGridItem
            title="Recent Watchlist Channels"
            description="Top monitored entries and active threat triggers."
            icon={<ShieldCheck className="h-4 w-4 text-cyan-400" />}
            className="md:col-span-2 border-cyan-500/10 bg-zinc-950/50 hover:border-cyan-500/30 transition-all corner-decor text-left"
          >
            <div className="mt-3">
              {flattenedWatchlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center space-y-3">
                  <ShieldCheck className="h-6 w-6 text-zinc-600 stroke-[1.5]" />
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold text-zinc-350 font-orbitron uppercase tracking-wider">
                      Watchlist Buffer Empty
                    </p>
                    <p className="text-[9px] text-zinc-550 font-mono">
                      No active protocol threat telemetry feeds currently monitored.
                    </p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className="border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400 text-[9px] uppercase tracking-wider font-orbitron font-bold h-7 rounded-xs px-4"
                  >
                    <Link href="/research">Browse Research</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {recentWatchlist.map(({ slug, chains }) => (
                    <div
                      key={slug}
                      className="group/item rounded-xs border border-zinc-850 bg-zinc-950/80 px-3.5 py-3 hover:border-cyan-500/30 hover:shadow-[0_0_10px_rgba(6,182,212,0.05)] transition-all text-left"
                    >
                      <p className="font-mono text-xs font-bold capitalize text-white group-hover/item:text-cyan-400 transition-colors">
                        {slug}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {chains.slice(0, 1).map((chainType) => (
                          <span
                            key={`${slug}:${chainType}`}
                            className={`rounded-xs px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider border ${
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
            description="Active threat scanning metrics."
            icon={<Activity className="h-4 w-4 text-cyan-400" />}
            className="md:col-span-1 border-cyan-500/10 bg-zinc-950/50 hover:border-cyan-500/30 transition-all corner-decor text-left"
          >
            <div className="mt-4 flex flex-col justify-between h-[5.5rem]">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-orbitron font-black text-white">{flattenedWatchlist.length}</span>
                <span className="text-[8px] text-zinc-500 font-mono font-black uppercase tracking-widest">
                  Active Channels
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-semibold tracking-wider uppercase">System state</span>
                <Badge
                  variant="outline"
                  className="gap-1 bg-cyan-950/20 text-cyan-400 border-cyan-500/20 font-orbitron font-bold text-[8px] uppercase tracking-widest px-2 py-0.5"
                >
                  <TrendingUp className="h-3 w-3 animate-pulse" />
                  Live Feed
                </Badge>
              </div>
            </div>
          </BentoGridItem>
        </BentoGrid>
      </section>
    </div>
  )
}
