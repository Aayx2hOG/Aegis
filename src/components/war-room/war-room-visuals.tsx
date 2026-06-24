'use client'

import { ChainType } from '@/lib/chain/types'
import type { ChainScenarioConfig } from '@/lib/types'
import { Sparkles } from '@/components/ui/sparkles'

export function RiskDial({ score, maxDrawdown }: { score: number; maxDrawdown: number }) {
  const radius = 50
  const circumference = Math.PI * radius // 157.08
  const strokeDashoffset = circumference - (Math.min(score, 100) / 100) * circumference

  const getDialColor = (val: number) => {
    if (val < 34) return 'stroke-emerald-500'
    if (val < 67) return 'stroke-amber-500'
    return 'stroke-rose-500'
  }

  const getDialGlow = (val: number) => {
    if (val < 34) return 'shadow-[0_0_15px_rgba(16,185,129,0.15)] text-emerald-400'
    if (val < 67) return 'shadow-[0_0_15px_rgba(245,158,11,0.15)] text-amber-400'
    return 'shadow-[0_0_15px_rgba(239,68,68,0.2)] text-rose-400 animate-pulse'
  }

  return (
    <div
      className={`flex flex-col items-center justify-center p-5 border border-cyan-500/10 rounded-lg bg-zinc-950/80 shadow-[inset_0_0_15px_rgba(0,0,0,0.85)] max-w-xs mx-auto ${getDialGlow(score)}`}
    >
      <p className="text-[9px] font-orbitron font-bold uppercase tracking-widest text-zinc-500 mb-2">
        RISK EVALUATION DIAL
      </p>
      <div className="relative w-44 h-24 flex items-center justify-center overflow-hidden">
        <svg className="w-40 h-40 transform rotate-180 translate-y-8" viewBox="0 0 120 120">
          {/* Background semicircular track */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeLinecap="round"
          />
          {/* Active semicircular track */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            className={`${getDialColor(score)} transition-all duration-1000`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {/* Core Value */}
        <div className="absolute bottom-2 flex flex-col items-center text-center">
          <span className="text-3xl font-orbitron font-black text-white leading-none">{score.toFixed(0)}</span>
          <span className="text-[8px] font-mono text-zinc-550 font-bold uppercase tracking-wider mt-1.5">
            AGGREGATE RISK
          </span>
        </div>
      </div>

      {/* Drawdown Indicator Bar */}
      <div className="w-full mt-3 space-y-1 text-left font-mono">
        <div className="flex justify-between items-center text-[8px] text-zinc-500 font-bold">
          <span>PROJECTED DRAWDOWN</span>
          <span className="text-rose-400 font-black">-{maxDrawdown.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
          <div
            className="h-full bg-rose-500 shadow-[0_0_8px_#ef4444]"
            style={{ width: `${Math.min(maxDrawdown, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function BridgeThreatSimulator({ scenario }: { scenario: ChainScenarioConfig }) {
  const isLiquidityCrisis = scenario.liquidityDropPct >= 50 && scenario.marketShockPct >= 30
  const isBridgeOutage = (scenario.bridgeOutageDurationMinutes ?? 0) >= 60
  const isSequencerDowntime = scenario.oracleDelayMinutes >= 15 || (scenario.bridgeOutageDurationMinutes ?? 0) >= 360

  // Status strings
  const getStatusText = () => {
    if (isLiquidityCrisis) return 'ALERT: SYSTEMIC LIQUIDITY DRAIN'
    if (isBridgeOutage) return 'CRITICAL: CROSS-CHAIN BRIDGE EXPLOIT'
    if (isSequencerDowntime) return 'WARNING: EVM L2 SEQUENCER DOWNTIME'
    return 'ONLINE: INTER-CHAIN SECURITY MATRICES STABLE'
  }

  const getStatusColor = () => {
    if (isLiquidityCrisis) return 'text-amber-400'
    if (isBridgeOutage) return 'text-rose-500'
    if (isSequencerDowntime) return 'text-rose-400 animate-pulse'
    return 'text-cyan-400'
  }

  const isChainAffected = (nodeName: string) => {
    if (!scenario.chainsAffected) return false
    if (nodeName === 'Solana') return scenario.chainsAffected.includes(ChainType.Solana)
    if (nodeName === 'Ethereum') return scenario.chainsAffected.includes(ChainType.Ethereum)
    if (nodeName === 'Cosmos') return scenario.chainsAffected.includes(ChainType.Cosmos)
    if (nodeName === 'L2') {
      return (
        scenario.chainsAffected.includes(ChainType.Arbitrum) ||
        scenario.chainsAffected.includes(ChainType.Base) ||
        scenario.chainsAffected.includes(ChainType.Optimism) ||
        scenario.chainsAffected.includes(ChainType.Polygon)
      )
    }
    return false
  }

  const getNodeColor = (name: string) => {
    if (isLiquidityCrisis && isChainAffected(name)) return 'fill-amber-500 stroke-amber-400'
    if (name === 'L2' && isSequencerDowntime && isChainAffected('L2'))
      return 'fill-rose-600 stroke-rose-500 shadow-rose-500'
    if (isBridgeOutage && isChainAffected(name)) return 'fill-rose-500 stroke-rose-400'
    return 'fill-cyan-500 stroke-cyan-400'
  }

  const getLinkColorClass = (from: string, to: string) => {
    const fromAffected = isChainAffected(from)
    const toAffected = isChainAffected(to)

    if (isLiquidityCrisis) {
      return fromAffected || toAffected
        ? 'stroke-amber-600/80 sweep-link-alert'
        : 'stroke-cyan-600/40 sweep-link-active'
    }
    if (isBridgeOutage) {
      if (fromAffected && toAffected) {
        return 'stroke-rose-600/80 stroke-[2px]'
      }
      if (fromAffected || toAffected) {
        return 'stroke-rose-500/60 stroke-[1.5px]'
      }
      return 'stroke-cyan-600/40 sweep-link-active'
    }
    if (isSequencerDowntime) {
      if (from === 'L2' || to === 'L2') {
        return 'stroke-rose-500/80 stroke-[2.5px] stroke-dasharray-none animate-pulse'
      }
      return 'stroke-cyan-500/80 sweep-link-active'
    }
    return 'stroke-cyan-500/80 sweep-link-active'
  }

  return (
    <div className="rounded-xs border border-cyan-500/10 bg-zinc-950/80 p-4 font-mono text-[9px] select-none text-left space-y-3 relative overflow-hidden">
      <style>{`
        @keyframes sweep {
          to {
            stroke-dashoffset: -20;
          }
        }
        .sweep-link-active {
          stroke-dasharray: 5, 5;
          animation: sweep 1.5s linear infinite;
        }
        .sweep-link-alert {
          stroke-dasharray: 3, 3;
          animation: sweep 0.8s linear infinite;
        }
      `}</style>

      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-1.5 mb-1 select-none">
        <span className="font-bold flex items-center gap-1 uppercase tracking-wider text-zinc-300">
          <span
            className={`h-1.5 w-1.5 rounded-full ${isLiquidityCrisis || isBridgeOutage || isSequencerDowntime ? 'bg-rose-500 animate-ping' : 'bg-cyan-400 animate-pulse'}`}
          />
          CROSS-CHAIN LINK SIMULATOR
        </span>
        <span className={`font-bold ${getStatusColor()}`}>{getStatusText()}</span>
      </div>

      <div className="relative w-full h-[140px] bg-zinc-950 rounded-xs border border-zinc-900 flex items-center justify-center overflow-hidden">
        <Sparkles
          id="bridge-sparkles"
          particleDensity={25}
          minSize={0.4}
          maxSize={1.0}
          particleColor="#06b6d4"
          className="opacity-30"
        />
        <svg viewBox="0 0 400 140" className="w-full h-full relative z-10">
          {/* Bridge paths */}
          {/* Solana <-> Ethereum */}
          <line
            x1="50"
            y1="70"
            x2="200"
            y2="25"
            className={getLinkColorClass('Solana', 'Ethereum')}
            strokeWidth="1.5"
          />
          {/* Solana <-> EVM L2s */}
          <line x1="50" y1="70" x2="200" y2="115" className={getLinkColorClass('Solana', 'L2')} strokeWidth="1.5" />
          {/* Ethereum <-> EVM L2s */}
          <line x1="200" y1="25" x2="200" y2="115" className={getLinkColorClass('Ethereum', 'L2')} strokeWidth="1.5" />
          {/* EVM L2s <-> Cosmos */}
          <line x1="200" y1="115" x2="350" y2="70" className={getLinkColorClass('L2', 'Cosmos')} strokeWidth="1.5" />
          {/* Ethereum <-> Cosmos */}
          <line
            x1="200"
            y1="25"
            x2="350"
            y2="70"
            className={getLinkColorClass('Ethereum', 'Cosmos')}
            strokeWidth="1.5"
          />

          {/* Node Rings / Pulse animations */}
          {isLiquidityCrisis && (
            <>
              {isChainAffected('Solana') && (
                <circle
                  cx="50"
                  cy="70"
                  r="14"
                  fill="none"
                  className="stroke-amber-500/40 animate-ping"
                  strokeWidth="1.5"
                />
              )}
              {isChainAffected('Cosmos') && (
                <circle
                  cx="350"
                  cy="70"
                  r="14"
                  fill="none"
                  className="stroke-amber-500/40 animate-ping"
                  strokeWidth="1.5"
                />
              )}
            </>
          )}
          {isBridgeOutage && (
            <>
              {isChainAffected('Solana') && (
                <circle
                  cx="50"
                  cy="70"
                  r="14"
                  fill="none"
                  className="stroke-rose-500/40 animate-ping"
                  strokeWidth="1.5"
                />
              )}
              {isChainAffected('Cosmos') && (
                <circle
                  cx="350"
                  cy="70"
                  r="14"
                  fill="none"
                  className="stroke-rose-500/40 animate-ping"
                  strokeWidth="1.5"
                />
              )}
            </>
          )}
          {isSequencerDowntime && isChainAffected('L2') && (
            <circle cx="200" cy="115" r="14" fill="none" className="stroke-rose-500 animate-ping" strokeWidth="1.5" />
          )}

          {/* Node Dots */}
          <circle cx="50" cy="70" r="7" className={`${getNodeColor('Solana')} transition-colors duration-300`} />
          <circle cx="200" cy="25" r="7" className={`${getNodeColor('Ethereum')} transition-colors duration-300`} />
          <circle cx="200" cy="115" r="7" className={`${getNodeColor('L2')} transition-colors duration-300`} />
          <circle cx="350" cy="70" r="7" className={`${getNodeColor('Cosmos')} transition-colors duration-300`} />

          {/* Node Text labels */}
          <text x="50" y="87" fill="#a1a1aa" fontSize="7.5" fontWeight="bold" textAnchor="middle" className="font-mono">
            SOLANA
          </text>
          <text
            x="200"
            y="14"
            fill="#a1a1aa"
            fontSize="7.5"
            fontWeight="bold"
            textAnchor="middle"
            className="font-mono"
          >
            ETHEREUM
          </text>
          <text
            x="200"
            y="131"
            fill="#a1a1aa"
            fontSize="7.5"
            fontWeight="bold"
            textAnchor="middle"
            className="font-mono"
          >
            EVM L2
          </text>
          <text
            x="350"
            y="87"
            fill="#a1a1aa"
            fontSize="7.5"
            fontWeight="bold"
            textAnchor="middle"
            className="font-mono"
          >
            COSMOS
          </text>

          {/* Text alert labels inside map */}
          {isBridgeOutage && (
            <>
              {isChainAffected('Solana') && (
                <>
                  <rect x="22" y="38" width="56" height="11" rx="2" fill="#09090b" stroke="#ef4444" strokeWidth="0.8" />
                  <text x="50" y="46" fill="#ef4444" fontSize="5.5" fontWeight="bold" textAnchor="middle">
                    BRIDGE DROP
                  </text>
                </>
              )}

              {isChainAffected('Cosmos') && (
                <>
                  <rect
                    x="322"
                    y="38"
                    width="56"
                    height="11"
                    rx="2"
                    fill="#09090b"
                    stroke="#ef4444"
                    strokeWidth="0.8"
                  />
                  <text x="350" y="46" fill="#ef4444" fontSize="5.5" fontWeight="bold" textAnchor="middle">
                    BRIDGE DROP
                  </text>
                </>
              )}
            </>
          )}

          {isSequencerDowntime && isChainAffected('L2') && (
            <>
              <rect x="160" y="93" width="80" height="11" rx="2" fill="#09090b" stroke="#ef4444" strokeWidth="0.8" />
              <text x="200" y="101" fill="#ef4444" fontSize="5.5" fontWeight="bold" textAnchor="middle">
                SEQ ERROR (503)
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  )
}
