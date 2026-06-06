'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpenText, Sparkles, Layers3, Network, Link2, Activity, Cpu, ShieldCheck } from 'lucide-react'

import { useMultiChain } from '@/components/chain/chain-provider'
import { useMultiChainWatchlist } from '@/hooks/use-multichain-watchlist'
import { ChainType } from '@/lib/chain/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const CHAIN_TONES: Record<string, string> = {
  solana: 'bg-cyan-500/10 text-cyan-200 border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]',
  ethereum: 'bg-blue-500/10 text-blue-200 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]',
  arbitrum: 'bg-sky-500/10 text-sky-200 border-sky-500/20 shadow-[0_0_10px_rgba(14,165,233,0.1)]',
  optimism: 'bg-rose-500/10 text-rose-200 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]',
  polygon: 'bg-violet-500/10 text-violet-200 border-violet-500/20 shadow-[0_0_10px_rgba(139,92,246,0.1)]',
  base: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
  cosmos: 'bg-amber-500/10 text-amber-200 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
}

// Reusable Spotlight Card (Aceternity UI Style)
export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(34, 211, 238, 0.12)',
  borderColor = 'rgba(34, 211, 238, 0.45)',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { spotlightColor?: string; borderColor?: string }) {
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden rounded-3xl border border-white/5 bg-zinc-950/40 p-6 shadow-2xl transition-all duration-500 hover:border-white/10 ${className}`}
      {...props}
    >
      {/* Spotlight Backing */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(350px circle at ${coords.x}px ${coords.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />
      {/* Glowing Border Overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-3xl transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          border: '1px solid transparent',
          backgroundImage: `linear-gradient(to bottom, transparent, transparent), radial-gradient(140px circle at ${coords.x}px ${coords.y}px, ${borderColor}, transparent 80%)`,
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
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
    <div className="mx-auto max-w-6xl space-y-8 py-6 md:space-y-12">
      {/* Interactive Hero Spotlight Area */}
      <SpotlightCard
        spotlightColor="rgba(34, 211, 238, 0.15)"
        className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-zinc-950/20 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.4)] md:p-10"
      >
        {/* Animated Cyber Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none z-0" />
        
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-center">
          <div className="space-y-6">
            <Badge variant="accent" className="w-fit gap-2 px-3 py-1.5 uppercase tracking-[0.22em] bg-cyan-500/10 text-cyan-300 border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <Layers3 className="h-3.5 w-3.5 animate-pulse" />
              Aegis Intelligence Terminal
            </Badge>

            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl leading-[1.08]">
                Multichain research, organized for <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 font-black">fast decisions</span>.
              </h1>
              <p className="max-w-xl text-xs sm:text-sm leading-relaxed text-zinc-400 font-medium">
                Keep the active chain, watchlist, and analysis entry points in one clean workspace. Start with the
                current chain or move directly into research when a protocol needs attention.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <Button asChild className="relative overflow-hidden bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-bold transition-all hover:scale-[1.03] hover:shadow-[0_0_25px_rgba(34,211,238,0.45)] px-6 h-12 rounded-xl cursor-pointer">
                <Link href="/research">Launch Research</Link>
              </Button>
              <Button asChild className="bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border border-cyan-400/20 text-cyan-300 hover:from-cyan-500/25 hover:to-blue-500/25 hover:text-cyan-100 hover:border-cyan-400/40 font-bold transition-all hover:scale-[1.03] px-6 h-12 rounded-xl cursor-pointer">
                <Link href="/research/compare">⚔️ Compare Protocols</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white transition-all hover:scale-[1.03] px-6 h-12 rounded-xl cursor-pointer"
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
      </SpotlightCard>

      {/* Overview and Watchlist Panels */}
      <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <SpotlightCard spotlightColor="rgba(59, 130, 246, 0.08)" borderColor="rgba(59, 130, 246, 0.3)">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20">
                <Cpu className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Workspace Overview</h3>
                <p className="text-xs text-zinc-500">Summary of active telemetry feeds and data sources.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 mt-4">
              <InfoRow label="Chain coverage" value={`${activeChainConnections.length || 1} linked`} />
              <InfoRow label="Watchlist footprint" value={`${flattenedWatchlist.length} protocols`} />
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard spotlightColor="rgba(16, 185, 129, 0.08)" borderColor="rgba(16, 185, 129, 0.3)">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Recent Watchlist</h3>
                  <p className="text-xs text-zinc-500">Top entries from active chain sets.</p>
                </div>
              </div>
              <Badge variant="accent" className="gap-2 bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Live
              </Badge>
            </div>
            
            <div className="mt-4">
              {flattenedWatchlist.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/5 bg-zinc-950/20 p-6 text-center text-sm leading-6 text-zinc-400">
                  No protocols are in the watchlist yet. Open Research and add one from a chain view to start building
                  the set.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentWatchlist.map(({ slug, chains }) => (
                    <div
                      key={slug}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-zinc-950/35 px-4 py-3 hover:bg-zinc-950/60 transition-all hover:translate-x-1"
                    >
                      <div>
                        <p className="font-semibold capitalize text-white group-hover:text-cyan-200 transition-colors">{slug}</p>
                        <p className="text-xs text-zinc-500">
                          {chains.length} chain{chains.length === 1 ? '' : 's'} tracked
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {chains.slice(0, 2).map((chainType) => (
                          <span
                            key={`${slug}:${chainType}`}
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide border ${CHAIN_TONES[chainType] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}
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
          </div>
        </SpotlightCard>
      </section>
    </div>
  )
}

function MetricPill({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <SpotlightCard
      spotlightColor="rgba(34, 211, 238, 0.08)"
      borderColor="rgba(34, 211, 238, 0.35)"
      className="group flex flex-col justify-between overflow-hidden p-5 transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 transition-colors group-hover:text-zinc-400">
          {label}
        </p>
        {icon && <span className="text-zinc-500 transition-colors duration-300 group-hover:text-cyan-400 group-hover:scale-110">{icon}</span>}
      </div>
      <p className="mt-4 text-xl font-black leading-snug text-white sm:text-2xl md:text-3xl tracking-tight transition-all duration-300 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-cyan-200">
        {value}
      </p>
    </SpotlightCard>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <SpotlightCard
      spotlightColor="rgba(59, 130, 246, 0.06)"
      borderColor="rgba(59, 130, 246, 0.25)"
      className="p-4"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-zinc-100">{value}</p>
    </SpotlightCard>
  )
}
