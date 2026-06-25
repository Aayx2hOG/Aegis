'use client'

import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { Meteors } from '@/components/ui/meteors'
import { RiskDial } from '@/components/war-room/war-room-visuals'
import { MetricCard } from '@/components/war-room/metric-card'
import type { ComparativeSimulationResult } from '@/lib/types'
import type { ChainType } from '@/lib/chain/types'
import { formatCurrency, getRiskBand } from '@/lib/war-room/format'

type LocalMitigationAction = {
  action: 'move' | 'liquidate' | 'increase' | 'arbitrage' | 'hedge'
  fromChain?: ChainType | string
  toChain?: ChainType | string
  assetSymbol: string
  protocol?: string
  amount: number
}

type WarRoomSimulationResultsProps = {
  result: ComparativeSimulationResult
  onApplyMitigation: (action: LocalMitigationAction) => void
}

export function WarRoomSimulationResults({ result, onApplyMitigation }: WarRoomSimulationResultsProps) {
  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="rounded-xl border border-cyan-500/15 bg-cyan-950/5 p-4 shadow-sm text-xs font-mono">
        <p className="text-zinc-350 leading-relaxed">
          &gt; Simulation finished with portfolio vulnerability score at{' '}
          <span className="font-bold text-white">{result.aggregateRisk}/100</span> (
          {getRiskBand(result.aggregateRisk).label}). Max estimated asset drawdown is{' '}
          <span className="font-semibold text-rose-300">-{result.portfolioImpact.maxDrawdown.toFixed(1)}%</span>. Most
          vulnerable endpoint detected is{' '}
          <span className="font-semibold text-white uppercase">{result.mostVulnerableChain}</span>, while{' '}
          <span className="font-semibold text-white uppercase">{result.leastVulnerableChain}</span> registers as target
          safehaven.
        </p>
      </div>

      {result.aiBriefing && (
        <SpotlightCard
          spotlightColor="rgba(6, 182, 212, 0.05)"
          borderColor="rgba(6, 182, 212, 0.2)"
          className="relative overflow-hidden border border-cyan-500/20 bg-zinc-950/90 p-5 rounded-xs font-mono text-xs text-left"
        >
          <Meteors number={4} />
          <div className="relative z-10 flex items-center gap-2 border-b border-cyan-500/10 pb-2 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 motion-safe:animate-ping" />
            <span className="font-bold text-cyan-400 uppercase tracking-widest text-[10px]">
              AEGIS DYNAMIC THREAT BRIEFING
            </span>
          </div>
          <div className="text-zinc-350 leading-relaxed space-y-4 whitespace-pre-line prose prose-invert max-w-none">
            {result.aiBriefing}
          </div>
        </SpotlightCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
        <div className="md:col-span-2">
          <RiskDial score={result.aggregateRisk} maxDrawdown={result.portfolioImpact.maxDrawdown} />
        </div>

        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            label="Monitored Asset Total"
            value={formatCurrency(result.portfolioImpact.totalUsdValue)}
            helper="Base value of all configured multichain positions."
          />
          <MetricCard
            label="Projected Residual Value"
            value={formatCurrency(result.portfolioImpact.projectedValue)}
            helper="Modeled portfolio value remaining after threat shock event."
          />
          <MetricCard
            label="Value At Risk (VaR)"
            value={formatCurrency(result.portfolioImpact.totalUsdValue - result.portfolioImpact.projectedValue)}
            helper="Estimated monetary loss under stress threshold."
            accent="text-rose-400"
          />
          <MetricCard
            label="Vulnerability Ratio"
            value={`-${result.portfolioImpact.maxDrawdown.toFixed(1)}%`}
            helper="Maximum modelled drawdown decline percentage."
            accent="text-rose-400"
          />
        </div>
      </div>

      <div className="rounded-xl bg-zinc-950/50 border border-cyan-500/10 p-6 space-y-6 corner-decor">
        <div className="border-b border-cyan-500/10 pb-4 text-left">
          <h2 className="text-lg font-orbitron font-black text-white">Inter-Chain Security Heatmap</h2>
          <p className="text-xs text-zinc-500 mt-1 font-mono">
            &gt; Threat level breakdown per deployment chain based on shock parameters.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {result.chainRisks.map((chainRisk) => {
            const riskBand = getRiskBand(chainRisk.aggregateRisk)

            return (
              <div key={chainRisk.chain} className="rounded-xs border border-zinc-900 bg-zinc-950/40 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <h3 className="font-orbitron font-bold text-xs uppercase tracking-wide text-zinc-250">
                    {chainRisk.chain}
                  </h3>
                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-xs bg-zinc-950 ${riskBand.color}`}
                  >
                    RISK: {chainRisk.aggregateRisk.toFixed(0)} ({riskBand.label})
                  </span>
                </div>
                <div className="space-y-2.5 font-mono text-[10px]">
                  {[
                    ['Market Shock Impact', chainRisk.marketRisk],
                    ['Liquidity Compression', chainRisk.liquidityRisk],
                    ['Concentration Shift', chainRisk.concentrationRisk],
                    ['Smart Contract Audit Factor', chainRisk.smartContractRisk],
                  ].map(([label, value]) => (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between text-zinc-500">
                        <span>{label}</span>
                        <span className="font-semibold text-zinc-200">{value}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                        <div className="h-full bg-zinc-500" style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                  {chainRisk.bridgeRisk !== undefined && chainRisk.bridgeRisk > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-rose-400">
                        <span>Bridge Outage Exposure</span>
                        <span className="font-semibold text-rose-300">{chainRisk.bridgeRisk}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                        <div
                          className="h-full bg-rose-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                          style={{ width: `${chainRisk.bridgeRisk}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-xl bg-zinc-950/50 border border-cyan-500/10 p-5 space-y-4 corner-decor">
          <h3 className="font-orbitron font-black text-sm text-white border-b border-cyan-500/10 pb-3 uppercase">
            Hedge & Rebalancing Recommendations
          </h3>
          {result.rebalancingRecommendations.length === 0 ? (
            <div className="text-center py-6 text-zinc-550 font-mono text-xs">
              &gt; Rebalancing checks complete. Risk indexes are within tolerance limits.
            </div>
          ) : (
            <div className="space-y-3 font-mono text-xs">
              {result.rebalancingRecommendations.map((recommendation, index) => (
                <div key={index} className="rounded-xs border border-zinc-900 bg-zinc-950 p-4 space-y-2 text-left">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-xs px-2.5 py-0.5 text-[8px] font-mono font-bold uppercase border ${
                          recommendation.action === 'move'
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25 shadow-[0_0_8px_rgba(6,182,212,0.1)]'
                            : recommendation.action === 'liquidate'
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/25 shadow-[0_0_8px_rgba(239,68,68,0.1)]'
                              : 'bg-zinc-800 text-zinc-350 border-zinc-700'
                        }`}
                      >
                        INSTRUCTION: {recommendation.action}
                      </span>
                      <p className="font-bold text-white capitalize">
                        {recommendation.assetSymbol} - {recommendation.protocol}
                      </p>
                    </div>
                    <span className="text-[9px] text-zinc-500 font-bold">
                      Risk Delta:{' '}
                      <span className="text-emerald-400 font-black">-{recommendation.expectedRiskReduction} pts</span>
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{recommendation.rationale}</p>
                  <div className="flex flex-wrap gap-4 text-[9px] text-zinc-550 pt-2 border-t border-zinc-900/60 font-semibold uppercase tracking-wider">
                    {recommendation.fromChain && (
                      <span>
                        From Source: <span className="text-zinc-300 font-bold">{recommendation.fromChain}</span>
                      </span>
                    )}
                    {recommendation.toChain && (
                      <span>
                        To Target: <span className="text-zinc-300 font-bold">{recommendation.toChain}</span>
                      </span>
                    )}
                    <span>
                      Volume:{' '}
                      <span className="text-zinc-300 font-bold">
                        {recommendation.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-zinc-900/40">
                    <Button
                      onClick={() =>
                        onApplyMitigation({
                          action: recommendation.action,
                          fromChain: recommendation.fromChain,
                          toChain: recommendation.toChain,
                          assetSymbol: recommendation.assetSymbol,
                          protocol: recommendation.protocol,
                          amount: recommendation.amount,
                        })
                      }
                      className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-bold uppercase tracking-wider text-[10px] h-7 px-3.5 rounded-xs cursor-pointer shadow-[0_0_6px_rgba(6,182,212,0.15)]"
                    >
                      Apply{' '}
                      {recommendation.action === 'move'
                        ? 'Move Model'
                        : recommendation.action === 'liquidate'
                          ? 'Exit Model'
                          : 'Risk Adjustment'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 rounded-xl bg-zinc-950/50 border border-cyan-500/10 p-5 space-y-4 corner-decor">
          <h3 className="font-orbitron font-black text-sm text-white border-b border-cyan-500/10 pb-3 uppercase">
            Cross-Chain Arbitrage Alerts
          </h3>
          {result.crossChainArbitrageOpportunities.length === 0 ? (
            <div className="text-center py-6 text-zinc-550 font-mono text-xs">
              &gt; Cross-chain price feeds balanced. Spot spreads register null.
            </div>
          ) : (
            <div className="space-y-3 font-mono text-xs">
              {result.crossChainArbitrageOpportunities.map((opportunity, index) => (
                <div key={index} className="rounded-xs border border-zinc-900 bg-zinc-950 p-4 space-y-2 text-left">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                    <p className="font-bold text-white">{opportunity.assetSymbol} Spreads</p>
                    <span
                      className={`rounded-xs px-2 py-0.5 text-[8px] font-mono font-bold uppercase border ${
                        opportunity.riskLevel === 'high'
                          ? 'bg-rose-500/10 text-rose-300 border-rose-500/25'
                          : opportunity.riskLevel === 'medium'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                      }`}
                    >
                      RISK: {opportunity.riskLevel}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{opportunity.rationale}</p>
                  <div className="flex items-center justify-between text-[9px] pt-2 border-t border-zinc-900/60 font-semibold uppercase tracking-wider text-zinc-550">
                    <span>
                      Path:{' '}
                      <span className="text-zinc-300">
                        {opportunity.fromChain} -&gt; {opportunity.toChain}
                      </span>
                    </span>
                    <span>
                      Profit margin: <span className="text-emerald-400 font-black">+{opportunity.profitMargin}%</span>
                    </span>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-zinc-900/40">
                    <Button
                      onClick={() =>
                        onApplyMitigation({
                          action: 'arbitrage',
                          fromChain: opportunity.fromChain,
                          toChain: opportunity.toChain,
                          assetSymbol: opportunity.assetSymbol,
                          amount: 5000,
                        })
                      }
                      className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-bold uppercase tracking-wider text-[10px] h-7 px-3.5 rounded-xs cursor-pointer shadow-[0_0_6px_rgba(6,182,212,0.15)]"
                    >
                      Note Opportunity
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
