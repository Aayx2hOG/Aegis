'use client'

import { Badge } from '@/components/ui/badge'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { BeginnerOnboardingCard } from '@/components/ui/defi-helper'
import { UI_DISCLAIMER } from '@/lib/config/war-room-config'
import { MULTICHAIN_SCENARIO_INFO } from '@/lib/config/war-room-multichain'
import type { ChainPortfolioPosition } from '@/lib/types'
import { formatCurrency } from '@/lib/war-room/format'

type PortfolioInsights = {
  totalValue: number
  chainCount: number
  protocolCount: number
  topChain: string | null
  topChainValue: number
  largestPosition?: ChainPortfolioPosition
  concentrationPct: number
  scenarioSeverity: number
}

type WarRoomOverviewProps = {
  simpleMode: boolean
  connectedWalletAddress?: string | null
  portfolioInputSource: string
  portfolioInsights: PortfolioInsights
  useCustomScenario: boolean
  selectedScenarioIndex: number
}

export function WarRoomOverview({
  simpleMode,
  connectedWalletAddress,
  portfolioInputSource,
  portfolioInsights,
  useCustomScenario,
  selectedScenarioIndex,
}: WarRoomOverviewProps) {
  return (
    <>
      {simpleMode && (
        <BeginnerOnboardingCard
          title="Optional simulation quick start"
          steps={[
            'Start with the demo portfolio or import your watchlist. This is only a simulation, not a real trade.',
            'Pick a preset scenario to ask: what happens if prices fall, liquidity dries up, or bridges stop working?',
            'Run the simulation and read the risk score. Higher scores mean the portfolio is more fragile.',
            'Use the recommended actions as what-if changes, then run the simulation again to compare before and after.',
            'Use Custom Scenario only when you want to manually adjust the stress assumptions.',
          ]}
        />
      )}

      <header className="space-y-4 text-left">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Badge
            variant="accent"
            className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-orbitron font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)] bg-cyan-950/20 text-cyan-400 border-cyan-500/20"
          >
            Optional portfolio stress simulator
          </Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-orbitron font-black tracking-wide text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.08)] uppercase">
            See how your portfolio behaves under stress
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-3xl leading-relaxed">
            Build a simple portfolio, choose a market stress scenario, and estimate where losses or concentration risks
            could appear before you make real decisions.
          </p>
          <div className="rounded-xs bg-amber-500/5 border border-amber-500/25 p-3 text-[11px] font-mono text-amber-200/90 mt-2">
            {UI_DISCLAIMER}
          </div>
        </div>
      </header>

      {connectedWalletAddress && portfolioInputSource !== 'manual' && (
        <div className="rounded-xs border border-amber-500/25 bg-amber-500/5 px-3.5 py-3 text-[11px] font-mono leading-relaxed text-amber-200/90">
          Connected wallet: {connectedWalletAddress}. Aegis does not infer your holdings from wallet connection alone.
          Add real balances manually, or treat imported watchlist/protocol rows as scenario templates.
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-cyan-500/10 bg-zinc-950/50 p-4 shadow-xl">
          <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">Total exposure</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(portfolioInsights.totalValue)}</p>
          <p className="mt-1 text-[10px] text-zinc-500">
            {portfolioInsights.protocolCount} protocols across {portfolioInsights.chainCount} chains
          </p>
        </div>
        <div className="rounded-xl border border-cyan-500/10 bg-zinc-950/50 p-4 shadow-xl">
          <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">Dominant chain</p>
          <p className="mt-2 text-2xl font-semibold capitalize text-white">{portfolioInsights.topChain ?? 'N/A'}</p>
          <p className="mt-1 text-[10px] text-zinc-500">{formatCurrency(portfolioInsights.topChainValue)} at risk</p>
        </div>
        <div className="rounded-xl border border-cyan-500/10 bg-zinc-950/50 p-4 shadow-xl">
          <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">Concentration</p>
          <p
            className={`mt-2 text-2xl font-semibold ${
              portfolioInsights.concentrationPct >= 45 ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {portfolioInsights.concentrationPct.toFixed(1)}%
          </p>
          <p className="mt-1 truncate text-[10px] text-zinc-500">
            Largest: {portfolioInsights.largestPosition?.symbol ?? 'N/A'} on{' '}
            {portfolioInsights.largestPosition?.chain ?? 'N/A'}
          </p>
        </div>
        <div className="rounded-xl border border-cyan-500/10 bg-zinc-950/50 p-4 shadow-xl">
          <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">Scenario severity</p>
          <p
            className={`mt-2 text-2xl font-semibold ${
              portfolioInsights.scenarioSeverity >= 50 ? 'text-rose-300' : 'text-cyan-300'
            }`}
          >
            {portfolioInsights.scenarioSeverity}/100
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            {useCustomScenario ? 'Custom parameters' : MULTICHAIN_SCENARIO_INFO[selectedScenarioIndex].title}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[10px] font-orbitron font-bold uppercase tracking-widest text-zinc-500">
          Simulation workflow
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [
              'Step 01',
              'Set holdings',
              'Add tokens or protocols you want to test. You can use the demo portfolio if you are exploring.',
            ],
            ['Step 02', 'Pick a stress case', 'Choose a preset like a market crash, bridge outage, or network freeze.'],
            ['Step 03', 'Compare outcomes', 'Review the risk score, try suggested changes, and rerun the simulation.'],
          ].map(([step, title, body]) => (
            <SpotlightCard
              key={step}
              spotlightColor="rgba(6, 182, 212, 0.03)"
              borderColor="rgba(6, 182, 212, 0.15)"
              className="border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs corner-decor"
            >
              <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-550">{step}</p>
              <p className="mt-2 text-sm font-orbitron font-bold text-white uppercase tracking-wider">{title}</p>
              <p className="mt-1 text-xs text-zinc-450 leading-relaxed font-medium">{body}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>
    </>
  )
}
