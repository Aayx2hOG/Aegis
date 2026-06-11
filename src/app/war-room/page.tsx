'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { ChainType } from '@/lib/chain/types'
import { UI_DISCLAIMER } from '@/lib/config/war-room-config'
import type {
  ChainPortfolioPosition,
  MultiChainPortfolio,
  ChainScenarioConfig,
  ComparativeSimulationResult,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { TerminalExecutionModal, ExecutionAction } from '@/components/ui/terminal-execution-modal'
import { resolveProtocolFromList } from '@/lib/protocol/slug-resolver'
import { useWatchlist } from '@/lib/hooks/use-watchlist'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const DEFAULT_MULTICHAIN_POSITIONS: ChainPortfolioPosition[] = [
  {
    chain: ChainType.Solana,
    kind: 'token',
    symbol: 'SOL',
    protocol: 'wallet',
    balance: 1,
    usdValue: 150,
    volatility: 72,
    liquidityScore: 94,
  },
  {
    chain: ChainType.Solana,
    kind: 'yield',
    symbol: 'JITOSOL',
    protocol: 'jito',
    balance: 1,
    usdValue: 165,
    volatility: 58,
    liquidityScore: 79,
  },
  {
    chain: ChainType.Ethereum,
    kind: 'token',
    symbol: 'ETH',
    protocol: 'wallet',
    balance: 1,
    usdValue: 3500,
    volatility: 64,
    liquidityScore: 95,
  },
  {
    chain: ChainType.Ethereum,
    kind: 'yield',
    symbol: 'rETH',
    protocol: 'rocketpool',
    balance: 1,
    usdValue: 3700,
    volatility: 55,
    liquidityScore: 82,
  },
  {
    chain: ChainType.Arbitrum,
    kind: 'lp',
    symbol: 'ETH-USDC LP',
    protocol: 'uniswap',
    balance: 1,
    usdValue: 2000,
    volatility: 45,
    liquidityScore: 75,
  },
  {
    chain: ChainType.Base,
    kind: 'lending',
    symbol: 'USDC',
    protocol: 'aerodrome',
    balance: 1000,
    usdValue: 1000,
    volatility: 5,
    liquidityScore: 90,
    collateralFactor: 0.85,
  },
  {
    chain: ChainType.Optimism,
    kind: 'token',
    symbol: 'OP',
    protocol: 'wallet',
    balance: 100,
    usdValue: 250,
    volatility: 85,
    liquidityScore: 70,
  },
]

const MULTICHAIN_SCENARIOS: ChainScenarioConfig[] = [
  {
    marketShockPct: 35,
    liquidityDropPct: 55,
    protocolExploitSeverity: 15,
    oracleDelayMinutes: 5,
    bridgeOutageDurationMinutes: 120,
    chainsAffected: [
      ChainType.Solana,
      ChainType.Ethereum,
      ChainType.Arbitrum,
      ChainType.Base,
      ChainType.Optimism,
      ChainType.Polygon,
      ChainType.Cosmos,
    ],
  },
  {
    marketShockPct: 15,
    liquidityDropPct: 40,
    protocolExploitSeverity: 45,
    oracleDelayMinutes: 10,
    bridgeOutageDurationMinutes: 360,
    chainsAffected: [ChainType.Solana, ChainType.Ethereum, ChainType.Arbitrum, ChainType.Optimism, ChainType.Base],
  },
  {
    marketShockPct: 20,
    liquidityDropPct: 50,
    protocolExploitSeverity: 25,
    oracleDelayMinutes: 15,
    bridgeOutageDurationMinutes: 180,
    chainsAffected: [ChainType.Arbitrum, ChainType.Optimism, ChainType.Base, ChainType.Polygon],
  },
]

const MULTICHAIN_SCENARIO_INFO = [
  {
    title: 'Systemic Liquidity Crisis',
    description: 'Global panic leads to market collapse, heavy liquidity flight, and bridge disruptions.',
    beginnerLabel: 'Global Liquidity Panic',
    beginnerSummary: 'A market-wide panic where liquidity disappears, and cross-chain transfers are blocked.',
  },
  {
    title: 'Cross-Chain Bridge Outage',
    description: 'Vulnerability detected in standard cross-chain messaging bridge. Bridge operations paused.',
    beginnerLabel: 'Bridge Outage / Trapped Assets',
    beginnerSummary: 'Cross-chain bridges are disabled, trapping your assets on their current networks.',
  },
  {
    title: 'EVM L2 Sequencer Downtime',
    description: 'Centralized sequencer for key EVM layer-2 rollups crashes, suspending tx verification.',
    beginnerLabel: 'Network Freeze / Blocked Trades',
    beginnerSummary: 'Major Layer-2 networks freeze, preventing you from executing any trades or liquidations.',
  },
]

function RiskDial({ score, maxDrawdown }: { score: number; maxDrawdown: number }) {
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

function BridgeThreatSimulator({ scenario }: { scenario: ChainScenarioConfig }) {
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

      <div className="relative w-full h-[140px] bg-zinc-950 rounded-xs border border-zinc-900 flex items-center justify-center">
        <svg viewBox="0 0 400 140" className="w-full h-full">
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

function mapCategoryToKind(category: string): ChainPortfolioPosition['kind'] {
  const cat = category.toLowerCase()
  if (cat.includes('lending') || cat.includes('cdp')) return 'lending'
  if (cat.includes('yield') || cat.includes('farm') || cat.includes('vault')) return 'yield'
  if (cat.includes('staking') || cat.includes('restaking')) return 'yield'
  if (cat.includes('lp') || cat.includes('amm') || cat.includes('dex')) return 'lp'
  if (cat.includes('token')) return 'token'
  return 'other'
}

function getVolatility(category: string): number {
  const cat = category.toLowerCase()
  if (cat.includes('stable') || cat.includes('peg')) return 5
  if (cat.includes('lending') || cat.includes('cdp') || cat.includes('staking')) return 45
  if (cat.includes('yield') || cat.includes('farm') || cat.includes('vault')) return 60
  if (cat.includes('derivatives') || cat.includes('perpetuals') || cat.includes('options')) return 85
  return 55
}

function getLiquidityScore(tvl: number): number {
  if (tvl <= 0) return 50
  const score = Math.round(20 + 10 * Math.log10(tvl / 1000))
  return Math.min(98, Math.max(10, score))
}

function getLatestTokenPriceFromProtocolDetail(detail?: any): number | null {
  if (!detail) return null

  const latestUsdEntry = detail.tokensInUsd?.[detail.tokensInUsd.length - 1]
  const latestTokenEntry = detail.tokens?.[detail.tokens.length - 1]
  if (!latestUsdEntry || !latestTokenEntry) return null

  const usdTokens = latestUsdEntry.tokens ?? {}
  const rawTokens = latestTokenEntry.tokens ?? {}
  const symbols = Object.keys(usdTokens)

  for (const symbol of symbols) {
    const usdValue = usdTokens[symbol]
    const tokenAmount = rawTokens[symbol]
    if (typeof usdValue === 'number' && typeof tokenAmount === 'number' && tokenAmount > 0) {
      const derived = usdValue / tokenAmount
      if (Number.isFinite(derived) && derived > 0) return derived
    }
  }

  return null
}

export default function WarRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      }
    >
      <WarRoomContent />
    </Suspense>
  )
}

async function fetchAndBuildPositions(protocolSlug: string): Promise<ChainPortfolioPosition[]> {
  const res = await fetch(`/api/defillama/protocol?slug=${encodeURIComponent(protocolSlug)}`)
  if (!res.ok) throw new Error(`Status ${res.status}`)
  const data = await res.json()

  if (data.error) {
    throw new Error(data.error)
  }

  // Map chain names from DefiLlama to Aegis ChainType
  const MAP_DEFILLAMA_CHAIN_TO_CHAIN_TYPE: Record<string, ChainType> = {
    solana: ChainType.Solana,
    ethereum: ChainType.Ethereum,
    polygon: ChainType.Polygon,
    arbitrum: ChainType.Arbitrum,
    optimism: ChainType.Optimism,
    cosmos: ChainType.Cosmos,
    base: ChainType.Base,
  }

  const chainsList: string[] = data.chains || []
  const category: string = data.category || 'other'
  const symbol: string = (data.symbol && data.symbol !== '-' ? data.symbol : protocolSlug).toUpperCase()
  const name: string = data.name || protocolSlug

  // Resolve price
  let tokenPrice = 0
  let geckoId = data.gecko_id || data.geckoId
  const address = data.address

  // 1. Try contract address query via DeFiLlama Coins API
  if (address) {
    try {
      const priceRes = await fetch(`https://coins.llama.fi/prices/current/${address}`)
      if (priceRes.ok) {
        const priceData = await priceRes.json()
        const coinInfo = priceData.coins?.[address]
        if (coinInfo && coinInfo.price != null) {
          tokenPrice = coinInfo.price
        }
      }
    } catch (addressErr) {
      console.error('Failed to fetch price by address:', addressErr)
    }
  }

  // If address had no prefix, try prefixing it with the primary chain
  if (tokenPrice === 0 && address && !address.includes(':') && chainsList.length > 0) {
    const formattedAddress = `${chainsList[0].toLowerCase()}:${address}`
    try {
      const priceRes = await fetch(`https://coins.llama.fi/prices/current/${formattedAddress}`)
      if (priceRes.ok) {
        const priceData = await priceRes.json()
        const coinInfo = priceData.coins?.[formattedAddress]
        if (coinInfo && coinInfo.price != null) {
          tokenPrice = coinInfo.price
        }
      }
    } catch (addressErr) {
      console.error('Failed to fetch price by formatted address:', addressErr)
    }
  }

  // 2. Try contract address lookup via DexScreener Coins API fallback
  if (tokenPrice === 0 && address) {
    const cleanAddress = address.includes(':') ? address.split(':')[1] : address
    if (cleanAddress.startsWith('0x') || cleanAddress.length >= 32) {
      try {
        const dexscreenerRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanAddress}`)
        if (dexscreenerRes.ok) {
          const dexscreenerData = await dexscreenerRes.json()
          const pairs = dexscreenerData.pairs || []
          if (pairs.length > 0) {
            const bestPair = pairs.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
            if (bestPair && bestPair.priceUsd) {
              tokenPrice = Number(bestPair.priceUsd)
            }
          }
        }
      } catch (dexErr) {
        console.error('Failed to fetch price from DexScreener by address:', dexErr)
      }
    }
  }

  // 3. Try CoinGecko ID fallback
  if (tokenPrice === 0) {
    // If gecko_id is not found in the protocol detail, try looking it up in the chain's protocol list
    if (!geckoId && chainsList.length > 0) {
      const primaryChain = chainsList[0].toLowerCase()
      const mappedChain = MAP_DEFILLAMA_CHAIN_TO_CHAIN_TYPE[primaryChain]
      if (mappedChain) {
        try {
          const listRes = await fetch(`/api/defillama?chain=${encodeURIComponent(mappedChain)}`)
          if (listRes.ok) {
            const listData = await listRes.json()
            const matched = resolveProtocolFromList(protocolSlug, listData)
            if (matched) {
              geckoId = (matched as any).gecko_id || (matched as any).geckoId
            }
          }
        } catch (listErr) {
          console.error('Failed to fetch chain protocols list for lookup:', listErr)
        }
      }
    }

    if (geckoId) {
      try {
        const priceRes = await fetch(`/api/coingecko?id=${encodeURIComponent(geckoId)}`)
        if (priceRes.ok) {
          const priceData = await priceRes.json()
          tokenPrice = priceData.market_data?.current_price?.usd || 0
        }
      } catch (priceErr) {
        console.error('Failed to fetch price from CoinGecko:', priceErr)
      }
    }
  }

  // 4. Try token symbol search via DexScreener fallback
  if (tokenPrice === 0 && symbol && symbol !== '-') {
    try {
      const dexscreenerRes = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`,
      )
      if (dexscreenerRes.ok) {
        const dexscreenerData = await dexscreenerRes.json()
        const pairs = dexscreenerData.pairs || []
        const matchingPairs = pairs.filter((p: any) => p.baseToken?.symbol?.toUpperCase() === symbol.toUpperCase())
        if (matchingPairs.length > 0) {
          const bestPair = matchingPairs.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
          if (bestPair && bestPair.priceUsd) {
            tokenPrice = Number(bestPair.priceUsd)
          }
        }
      }
    } catch (dexErr) {
      console.error('Failed to fetch price from DexScreener by symbol:', dexErr)
    }
  }

  // 5. Try token TVL weights fallback
  if (tokenPrice === 0) {
    tokenPrice = getLatestTokenPriceFromProtocolDetail(data) || 0
  }

  // 6. Default fallback
  if (tokenPrice === 0) {
    tokenPrice = 1.0 // fallback unit price
  }

  // Resolve chain-specific TVLs
  const parsedPositions: ChainPortfolioPosition[] = []
  let totalTvl = 0

  const chainDataList = chainsList
    .map((chainName) => {
      const normalizedChain = chainName.trim().toLowerCase()
      const chainType = MAP_DEFILLAMA_CHAIN_TO_CHAIN_TYPE[normalizedChain]
      if (!chainType) return null

      // Find latest TVL for this chain
      let chainTvl = 0
      if (data.chainTvls && data.chainTvls[chainName]) {
        const history = data.chainTvls[chainName].tvl || []
        if (history.length > 0) {
          chainTvl = history[history.length - 1].totalLiquidity || 0
        }
      }
      if (chainTvl === 0 && data.tvl) {
        // fallback to total tvl if only one chain
        const history = data.tvl || []
        if (history.length > 0) {
          chainTvl = history[history.length - 1].totalLiquidity || 0
        }
      }

      return { chainType, chainTvl, rawChainName: chainName }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)

  // Sum up supported chains TVL
  chainDataList.forEach((c) => {
    totalTvl += c.chainTvl
  })

  // Create position for each supported chain
  chainDataList.forEach((c) => {
    // Estimate volatility and liquidity score
    const volatility = getVolatility(category)
    const liquidityScore = getLiquidityScore(c.chainTvl)

    parsedPositions.push({
      chain: c.chainType,
      kind: mapCategoryToKind(category),
      symbol: symbol,
      protocol: protocolSlug.toLowerCase(),
      balance: 1, // exactly 1 unit of protocol token
      usdValue: tokenPrice, // value is exactly the price
      volatility: volatility,
      liquidityScore: liquidityScore,
    })
  })

  return parsedPositions
}

function WarRoomContent() {
  const wallet = useWallet()
  const [simpleMode, setSimpleMode] = useState(false)
  const searchParams = useSearchParams()

  // Watchlist
  const { watchlist } = useWatchlist()
  const [isImportingWatchlist, setIsImportingWatchlist] = useState(false)

  // Multichain states
  const [multichainPositions, setMultichainPositions] = useState<ChainPortfolioPosition[]>(DEFAULT_MULTICHAIN_POSITIONS)
  const [selectedMultichainScenarioIdx, setSelectedMultichainScenarioIdx] = useState(0)

  // Custom Scenario state
  const [useCustomScenario, setUseCustomScenario] = useState(false)
  const [customScenario, setCustomScenario] = useState<ChainScenarioConfig>({
    marketShockPct: 20,
    liquidityDropPct: 30,
    protocolExploitSeverity: 10,
    oracleDelayMinutes: 0,
    bridgeOutageDurationMinutes: 0,
    chainsAffected: [
      ChainType.Solana,
      ChainType.Ethereum,
      ChainType.Arbitrum,
      ChainType.Base,
      ChainType.Optimism,
      ChainType.Polygon,
      ChainType.Cosmos,
    ],
  })

  const [multichainResult, setMultichainResult] = useState<ComparativeSimulationResult | null>(null)
  const [multichainLoading, setMultichainLoading] = useState(false)
  const [multichainError, setMultichainError] = useState<string | null>(null)
  const [multichainImportStatus, setMultichainImportStatus] = useState<string | null>(null)
  const [execModalOpen, setExecModalOpen] = useState(false)
  const [execAction, setExecAction] = useState<ExecutionAction | null>(null)

  useEffect(() => {
    const protocolParam = searchParams.get('protocol')
    if (!protocolParam) return
    const protocolSlug = protocolParam

    let active = true
    async function loadParamProtocol() {
      setMultichainImportStatus(`Resolving contract telemetry for ${protocolSlug.toUpperCase()}...`)
      try {
        const positions = await fetchAndBuildPositions(protocolSlug)
        if (!active) return

        if (positions.length === 0) {
          setMultichainImportStatus(
            `Protocol ${protocolSlug.toUpperCase()} fetched, but it is not deployed on any Aegis-supported networks.`,
          )
          return
        }

        const price = positions[0].usdValue
        setMultichainPositions(positions)
        setMultichainImportStatus(
          `Successfully loaded ${protocolSlug.toUpperCase()} deployments across ${positions.length} network(s). Live Unit Price: $${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`,
        )
      } catch (err) {
        if (!active) return
        console.error('Failed to load protocol from URL parameter:', err)
        setMultichainImportStatus(`Failed to resolve telemetry for ${protocolSlug}: ${String(err)}`)
      }
    }

    void loadParamProtocol()
    return () => {
      active = false
    }
  }, [searchParams])

  async function handleImportWatchlist() {
    if (!watchlist || watchlist.length === 0) {
      setMultichainImportStatus('Watchlist is empty. Go to Research to add protocols.')
      return
    }

    setIsImportingWatchlist(true)
    setMultichainImportStatus(`Importing ${watchlist.length} protocols from watchlist...`)

    let importedCount = 0
    let failedCount = 0
    const allNewPositions: ChainPortfolioPosition[] = []

    for (const slug of watchlist) {
      setMultichainImportStatus(`Resolving telemetry for watchlisted protocol ${slug.toUpperCase()}...`)
      try {
        const positions = await fetchAndBuildPositions(slug)
        if (positions.length > 0) {
          allNewPositions.push(...positions)
          importedCount++
        } else {
          failedCount++
        }
      } catch (err) {
        console.error(`Failed to resolve watchlist protocol ${slug}:`, err)
        failedCount++
      }
    }

    if (allNewPositions.length > 0) {
      setMultichainPositions((current) => {
        const existing = [...current]
        allNewPositions.forEach((newPos) => {
          const duplicateIndex = existing.findIndex(
            (p) =>
              p.chain === newPos.chain &&
              p.symbol.toUpperCase() === newPos.symbol.toUpperCase() &&
              p.protocol.toLowerCase() === newPos.protocol.toLowerCase(),
          )
          if (duplicateIndex >= 0) {
            existing[duplicateIndex] = newPos
          } else {
            existing.push(newPos)
          }
        })
        return existing
      })
      setMultichainResult(null)
      setMultichainImportStatus(
        `Watchlist import complete. Imported ${importedCount} protocols (${allNewPositions.length} positions total).${failedCount > 0 ? ` Failed: ${failedCount}.` : ''}`,
      )
    } else {
      setMultichainImportStatus(`Watchlist import failed. Could not resolve any watchlisted protocols.`)
    }
    setIsImportingWatchlist(false)
  }

  function handleExecuteAction(action: ExecutionAction) {
    setExecAction(action)
    setExecModalOpen(true)
  }

  function handleExecutionSuccess() {
    if (!execAction) return
    setMultichainPositions((current) => {
      return current.map((pos) => {
        const isMatch =
          pos.symbol.toLowerCase() === execAction.assetSymbol.toLowerCase() && pos.chain === execAction.fromChain
        if (isMatch) {
          if (execAction.action === 'liquidate') {
            return { ...pos, usdValue: Math.max(0, pos.usdValue - execAction.amount) }
          } else if (execAction.action === 'move') {
            return {
              ...pos,
              chain: (execAction.toChain as ChainType) || pos.chain,
              protocol: execAction.protocol || pos.protocol,
              volatility: Math.max(5, pos.volatility - 15),
              liquidityScore: Math.min(100, pos.liquidityScore + 10),
            }
          }
        }
        return pos
      })
    })
    setMultichainResult(null)
  }

  const [newPosForm, setNewPosForm] = useState<{
    chain: ChainType
    kind: ChainPortfolioPosition['kind']
    symbol: string
    protocol: string
    usdValue: number
    balance: number
    volatility: number
    liquidityScore: number
  }>({
    chain: ChainType.Solana,
    kind: 'token',
    symbol: '',
    protocol: '',
    usdValue: 0,
    balance: 0,
    volatility: 50,
    liquidityScore: 80,
  })

  function updateMultichainPositionField(index: number, field: keyof ChainPortfolioPosition, value: number) {
    setMultichainPositions((current) => current.map((pos, idx) => (idx === index ? { ...pos, [field]: value } : pos)))
    setMultichainResult(null)
  }

  function updateMultichainPositionBalance(index: number, value: number) {
    setMultichainPositions((current) =>
      current.map((pos, idx) => {
        if (idx !== index) return pos
        const unitPrice = pos.balance > 0 ? pos.usdValue / pos.balance : 0
        return {
          ...pos,
          balance: value,
          usdValue: unitPrice > 0 ? Math.round(value * unitPrice * 100) / 100 : pos.usdValue,
        }
      }),
    )
    setMultichainResult(null)
  }

  function removeMultichainPosition(index: number) {
    setMultichainPositions((current) => current.filter((_, idx) => idx !== index))
    setMultichainResult(null)
  }

  function addMultichainPosition() {
    if (!newPosForm.symbol.trim() || !newPosForm.protocol.trim() || newPosForm.usdValue <= 0) {
      setMultichainImportStatus('Holding details (Symbol, Protocol, USD Value) must be provided.')
      return
    }

    const newPos: ChainPortfolioPosition = {
      chain: newPosForm.chain,
      kind: newPosForm.kind,
      symbol: newPosForm.symbol.trim().toUpperCase(),
      protocol: newPosForm.protocol.trim().toLowerCase(),
      usdValue: newPosForm.usdValue,
      balance: newPosForm.usdValue / 10,
      volatility: newPosForm.volatility,
      liquidityScore: newPosForm.liquidityScore,
    }

    setMultichainPositions((current) => [...current, newPos])
    setMultichainResult(null)
    setMultichainImportStatus(`Added ${newPos.symbol} on ${newPos.chain}.`)
    setNewPosForm({
      chain: ChainType.Solana,
      kind: 'token',
      symbol: '',
      protocol: '',
      usdValue: 0,
      balance: 0,
      volatility: 50,
      liquidityScore: 80,
    })
  }

  async function runMultichainSimulation() {
    setMultichainLoading(true)
    setMultichainError(null)

    const activeScenario = useCustomScenario ? customScenario : MULTICHAIN_SCENARIOS[selectedMultichainScenarioIdx]
    const portfolioPayload: MultiChainPortfolio = {
      walletAddress: wallet.publicKey?.toString() || 'guest-multichain-wallet',
      positions: multichainPositions,
      totalUsdValue: multichainPositions.reduce((acc, p) => acc + p.usdValue, 0),
      chains: Array.from(new Set(multichainPositions.map((p) => p.chain))),
      lastUpdated: new Date(),
    }

    try {
      const res = await fetch('/api/war-room/simulate-comparative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio: portfolioPayload, scenario: activeScenario }),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const data: ComparativeSimulationResult = await res.json()
      setMultichainResult(data)
    } catch (err) {
      setMultichainError(String(err))
    } finally {
      setMultichainLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-6 px-2 cyber-grid">
      <header className="space-y-4 text-left">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Badge
            variant="accent"
            className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-orbitron font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)] bg-cyan-950/20 text-cyan-400 border-cyan-500/20"
          >
            Aegis War Room Console
          </Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-orbitron font-black tracking-wide text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.08)] uppercase">
            Stress Test Portfolio Risk Posture
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-3xl leading-relaxed">
            Inject systemic bridge outages, sequencer failures, or liquidity shock parameters into your custom
            cross-chain holdings to model drawdown thresholds and hedge paths.
          </p>
          <div className="rounded-xs bg-amber-500/5 border border-amber-500/25 p-3 text-[11px] font-mono text-amber-200/90 mt-2">
            {UI_DISCLAIMER}
          </div>
        </div>
      </header>

      <div className="space-y-8 animate-in fade-in duration-500 text-left">
        <section className="space-y-4">
          <h2 className="text-[10px] font-orbitron font-bold uppercase tracking-widest text-zinc-500">
            &gt; SIMULATION SYSTEM MATRIX
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <SpotlightCard
              spotlightColor="rgba(6, 182, 212, 0.03)"
              borderColor="rgba(6, 182, 212, 0.15)"
              className="border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs corner-decor"
            >
              <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-550">Node 01</p>
              <p className="mt-2 text-sm font-orbitron font-bold text-white uppercase tracking-wider">
                Configure Deployments
              </p>
              <p className="mt-1 text-xs text-zinc-450 leading-relaxed font-medium">
                Model custom asset weights across Solana, EVM, and Cosmos networks.
              </p>
            </SpotlightCard>
            <SpotlightCard
              spotlightColor="rgba(6, 182, 212, 0.03)"
              borderColor="rgba(6, 182, 212, 0.15)"
              className="border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs corner-decor"
            >
              <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-550">Node 02</p>
              <p className="mt-2 text-sm font-orbitron font-bold text-white uppercase tracking-wider">
                Inject Market Shocks
              </p>
              <p className="mt-1 text-xs text-zinc-450 leading-relaxed font-medium">
                Select a bridge outage or sequencer failure scenario preset to apply.
              </p>
            </SpotlightCard>
            <SpotlightCard
              spotlightColor="rgba(6, 182, 212, 0.03)"
              borderColor="rgba(6, 182, 212, 0.15)"
              className="border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs corner-decor"
            >
              <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-550">Node 03</p>
              <p className="mt-2 text-sm font-orbitron font-bold text-white uppercase tracking-wider">
                Synthesize Hedges
              </p>
              <p className="mt-1 text-xs text-zinc-450 leading-relaxed font-medium">
                Inspect recommended rebalancing routes and capture cross-chain arbitrage spreads.
              </p>
            </SpotlightCard>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel: Portfolio Holdings mixing board */}
          <div className="lg:col-span-3 rounded-xl bg-zinc-950/50 border border-cyan-500/10 p-5 backdrop-blur-md space-y-5 corner-decor shadow-2xl">
            <div className="flex flex-wrap items-center justify-between border-b border-cyan-500/10 pb-3 gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-orbitron font-black text-sm uppercase tracking-wider text-white">
                  Cross-Chain Portfolio Holdings
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isImportingWatchlist}
                  onClick={handleImportWatchlist}
                  className="h-6 text-[9px] font-mono text-cyan-400 border-cyan-500/20 bg-cyan-950/20 hover:bg-cyan-500/15 rounded-xs px-2 py-0.5 gap-1"
                >
                  {isImportingWatchlist ? 'Importing...' : `Import Watchlist (${watchlist.length})`}
                </Button>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-400">
                Total Base Value: {formatCurrency(multichainPositions.reduce((acc, p) => acc + p.usdValue, 0))}
              </span>
            </div>

            {multichainPositions.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xs border border-dashed border-zinc-800 bg-zinc-950/20 font-mono text-zinc-550">
                <p className="text-xs font-semibold">&gt; Portfolios database registers empty.</p>
                <p className="text-[10px] mt-1">
                  Click &quot;Reset to Demo Portfolio&quot; below to load pre-configured assets.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 text-xs">
                {multichainPositions.map((pos, idx) => (
                  <div
                    key={`${pos.chain}-${pos.symbol}-${idx}`}
                    className="grid grid-cols-1 gap-3 rounded-xs border border-zinc-900 bg-zinc-950/80 p-3.5 sm:grid-cols-12 items-center"
                  >
                    <div className="sm:col-span-3 text-left font-mono">
                      <p className="font-bold text-white capitalize text-sm">{pos.symbol}</p>
                      <p className="text-[9px] text-cyan-500 uppercase tracking-widest mt-1">
                        {pos.chain} • {pos.protocol} • {pos.kind}
                      </p>
                    </div>
                    <div className="sm:col-span-2 text-left">
                      <label className="text-[8px] font-mono uppercase tracking-wider text-zinc-550 block mb-1">
                        Balance
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={pos.balance}
                        onChange={(e) => updateMultichainPositionBalance(idx, Number(e.target.value))}
                        className="h-8 text-xs font-mono bg-zinc-950 border-zinc-900 text-white px-2"
                      />
                    </div>
                    <div className="sm:col-span-2 text-left">
                      <label className="text-[8px] font-mono uppercase tracking-wider text-zinc-550 block mb-1">
                        USD Value
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={pos.usdValue}
                        onChange={(e) => updateMultichainPositionField(idx, 'usdValue', Number(e.target.value))}
                        className="h-8 text-xs font-mono bg-zinc-950 border-zinc-900 text-white px-2"
                      />
                    </div>
                    <div className="sm:col-span-2 text-left">
                      <label className="text-[8px] font-mono uppercase tracking-wider text-zinc-550 block mb-1">
                        Volatility %
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={150}
                        value={pos.volatility}
                        onChange={(e) => updateMultichainPositionField(idx, 'volatility', Number(e.target.value))}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                      <span className="text-[9px] font-mono text-cyan-400 mt-1 block font-bold">
                        {pos.volatility}% Vol
                      </span>
                    </div>
                    <div className="sm:col-span-2 text-left">
                      <label className="text-[8px] font-mono uppercase tracking-wider text-zinc-550 block mb-1">
                        Liquidity
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={pos.liquidityScore}
                        onChange={(e) => updateMultichainPositionField(idx, 'liquidityScore', Number(e.target.value))}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                      <span className="text-[9px] font-mono text-cyan-400 mt-1 block font-bold">
                        {pos.liquidityScore} Score
                      </span>
                    </div>
                    <div className="sm:col-span-1 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMultichainPosition(idx)}
                        className="text-rose-400 hover:text-white hover:bg-rose-500/10 h-7 w-7 p-0 rounded-xs"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xs border border-zinc-850 bg-zinc-950/20 p-4 space-y-4">
              <h3 className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400">
                Add Custom Holding Vector
              </h3>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-6 text-left text-xs font-mono">
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">Chain</label>
                  <select
                    value={newPosForm.chain}
                    onChange={(e) => setNewPosForm({ ...newPosForm, chain: e.target.value as ChainType })}
                    className="flex h-9 w-full rounded-xs border border-zinc-850 bg-zinc-950 px-3 py-1 text-xs shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono"
                  >
                    {Object.values(ChainType).map((c) => (
                      <option key={c} value={c} className="bg-zinc-950 text-white font-mono">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">Symbol</label>
                  <Input
                    type="text"
                    placeholder="SOL, ETH"
                    value={newPosForm.symbol}
                    onChange={(e) => setNewPosForm({ ...newPosForm, symbol: e.target.value.toUpperCase() })}
                    className="h-9 text-xs uppercase bg-zinc-950 border-zinc-850 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">Protocol</label>
                  <Input
                    type="text"
                    placeholder="jito, aave"
                    value={newPosForm.protocol}
                    onChange={(e) => setNewPosForm({ ...newPosForm, protocol: e.target.value.toLowerCase() })}
                    className="h-9 text-xs bg-zinc-950 border-zinc-850 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">Kind</label>
                  <select
                    value={newPosForm.kind}
                    onChange={(e) =>
                      setNewPosForm({ ...newPosForm, kind: e.target.value as ChainPortfolioPosition['kind'] })
                    }
                    className="flex h-9 w-full rounded-xs border border-zinc-850 bg-zinc-950 px-3 py-1 text-xs shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono"
                  >
                    <option value="token" className="bg-zinc-950 text-white">
                      token
                    </option>
                    <option value="lp" className="bg-zinc-950 text-white">
                      lp
                    </option>
                    <option value="lending" className="bg-zinc-950 text-white">
                      lending
                    </option>
                    <option value="yield" className="bg-zinc-950 text-white">
                      yield
                    </option>
                    <option value="other" className="bg-zinc-950 text-white">
                      other
                    </option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">Balance</label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="100"
                    value={newPosForm.balance || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setNewPosForm({
                        ...newPosForm,
                        balance: val,
                        usdValue: newPosForm.usdValue || Math.round(val * 10 * 100) / 100,
                      })
                    }}
                    className="h-9 text-xs bg-zinc-950 border-zinc-850 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">USD Value</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="1000"
                    value={newPosForm.usdValue || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setNewPosForm({
                        ...newPosForm,
                        usdValue: val,
                        balance: newPosForm.balance || Math.round((val / 10) * 100) / 100,
                      })
                    }}
                    className="h-9 text-xs bg-zinc-950 border-zinc-850 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMultichainPositions(DEFAULT_MULTICHAIN_POSITIONS)
                    setMultichainResult(null)
                    setMultichainImportStatus('Reset portfolio to demo layout.')
                  }}
                  className="text-zinc-400 border-zinc-850 bg-zinc-950 hover:bg-zinc-900 font-mono rounded-xs text-xs"
                >
                  Reset to Demo Portfolio
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={addMultichainPosition}
                  className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-bold uppercase tracking-wider rounded-xs shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                >
                  Add Position
                </Button>
              </div>
            </div>
            {multichainImportStatus && (
              <p className="rounded-xs bg-cyan-950/5 border border-cyan-500/10 px-3.5 py-2 text-[10px] font-mono text-cyan-400">
                {multichainImportStatus}
              </p>
            )}
          </div>

          {/* Right Panel: Scenario presetter */}
          <div className="lg:col-span-2 rounded-xl bg-zinc-950/50 border border-cyan-500/10 p-5 backdrop-blur-md space-y-5 corner-decor shadow-2xl">
            <div className="flex justify-between items-center border-b border-cyan-500/10 pb-3 gap-3">
              <h2 className="font-orbitron font-black text-sm uppercase tracking-wider text-white">
                Cross-Chain Threat Deck
              </h2>
              <button
                type="button"
                onClick={() => setSimpleMode(!simpleMode)}
                className={`rounded-xs px-3 py-1 text-[8px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 ${
                  simpleMode
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                    : 'bg-zinc-950 border-zinc-850 text-zinc-500 hover:text-zinc-350'
                }`}
              >
                {simpleMode ? 'Lingo: Simplified' : 'Lingo: Technical'}
              </button>
            </div>

            <div className="flex border-b border-cyan-500/10 pb-1.5 gap-2">
              <button
                type="button"
                onClick={() => setUseCustomScenario(false)}
                className={`flex-1 text-center py-1.5 text-[10px] font-orbitron font-bold uppercase tracking-wider border transition-all ${
                  !useCustomScenario
                    ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-400 font-black'
                    : 'bg-zinc-950/30 border-transparent text-zinc-500 hover:text-zinc-350'
                }`}
              >
                Presets
              </button>
              <button
                type="button"
                onClick={() => setUseCustomScenario(true)}
                className={`flex-1 text-center py-1.5 text-[10px] font-orbitron font-bold uppercase tracking-wider border transition-all ${
                  useCustomScenario
                    ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-400 font-black'
                    : 'bg-zinc-950/30 border-transparent text-zinc-500 hover:text-zinc-350'
                }`}
              >
                Custom Injector
              </button>
            </div>

            {!useCustomScenario ? (
              <div className="space-y-2">
                {MULTICHAIN_SCENARIOS.map((sc, idx) => {
                  const info = MULTICHAIN_SCENARIO_INFO[idx]
                  return (
                    <button
                      key={info.title}
                      type="button"
                      onClick={() => setSelectedMultichainScenarioIdx(idx)}
                      className={`w-full rounded-xs px-3.5 py-3 text-left transition border ${
                        idx === selectedMultichainScenarioIdx
                          ? 'bg-cyan-950/15 border-cyan-500/35 text-white shadow-[0_0_12px_rgba(6,182,212,0.06)]'
                          : 'bg-zinc-950/40 border-zinc-900 text-zinc-450 hover:bg-zinc-950 hover:text-zinc-200'
                      }`}
                    >
                      <p className="text-xs font-orbitron font-bold tracking-wider uppercase">
                        {simpleMode ? info.beginnerLabel : info.title}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-normal">
                        {simpleMode ? info.beginnerSummary : info.description}
                      </p>
                      {!simpleMode && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="rounded-xs bg-zinc-950/80 px-1.5 py-0.5 text-[8px] text-cyan-500 border border-zinc-900 font-mono font-semibold">
                            Shock: -{sc.marketShockPct}%
                          </span>
                          <span className="rounded-xs bg-zinc-950/80 px-1.5 py-0.5 text-[8px] text-cyan-500 border border-zinc-900 font-mono font-semibold">
                            Liquidity: -{sc.liquidityDropPct}%
                          </span>
                          {sc.bridgeOutageDurationMinutes && sc.bridgeOutageDurationMinutes > 0 ? (
                            <span className="rounded-xs bg-rose-500/10 text-rose-300 border border-rose-500/15 px-1.5 py-0.5 text-[8px] font-mono font-bold">
                              Bridge Outage: {sc.bridgeOutageDurationMinutes}m
                            </span>
                          ) : null}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-4 rounded-xs border border-cyan-500/10 bg-zinc-950/45 p-4 text-xs font-mono text-left">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-zinc-400">MARKET SHOCK</span>
                    <span className="text-cyan-400">-{customScenario.marketShockPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={customScenario.marketShockPct}
                    onChange={(e) => setCustomScenario({ ...customScenario, marketShockPct: Number(e.target.value) })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-zinc-400">LIQUIDITY DROP</span>
                    <span className="text-cyan-400">-{customScenario.liquidityDropPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={customScenario.liquidityDropPct}
                    onChange={(e) => setCustomScenario({ ...customScenario, liquidityDropPct: Number(e.target.value) })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-zinc-400">PROTOCOL EXPLOIT SEVERITY</span>
                    <span className="text-cyan-400">{customScenario.protocolExploitSeverity}% Risk</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={customScenario.protocolExploitSeverity}
                    onChange={(e) =>
                      setCustomScenario({ ...customScenario, protocolExploitSeverity: Number(e.target.value) })
                    }
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-zinc-400">ORACLE DELAY</span>
                    <span className="text-cyan-400">{customScenario.oracleDelayMinutes} mins</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={120}
                    value={customScenario.oracleDelayMinutes}
                    onChange={(e) =>
                      setCustomScenario({ ...customScenario, oracleDelayMinutes: Number(e.target.value) })
                    }
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-zinc-400">BRIDGE OUTAGE DURATION</span>
                    <span className="text-cyan-400">{customScenario.bridgeOutageDurationMinutes} mins</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1440}
                    step={30}
                    value={customScenario.bridgeOutageDurationMinutes}
                    onChange={(e) =>
                      setCustomScenario({ ...customScenario, bridgeOutageDurationMinutes: Number(e.target.value) })
                    }
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                <div className="space-y-2 border-t border-zinc-900 pt-3">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-550 block mb-1">
                    Chains Affected
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {Object.values(ChainType).map((c) => {
                      const isChecked = customScenario.chainsAffected?.includes(c) ?? false
                      return (
                        <label
                          key={c}
                          className="flex items-center gap-2 cursor-pointer text-zinc-350 hover:text-white transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const currentChains = customScenario.chainsAffected ?? []
                              const newChains = currentChains.includes(c)
                                ? currentChains.filter((x) => x !== c)
                                : [...currentChains, c]
                              setCustomScenario({ ...customScenario, chainsAffected: newChains })
                            }}
                            className="rounded-xs border-zinc-850 bg-zinc-950 text-cyan-500 focus:ring-0 cursor-pointer h-3.5 w-3.5 animate-none"
                          />
                          <span className="uppercase">{c}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-3 flex justify-end">
                  <Button
                    type="button"
                    onClick={() =>
                      setCustomScenario({
                        marketShockPct: 0,
                        liquidityDropPct: 0,
                        protocolExploitSeverity: 0,
                        oracleDelayMinutes: 0,
                        bridgeOutageDurationMinutes: 0,
                        chainsAffected: [
                          ChainType.Solana,
                          ChainType.Ethereum,
                          ChainType.Arbitrum,
                          ChainType.Base,
                          ChainType.Optimism,
                          ChainType.Polygon,
                          ChainType.Cosmos,
                        ],
                      })
                    }
                    className="border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/15 text-cyan-400 text-[9px] uppercase tracking-wider font-orbitron font-bold h-7 rounded-xs px-3"
                  >
                    Reset to Stable
                  </Button>
                </div>
              </div>
            )}

            <BridgeThreatSimulator
              scenario={useCustomScenario ? customScenario : MULTICHAIN_SCENARIOS[selectedMultichainScenarioIdx]}
            />

            <Button
              onClick={runMultichainSimulation}
              disabled={multichainLoading || multichainPositions.length === 0}
              className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-black uppercase tracking-widest text-xs shadow-[0_0_12px_rgba(6,182,212,0.25)] transition-all cursor-pointer rounded-xs"
            >
              {multichainLoading ? 'Synthesizing simulation matrix...' : 'Execute Stress Simulation'}
            </Button>
            {multichainError && (
              <p className="text-rose-400 text-xs font-mono">&gt; Simulation error: {multichainError}</p>
            )}
          </div>
        </section>

        {/* Simulation Outputs */}
        {multichainResult && (
          <section className="space-y-6 animate-in fade-in duration-500">
            <div className="rounded-xl border border-cyan-500/15 bg-cyan-950/5 p-4 shadow-sm text-xs font-mono">
              <p className="text-zinc-350 leading-relaxed">
                &gt; Simulation finished with portfolio vulnerability score at{' '}
                <span className="font-bold text-white">{multichainResult.aggregateRisk}/100</span> (
                {getRiskBand(multichainResult.aggregateRisk).label}). Max estimated asset drawdown is{' '}
                <span className="font-semibold text-rose-300">
                  -{multichainResult.portfolioImpact.maxDrawdown.toFixed(1)}%
                </span>
                . Most vulnerable endpoint detected is{' '}
                <span className="font-semibold text-white uppercase">{multichainResult.mostVulnerableChain}</span>,
                while{' '}
                <span className="font-semibold text-white uppercase">{multichainResult.leastVulnerableChain}</span>{' '}
                registers as target safehaven.
              </p>
            </div>

            {multichainResult.aiBriefing && (
              <SpotlightCard
                spotlightColor="rgba(6, 182, 212, 0.05)"
                borderColor="rgba(6, 182, 212, 0.2)"
                className="border border-cyan-500/20 bg-zinc-950/90 p-5 rounded-xs font-mono text-xs text-left"
              >
                <div className="flex items-center gap-2 border-b border-cyan-500/10 pb-2 mb-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span className="font-bold text-cyan-400 uppercase tracking-widest text-[10px]">
                    AEGIS DYNAMIC THREAT BRIEFING
                  </span>
                </div>
                <div className="text-zinc-350 leading-relaxed space-y-4 whitespace-pre-line prose prose-invert max-w-none">
                  {multichainResult.aiBriefing}
                </div>
              </SpotlightCard>
            )}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
              {/* Semicircular SVG dial */}
              <div className="md:col-span-2">
                <RiskDial
                  score={multichainResult.aggregateRisk}
                  maxDrawdown={multichainResult.portfolioImpact.maxDrawdown}
                />
              </div>

              {/* Raw Metrics cards */}
              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MetricCard
                  label="Monitored Asset Total"
                  value={formatCurrency(multichainResult.portfolioImpact.totalUsdValue)}
                  helper="Base value of all configured multichain positions."
                />
                <MetricCard
                  label="Projected Residual Value"
                  value={formatCurrency(multichainResult.portfolioImpact.projectedValue)}
                  helper="Modeled portfolio value remaining after threat shock event."
                />
                <MetricCard
                  label="Value At Risk (VaR)"
                  value={formatCurrency(
                    multichainResult.portfolioImpact.totalUsdValue - multichainResult.portfolioImpact.projectedValue,
                  )}
                  helper="Estimated monetary loss under stress threshold."
                  accent="text-rose-400"
                />
                <MetricCard
                  label="Vulnerability Ratio"
                  value={`-${multichainResult.portfolioImpact.maxDrawdown.toFixed(1)}%`}
                  helper="Maximum modelled drawdown decline percentage."
                  accent="text-rose-400"
                />
              </div>
            </div>

            {/* Chain Heatmap */}
            <div className="rounded-xl bg-zinc-950/50 border border-cyan-500/10 p-6 space-y-6 corner-decor">
              <div className="border-b border-cyan-500/10 pb-4 text-left">
                <h2 className="text-lg font-orbitron font-black text-white">Inter-Chain Security Heatmap</h2>
                <p className="text-xs text-zinc-500 mt-1 font-mono">
                  &gt; Threat level breakdown per deployment chain based on shock parameters.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {multichainResult.chainRisks.map((cr) => {
                  const rb = getRiskBand(cr.aggregateRisk)
                  const colorClass = rb.color

                  return (
                    <div key={cr.chain} className="rounded-xs border border-zinc-900 bg-zinc-950/40 p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <h3 className="font-orbitron font-bold text-xs uppercase tracking-wide text-zinc-250">
                          {cr.chain}
                        </h3>
                        <span
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-xs bg-zinc-950 ${colorClass}`}
                        >
                          RISK: {cr.aggregateRisk.toFixed(0)} ({rb.label})
                        </span>
                      </div>
                      <div className="space-y-2.5 font-mono text-[10px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-zinc-500">
                            <span>Market Shock Impact</span>
                            <span className="font-semibold text-zinc-200">{cr.marketRisk}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                            <div className="h-full bg-zinc-500" style={{ width: `${cr.marketRisk}%` }} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-zinc-500">
                            <span>Liquidity Compression</span>
                            <span className="font-semibold text-zinc-200">{cr.liquidityRisk}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                            <div className="h-full bg-zinc-500" style={{ width: `${cr.liquidityRisk}%` }} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-zinc-500">
                            <span>Concentration Shift</span>
                            <span className="font-semibold text-zinc-200">{cr.concentrationRisk}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                            <div className="h-full bg-zinc-500" style={{ width: `${cr.concentrationRisk}%` }} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-zinc-500">
                            <span>Smart Contract Audit Factor</span>
                            <span className="font-semibold text-zinc-200">{cr.smartContractRisk}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                            <div className="h-full bg-zinc-500" style={{ width: `${cr.smartContractRisk}%` }} />
                          </div>
                        </div>
                        {cr.bridgeRisk !== undefined && cr.bridgeRisk > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-rose-400">
                              <span>Bridge Outage Exposure</span>
                              <span className="font-semibold text-rose-300">{cr.bridgeRisk}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                              <div
                                className="h-full bg-rose-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                                style={{ width: `${cr.bridgeRisk}%` }}
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

            {/* Hedge Instructions & Arbitrages */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 rounded-xl bg-zinc-950/50 border border-cyan-500/10 p-5 space-y-4 corner-decor">
                <h3 className="font-orbitron font-black text-sm text-white border-b border-cyan-500/10 pb-3 uppercase">
                  Hedge & Rebalancing Recommendations
                </h3>
                {multichainResult.rebalancingRecommendations.length === 0 ? (
                  <div className="text-center py-6 text-zinc-550 font-mono text-xs">
                    &gt; Rebalancing checks complete. Risk indexes are within tolerance limits.
                  </div>
                ) : (
                  <div className="space-y-3 font-mono text-xs">
                    {multichainResult.rebalancingRecommendations.map((rec, idx) => (
                      <div key={idx} className="rounded-xs border border-zinc-900 bg-zinc-950 p-4 space-y-2 text-left">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-xs px-2.5 py-0.5 text-[8px] font-mono font-bold uppercase border ${rec.action === 'move' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25 shadow-[0_0_8px_rgba(6,182,212,0.1)]' : rec.action === 'liquidate' ? 'bg-rose-500/10 text-rose-300 border-rose-500/25 shadow-[0_0_8px_rgba(239,68,68,0.1)]' : 'bg-zinc-800 text-zinc-350 border-zinc-700'}`}
                            >
                              INSTRUCTION: {rec.action}
                            </span>
                            <p className="font-bold text-white capitalize">
                              {rec.assetSymbol} • {rec.protocol}
                            </p>
                          </div>
                          <span className="text-[9px] text-zinc-500 font-bold">
                            Risk Delta:{' '}
                            <span className="text-emerald-400 font-black">-{rec.expectedRiskReduction} pts</span>
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed">{rec.rationale}</p>
                        <div className="flex flex-wrap gap-4 text-[9px] text-zinc-550 pt-2 border-t border-zinc-900/60 font-semibold uppercase tracking-wider">
                          {rec.fromChain && (
                            <span>
                              From Source: <span className="text-zinc-300 font-bold">{rec.fromChain}</span>
                            </span>
                          )}
                          {rec.toChain && (
                            <span>
                              To Target: <span className="text-zinc-300 font-bold">{rec.toChain}</span>
                            </span>
                          )}
                          <span>
                            Volume:{' '}
                            <span className="text-zinc-300 font-bold">
                              {rec.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                          </span>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-zinc-900/40">
                          <Button
                            onClick={() =>
                              handleExecuteAction({
                                action: rec.action,
                                fromChain: rec.fromChain,
                                toChain: rec.toChain,
                                assetSymbol: rec.assetSymbol,
                                protocol: rec.protocol,
                                amount: rec.amount,
                              })
                            }
                            className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-bold uppercase tracking-wider text-[10px] h-7 px-3.5 rounded-xs cursor-pointer shadow-[0_0_6px_rgba(6,182,212,0.15)]"
                          >
                            Execute{' '}
                            {rec.action === 'move'
                              ? 'Bridge & Swap'
                              : rec.action === 'liquidate'
                                ? 'Exit/Swap'
                                : 'Add Collateral'}
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
                {multichainResult.crossChainArbitrageOpportunities.length === 0 ? (
                  <div className="text-center py-6 text-zinc-550 font-mono text-xs">
                    &gt; Cross-chain price feeds balanced. Spot spreads register null.
                  </div>
                ) : (
                  <div className="space-y-3 font-mono text-xs">
                    {multichainResult.crossChainArbitrageOpportunities.map((opp, idx) => (
                      <div key={idx} className="rounded-xs border border-zinc-900 bg-zinc-950 p-4 space-y-2 text-left">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                          <p className="font-bold text-white">{opp.assetSymbol} Spreads</p>
                          <span
                            className={`rounded-xs px-2 py-0.5 text-[8px] font-mono font-bold uppercase border ${opp.riskLevel === 'high' ? 'bg-rose-500/10 text-rose-300 border-rose-500/25' : opp.riskLevel === 'medium' ? 'bg-amber-500/10 text-amber-300 border-amber-500/25' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'}`}
                          >
                            RISK: {opp.riskLevel}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed">{opp.rationale}</p>
                        <div className="flex items-center justify-between text-[9px] pt-2 border-t border-zinc-900/60 font-semibold uppercase tracking-wider text-zinc-550">
                          <span>
                            Path:{' '}
                            <span className="text-zinc-300">
                              {opp.fromChain} ➜ {opp.toChain}
                            </span>
                          </span>
                          <span>
                            Profit margin: <span className="text-emerald-400 font-black">+{opp.profitMargin}%</span>
                          </span>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-zinc-900/40">
                          <Button
                            onClick={() =>
                              handleExecuteAction({
                                action: 'arbitrage',
                                fromChain: opp.fromChain,
                                toChain: opp.toChain,
                                assetSymbol: opp.assetSymbol,
                                amount: 5000,
                              })
                            }
                            className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-bold uppercase tracking-wider text-[10px] h-7 px-3.5 rounded-xs cursor-pointer shadow-[0_0_6px_rgba(6,182,212,0.15)]"
                          >
                            Execute Arbitrage
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
        <TerminalExecutionModal
          isOpen={execModalOpen}
          onClose={() => setExecModalOpen(false)}
          action={execAction}
          onSuccess={handleExecutionSuccess}
        />
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string
  value: string
  helper: string
  accent?: string
}) {
  return (
    <SpotlightCard
      spotlightColor="rgba(6, 182, 212, 0.03)"
      borderColor="rgba(6, 182, 212, 0.15)"
      className="border-cyan-500/10 bg-zinc-950/45 p-5 rounded-xs corner-decor text-left"
    >
      <p className="text-[9px] font-orbitron font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className={`text-2xl font-orbitron font-black mt-3 ${accent ?? 'text-white'}`}>{value}</p>
      <p className="mt-2 text-xs text-zinc-450 font-medium leading-relaxed">{helper}</p>
    </SpotlightCard>
  )
}

function getRiskBand(score: number): { label: 'Low' | 'Medium' | 'High'; color: string } {
  if (score < 34) return { label: 'Low', color: 'text-emerald-400' }
  if (score < 67) return { label: 'Medium', color: 'text-amber-400' }
  return { label: 'High', color: 'text-rose-400' }
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value)
  let decimals = 0
  if (absValue > 0 && absValue < 1) {
    decimals = 4
  } else if (absValue > 0 && absValue < 100) {
    decimals = 2
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
