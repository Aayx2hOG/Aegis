'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Suspense, useEffect, useMemo, useState } from 'react'
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
import { resolveProtocolFromList } from '@/lib/protocol/slug-resolver'
import { useWatchlist } from '@/lib/hooks/use-watchlist'
import { useChainProtocols } from '@/lib/hooks/use-defillama'
import { Loader2 } from 'lucide-react'
import { useAtom } from 'jotai'
import { beginnerModeAtom } from '@/lib/store/research-store'
import { DeFiTooltip, BeginnerOnboardingCard } from '@/components/ui/defi-helper'
import { Meteors } from '@/components/ui/meteors'
import { Sparkles } from '@/components/ui/sparkles'

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
]

const NATIVE_ASSETS_BY_CHAIN: Record<ChainType, { symbol: string; priceUsd: number }> = {
  [ChainType.Solana]: { symbol: 'SOL', priceUsd: 150 },
  [ChainType.Ethereum]: { symbol: 'ETH', priceUsd: 3500 },
  [ChainType.Arbitrum]: { symbol: 'ETH', priceUsd: 3500 },
  [ChainType.Optimism]: { symbol: 'ETH', priceUsd: 3500 },
  [ChainType.Base]: { symbol: 'ETH', priceUsd: 3500 },
  [ChainType.Polygon]: { symbol: 'MATIC', priceUsd: 0.7 },
  [ChainType.Cosmos]: { symbol: 'ATOM', priceUsd: 7 },
}

const CHAIN_BY_NATIVE_SYMBOL = Object.entries(NATIVE_ASSETS_BY_CHAIN).reduce<Record<string, ChainType[]>>(
  (acc, [chain, asset]) => {
    acc[asset.symbol] = [...(acc[asset.symbol] ?? []), chain as ChainType]
    return acc
  },
  {},
)

function formatPrice(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'unavailable'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 2 : 4,
  }).format(value)
}

type LocalMitigationAction = {
  action: 'move' | 'liquidate' | 'increase' | 'arbitrage' | 'hedge'
  fromChain?: ChainType | string
  toChain?: ChainType | string
  assetSymbol: string
  protocol?: string
  amount: number
}

const RELEVANT_HOLDING_CATEGORIES = new Set([
  'AMM',
  'Bridge',
  'CDP',
  'Derivatives',
  'Dexs',
  'Farm',
  'Insurance',
  'Lending',
  'Liquidity Layer',
  'Liquid Restaking',
  'Liquid Staking',
  'Orderbook',
  'Options',
  'Perpetuals',
  'Restaking',
  'Stablecoin',
  'Staking',
  'Staking Pool',
  'Synthetic Assets',
  'Vault',
  'Yield',
  'Yield Aggregator',
])

const EXCLUDED_HOLDING_CATEGORIES = new Set([
  'CEX',
  'CeFi',
  'Centralized Exchange',
  'Indexes',
  'Portfolio Tracker',
  'Risk Curators',
  'Wallet',
])

const ALL_CHAIN_TYPES = Object.values(ChainType)

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

      <div className="relative w-full h-[140px] bg-zinc-950 rounded-xs border border-zinc-900 flex items-center justify-center overflow-hidden">
        <Sparkles id="bridge-sparkles" particleDensity={25} minSize={0.4} maxSize={1.0} particleColor="#06b6d4" className="opacity-30" />
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

  // Resolve price
  let tokenPrice = 0
  let geckoId = data.gecko_id || data.geckoId || protocolSlug
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
  const [simpleMode, setSimpleMode] = useAtom(beginnerModeAtom)
  const searchParams = useSearchParams()

  // Watchlist
  const { watchlist } = useWatchlist()
  const [isImportingWatchlist, setIsImportingWatchlist] = useState(false)

  // Multichain states
  const [multichainPositions, setMultichainPositions] = useState<ChainPortfolioPosition[]>(DEFAULT_MULTICHAIN_POSITIONS)
  const [selectedMultichainScenarioIdx, setSelectedMultichainScenarioIdx] = useState(0)

  // Custom Scenario state
  const [useCustomScenario, setUseCustomScenario] = useState(false)
  const [selectedCustomSeverity, setSelectedCustomSeverity] = useState<'Mild' | 'Moderate' | 'Severe' | null>(null)
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
  const [expandedHoldingRows, setExpandedHoldingRows] = useState<Set<number>>(() => new Set())

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

  function applyLocalMitigation(action: LocalMitigationAction) {
    let changed = false
    setMultichainPositions((current) => {
      return current.map((pos) => {
        const isMatch = pos.symbol.toLowerCase() === action.assetSymbol.toLowerCase() && pos.chain === action.fromChain
        if (isMatch) {
          changed = true
          if (action.action === 'liquidate') {
            const reductionRatio = Math.min(1, action.amount / Math.max(pos.balance, 1))
            return {
              ...pos,
              balance: Math.max(0, pos.balance - action.amount),
              usdValue: Math.max(0, pos.usdValue * (1 - reductionRatio)),
            }
          }
          if (action.action === 'move') {
            return {
              ...pos,
              chain: (action.toChain as ChainType) || pos.chain,
              protocol: action.protocol || pos.protocol,
              volatility: Math.max(5, pos.volatility - 15),
              liquidityScore: Math.min(100, pos.liquidityScore + 10),
            }
          }
          if (action.action === 'increase' || action.action === 'hedge') {
            return {
              ...pos,
              volatility: Math.max(5, pos.volatility - 10),
              liquidityScore: Math.min(100, pos.liquidityScore + 8),
            }
          }
        }
        return pos
      })
    })
    setMultichainResult(null)
    if (action.action === 'arbitrage') {
      setMultichainImportStatus(
        `Arbitrage opportunity noted for ${action.assetSymbol}. No portfolio balance changed because this simulator does not execute trades.`,
      )
    } else {
      setMultichainImportStatus(
        changed
          ? `Applied local ${action.action} adjustment for ${action.assetSymbol}. Re-run the simulation to compare risk.`
          : `No matching ${action.assetSymbol} position found on ${action.fromChain ?? 'the selected source chain'}.`,
      )
    }
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
    symbol: NATIVE_ASSETS_BY_CHAIN[ChainType.Solana].symbol,
    protocol: '',
    usdValue: 0,
    balance: 0,
    volatility: 50,
    liquidityScore: 80,
  })
  const [newPosUnitPrice, setNewPosUnitPrice] = useState(NATIVE_ASSETS_BY_CHAIN[ChainType.Solana].priceUsd)
  const [newPosPriceStatus, setNewPosPriceStatus] = useState('Using SOL reference price.')
  const { data: customChainProtocols = [], isLoading: customProtocolsLoading } = useChainProtocols(newPosForm.chain)

  const nativeSymbolOptions = useMemo(() => Object.keys(CHAIN_BY_NATIVE_SYMBOL), [])
  const customProtocolOptions = useMemo(
    () =>
      customChainProtocols
        .map((protocol) => ({
          slug: protocol.slug,
          label: protocol.name || protocol.slug,
          category: protocol.category ?? 'Protocol',
          tvl: protocol.tvl ?? 0,
        }))
        .filter((protocol) => protocol.slug)
        .filter((protocol) => {
          const category = protocol.category.trim()
          if (EXCLUDED_HOLDING_CATEGORIES.has(category)) return false
          return RELEVANT_HOLDING_CATEGORIES.has(category) || category === 'Protocol' || category === 'Uncategorized'
        })
        .sort((left, right) => right.tvl - left.tvl),
    [customChainProtocols],
  )
  const selectedProtocolOption = useMemo(
    () => customProtocolOptions.find((protocol) => protocol.slug === newPosForm.protocol),
    [customProtocolOptions, newPosForm.protocol],
  )
  const activeScenario = useMemo(
    () => (useCustomScenario ? customScenario : MULTICHAIN_SCENARIOS[selectedMultichainScenarioIdx]),
    [customScenario, selectedMultichainScenarioIdx, useCustomScenario],
  )
  const portfolioInsights = useMemo(() => {
    const totalValue = multichainPositions.reduce((acc, position) => acc + position.usdValue, 0)
    const chainTotals = multichainPositions.reduce<Partial<Record<ChainType, number>>>((acc, position) => {
      acc[position.chain] = (acc[position.chain] ?? 0) + position.usdValue
      return acc
    }, {})
    const topChain = Object.entries(chainTotals).sort(([, left], [, right]) => right - left)[0]
    const largestPosition = [...multichainPositions].sort((left, right) => right.usdValue - left.usdValue)[0]
    const concentrationPct = totalValue > 0 && largestPosition ? (largestPosition.usdValue / totalValue) * 100 : 0
    const scenarioSeverity = Math.round(
      (activeScenario.marketShockPct +
        activeScenario.liquidityDropPct +
        activeScenario.protocolExploitSeverity +
        Math.min(activeScenario.oracleDelayMinutes, 120) / 1.2 +
        Math.min(activeScenario.bridgeOutageDurationMinutes ?? 0, 1440) / 14.4) /
        5,
    )

    return {
      totalValue,
      chainCount: Object.keys(chainTotals).length,
      protocolCount: new Set(multichainPositions.map((position) => position.protocol)).size,
      topChain: topChain ? (topChain[0] as ChainType) : null,
      topChainValue: topChain?.[1] ?? 0,
      largestPosition,
      concentrationPct,
      scenarioSeverity,
    }
  }, [activeScenario, multichainPositions])
  const groupedHoldings = useMemo(() => {
    const groups = new Map<
      ChainType,
      {
        chain: ChainType
        totalValue: number
        positions: Array<ChainPortfolioPosition & { originalIndex: number }>
      }
    >()

    multichainPositions.forEach((position, originalIndex) => {
      const group = groups.get(position.chain) ?? { chain: position.chain, totalValue: 0, positions: [] }
      group.totalValue += position.usdValue
      group.positions.push({ ...position, originalIndex })
      groups.set(position.chain, group)
    })

    return Array.from(groups.values()).sort((left, right) => right.totalValue - left.totalValue)
  }, [multichainPositions])

  function updateCustomScenario(values: Partial<ChainScenarioConfig>, source: 'preset' | 'manual' = 'manual') {
    if (source === 'manual') setSelectedCustomSeverity(null)
    setCustomScenario((current) => ({ ...current, ...values }))
  }

  useEffect(() => {
    const nativeAsset = NATIVE_ASSETS_BY_CHAIN[newPosForm.chain]
    if (newPosForm.symbol !== nativeAsset.symbol) {
      setNewPosForm((current) => ({ ...current, symbol: nativeAsset.symbol }))
    }
    setNewPosUnitPrice(nativeAsset.priceUsd)
    setNewPosPriceStatus(`Using ${nativeAsset.symbol} reference price until a protocol price resolves.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPosForm.chain])

  useEffect(() => {
    if (customProtocolOptions.length === 0) return
    const currentStillAvailable = customProtocolOptions.some((protocol) => protocol.slug === newPosForm.protocol)
    if (!currentStillAvailable) {
      setNewPosForm((current) => ({ ...current, protocol: customProtocolOptions[0].slug }))
    }
  }, [customProtocolOptions, newPosForm.protocol])

  useEffect(() => {
    setNewPosForm((current) => ({
      ...current,
      usdValue: Math.round(current.balance * newPosUnitPrice * 100) / 100,
    }))
  }, [newPosUnitPrice])

  useEffect(() => {
    if (!newPosForm.protocol) return

    let active = true
    async function resolveSelectedProtocolPrice() {
      const nativeAsset = NATIVE_ASSETS_BY_CHAIN[newPosForm.chain]
      setNewPosPriceStatus(`Resolving ${newPosForm.protocol} price for ${newPosForm.chain}...`)

      try {
        const positions = await fetchAndBuildPositions(newPosForm.protocol)
        if (!active) return
        const chainPosition = positions.find((position) => position.chain === newPosForm.chain)
        const unitPrice =
          chainPosition && chainPosition.balance > 0
            ? chainPosition.usdValue / chainPosition.balance
            : nativeAsset.priceUsd

        setNewPosUnitPrice(unitPrice)
        setNewPosForm((current) => ({
          ...current,
          kind: chainPosition?.kind ?? current.kind,
          volatility: chainPosition?.volatility ?? current.volatility,
          liquidityScore: chainPosition?.liquidityScore ?? current.liquidityScore,
          usdValue: Math.round(current.balance * unitPrice * 100) / 100,
        }))
        setNewPosPriceStatus(
          chainPosition
            ? `${selectedProtocolOption?.label ?? newPosForm.protocol} unit price resolved at ${formatPrice(unitPrice)}.`
            : `No chain-specific token price found. Using ${nativeAsset.symbol} reference price ${formatPrice(unitPrice)}.`,
        )
      } catch (err) {
        if (!active) return
        const fallbackPrice = nativeAsset.priceUsd
        setNewPosUnitPrice(fallbackPrice)
        setNewPosPriceStatus(`Price lookup failed. Using ${nativeAsset.symbol} reference price ${formatPrice(fallbackPrice)}.`)
        console.error('Failed to resolve selected protocol price:', err)
      }
    }

    void resolveSelectedProtocolPrice()
    return () => {
      active = false
    }
  }, [newPosForm.chain, newPosForm.protocol, selectedProtocolOption?.label])

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
    setExpandedHoldingRows((current) => {
      const next = new Set<number>()
      current.forEach((rowIndex) => {
        if (rowIndex < index) next.add(rowIndex)
        if (rowIndex > index) next.add(rowIndex - 1)
      })
      return next
    })
    setMultichainResult(null)
  }

  function toggleHoldingAdvanced(index: number) {
    setExpandedHoldingRows((current) => {
      const next = new Set(current)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function addMultichainPosition() {
    if (!newPosForm.symbol.trim() || !newPosForm.protocol.trim() || newPosForm.balance <= 0) {
      setMultichainImportStatus('Select a symbol, choose a protocol, and enter a balance greater than 0.')
      return
    }

    const derivedUsdValue = Math.round(newPosForm.balance * newPosUnitPrice * 100) / 100
    const newPos: ChainPortfolioPosition = {
      chain: newPosForm.chain,
      kind: newPosForm.kind,
      symbol: newPosForm.symbol.trim().toUpperCase(),
      protocol: newPosForm.protocol.trim().toLowerCase(),
      usdValue: derivedUsdValue,
      balance: newPosForm.balance,
      volatility: newPosForm.volatility,
      liquidityScore: newPosForm.liquidityScore,
    }

    setMultichainPositions((current) => [...current, newPos])
    setMultichainResult(null)
    setMultichainImportStatus(`Added ${newPos.symbol} on ${newPos.chain}.`)
    setNewPosForm({
      chain: ChainType.Solana,
      kind: 'token',
      symbol: NATIVE_ASSETS_BY_CHAIN[ChainType.Solana].symbol,
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
      {simpleMode && (
        <BeginnerOnboardingCard
          title="War Room quick start"
          steps={[
            'Start with the demo portfolio or import your watchlist. This is only a simulation, not a real trade.',
            'Pick a preset scenario to ask: what happens if prices fall, liquidity dries up, or bridges stop working?',
            'Run the simulation and read the risk score. Higher scores mean the portfolio is more fragile.',
            'Use the recommended actions as what-if changes, then run the simulation again to compare before and after.',
            'Use Custom Scenario only when you want to manually adjust the stress assumptions.'
          ]}
        />
      )}
      <header className="space-y-4 text-left">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Badge
            variant="accent"
            className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-orbitron font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)] bg-cyan-950/20 text-cyan-400 border-cyan-500/20"
          >
            Portfolio stress simulator
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

      <div className="space-y-8 animate-in fade-in duration-500 text-left">
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
            <p className="mt-2 text-2xl font-semibold capitalize text-white">
              {portfolioInsights.topChain ?? 'N/A'}
            </p>
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
              {useCustomScenario ? 'Custom parameters' : MULTICHAIN_SCENARIO_INFO[selectedMultichainScenarioIdx].title}
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-[10px] font-orbitron font-bold uppercase tracking-widest text-zinc-500">
            Simulation workflow
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <SpotlightCard
              spotlightColor="rgba(6, 182, 212, 0.03)"
              borderColor="rgba(6, 182, 212, 0.15)"
              className="border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs corner-decor"
            >
              <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-550">Step 01</p>
              <p className="mt-2 text-sm font-orbitron font-bold text-white uppercase tracking-wider">
                Set holdings
              </p>
              <p className="mt-1 text-xs text-zinc-450 leading-relaxed font-medium">
                Add tokens or protocols you want to test. You can use the demo portfolio if you are exploring.
              </p>
            </SpotlightCard>
            <SpotlightCard
              spotlightColor="rgba(6, 182, 212, 0.03)"
              borderColor="rgba(6, 182, 212, 0.15)"
              className="border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs corner-decor"
            >
              <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-550">Step 02</p>
              <p className="mt-2 text-sm font-orbitron font-bold text-white uppercase tracking-wider">
                Pick a stress case
              </p>
              <p className="mt-1 text-xs text-zinc-450 leading-relaxed font-medium">
                Choose a preset like a market crash, bridge outage, or network freeze.
              </p>
            </SpotlightCard>
            <SpotlightCard
              spotlightColor="rgba(6, 182, 212, 0.03)"
              borderColor="rgba(6, 182, 212, 0.15)"
              className="border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs corner-decor"
            >
              <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-550">Step 03</p>
              <p className="mt-2 text-sm font-orbitron font-bold text-white uppercase tracking-wider">
                Compare outcomes
              </p>
              <p className="mt-1 text-xs text-zinc-450 leading-relaxed font-medium">
                Review the risk score, try suggested changes, and rerun the simulation.
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
                  Portfolio holdings
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
                Total value: {formatCurrency(multichainPositions.reduce((acc, p) => acc + p.usdValue, 0))}
              </span>
            </div>

            {multichainPositions.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xs border border-dashed border-zinc-800 bg-zinc-950/20 font-mono text-zinc-550">
                <p className="text-xs font-semibold">No holdings added yet.</p>
                <p className="text-[10px] mt-1">
                  Click &quot;Reset to Demo Portfolio&quot; below to load pre-configured assets.
                </p>
              </div>
            ) : (
              <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1 text-xs">
                {groupedHoldings.map((group) => (
                  <div key={group.chain} className="rounded-lg border border-zinc-900 bg-zinc-950/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 px-3.5 py-2.5">
                      <div>
                        <p className="text-sm font-semibold capitalize text-white">{group.chain}</p>
                        <p className="text-[10px] text-zinc-500">
                          {group.positions.length} holding{group.positions.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <p className="font-mono text-xs font-bold text-cyan-300">{formatCurrency(group.totalValue)}</p>
                    </div>

                    <div className="divide-y divide-zinc-900">
                      {group.positions.map((pos) => {
                        const isAdvancedOpen = expandedHoldingRows.has(pos.originalIndex)

                        return (
                          <div key={`${pos.chain}-${pos.symbol}-${pos.originalIndex}`} className="p-3.5">
                            <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-12">
                              <div className="md:col-span-4 text-left">
                                <p className="text-sm font-semibold text-white">{pos.symbol}</p>
                                <p className="mt-1 text-[10px] uppercase tracking-wider text-cyan-500">
                                  {pos.protocol} • {pos.kind}
                                </p>
                              </div>
                              <div className="md:col-span-2 text-left">
                                <label className="mb-1 block text-[10px] font-medium text-zinc-500">Balance</label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={pos.balance}
                                  onChange={(e) =>
                                    updateMultichainPositionBalance(pos.originalIndex, Number(e.target.value))
                                  }
                                  className="h-8 border-zinc-900 bg-zinc-950 px-2 text-xs text-white"
                                />
                              </div>
                              <div className="md:col-span-2 text-left">
                                <label className="mb-1 block text-[10px] font-medium text-zinc-500">USD value</label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={pos.usdValue}
                                  onChange={(e) =>
                                    updateMultichainPositionField(pos.originalIndex, 'usdValue', Number(e.target.value))
                                  }
                                  className="h-8 border-zinc-900 bg-zinc-950 px-2 text-xs text-white"
                                />
                              </div>
                              <div className="flex items-center justify-end gap-2 md:col-span-4">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleHoldingAdvanced(pos.originalIndex)}
                                  className="h-8 rounded-xs border-zinc-800 bg-zinc-950 px-3 text-[10px] font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                >
                                  {isAdvancedOpen ? 'Hide Advanced' : 'Advanced'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMultichainPosition(pos.originalIndex)}
                                  className="h-8 w-8 rounded-xs p-0 text-rose-400 hover:bg-rose-500/10 hover:text-white"
                                >
                                  x
                                </Button>
                              </div>
                            </div>

                            {isAdvancedOpen && (
                              <div className="mt-3 grid gap-4 rounded-md border border-zinc-900 bg-zinc-950/60 p-3 sm:grid-cols-2">
                                <div className="text-left">
                                  <label className="mb-2 block text-[10px] font-medium text-zinc-500">
                                    {simpleMode ? <DeFiTooltip term="Volatility">Volatility</DeFiTooltip> : 'Volatility'}
                                  </label>
                                  <input
                                    type="range"
                                    min={0}
                                    max={150}
                                    value={pos.volatility}
                                    onChange={(e) =>
                                      updateMultichainPositionField(
                                        pos.originalIndex,
                                        'volatility',
                                        Number(e.target.value),
                                      )
                                    }
                                    className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-cyan-500"
                                  />
                                  <span className="mt-1 block text-[10px] font-bold text-cyan-400">
                                    {pos.volatility}% volatility
                                  </span>
                                </div>
                                <div className="text-left">
                                  <label className="mb-2 block text-[10px] font-medium text-zinc-500">
                                    {simpleMode ? (
                                      <DeFiTooltip term="Liquidity Score">Liquidity</DeFiTooltip>
                                    ) : (
                                      'Liquidity'
                                    )}
                                  </label>
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={pos.liquidityScore}
                                    onChange={(e) =>
                                      updateMultichainPositionField(
                                        pos.originalIndex,
                                        'liquidityScore',
                                        Number(e.target.value),
                                      )
                                    }
                                    className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-cyan-500"
                                  />
                                  <span className="mt-1 block text-[10px] font-bold text-cyan-400">
                                    {pos.liquidityScore} liquidity score
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xs border border-zinc-850 bg-zinc-950/20 p-4 space-y-4">
              <h3 className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400">
                Add a holding
              </h3>
              <div className="grid gap-3 grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-6 text-left text-xs font-mono">
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">Chain</label>
                  <select
                    value={newPosForm.chain}
                    onChange={(e) => {
                      const chain = e.target.value as ChainType
                      setNewPosForm({
                        ...newPosForm,
                        chain,
                        symbol: NATIVE_ASSETS_BY_CHAIN[chain].symbol,
                        protocol: '',
                      })
                    }}
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
                  <select
                    value={newPosForm.symbol}
                    onChange={(e) => {
                      const symbol = e.target.value
                      const preferredChain = CHAIN_BY_NATIVE_SYMBOL[symbol]?.[0] ?? newPosForm.chain
                      setNewPosForm({
                        ...newPosForm,
                        symbol,
                        chain: preferredChain,
                        protocol: '',
                      })
                    }}
                    className="flex h-9 w-full rounded-xs border border-zinc-850 bg-zinc-950 px-3 py-1 text-xs shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono"
                  >
                    {nativeSymbolOptions.map((symbol) => (
                      <option key={symbol} value={symbol} className="bg-zinc-950 text-white font-mono">
                        {symbol}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">Protocol</label>
                  <select
                    value={newPosForm.protocol}
                    onChange={(e) => setNewPosForm({ ...newPosForm, protocol: e.target.value })}
                    disabled={customProtocolsLoading || customProtocolOptions.length === 0}
                    className="flex h-9 w-full rounded-xs border border-zinc-850 bg-zinc-950 px-3 py-1 text-xs shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono disabled:opacity-60"
                  >
                    <option value="" className="bg-zinc-950 text-zinc-400">
                      {customProtocolsLoading
                        ? 'Loading...'
                        : customProtocolOptions.length === 0
                          ? 'No protocols'
                          : 'Select protocol'}
                    </option>
                    {customProtocolOptions.slice(0, 250).map((protocol) => (
                      <option key={protocol.slug} value={protocol.slug} className="bg-zinc-950 text-white font-mono">
                        {protocol.label} ({protocol.category})
                      </option>
                    ))}
                  </select>
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
                        usdValue: Math.round(val * newPosUnitPrice * 100) / 100,
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
                    readOnly
                    value={newPosForm.usdValue || ''}
                    className="h-9 text-xs bg-zinc-950/60 border-zinc-850 font-mono text-cyan-300"
                  />
                </div>
              </div>
              <div className="grid gap-3 rounded-xs border border-cyan-500/10 bg-cyan-950/5 p-3 text-[10px] text-zinc-400 sm:grid-cols-3">
                <div>
                  <p className="font-mono uppercase tracking-wider text-zinc-550">Protocol source</p>
                  <p className="mt-1 font-semibold text-zinc-200">
                    {customProtocolsLoading
                      ? 'Loading chain catalog...'
                      : `${customProtocolOptions.length.toLocaleString()} ${newPosForm.chain} protocols available`}
                  </p>
                </div>
                <div>
                  <p className="font-mono uppercase tracking-wider text-zinc-550">Estimated unit price</p>
                  <p className="mt-1 font-semibold text-cyan-300">{formatPrice(newPosUnitPrice)}</p>
                </div>
                <div>
                  <p className="font-mono uppercase tracking-wider text-zinc-550">Pricing note</p>
                  <p className="mt-1 leading-relaxed text-zinc-300">{newPosPriceStatus}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMultichainPositions(DEFAULT_MULTICHAIN_POSITIONS)
                    setMultichainResult(null)
                    setMultichainImportStatus('Reset portfolio to demo layout.')
                  }}
                  className="text-zinc-400 border-zinc-850 bg-zinc-950 hover:bg-zinc-900 font-mono rounded-xs text-xs w-full sm:w-auto"
                >
                  Reset to Demo Portfolio
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={addMultichainPosition}
                  className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-bold uppercase tracking-wider rounded-xs shadow-[0_0_8px_rgba(6,182,212,0.2)] w-full sm:w-auto"
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
                Stress scenario
              </h2>
              <button
                type="button"
                onClick={() => setSimpleMode(!simpleMode)}
                className={`rounded-xs px-3 py-1 text-[8px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 ${simpleMode
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                    : 'bg-zinc-950 border-zinc-850 text-zinc-500 hover:text-zinc-350'
                  }`}
              >
                {simpleMode ? 'Beginner Help On' : 'Beginner Help Off'}
              </button>
            </div>

            <div className="flex border-b border-cyan-500/10 pb-1.5 gap-2">
              <button
                type="button"
                onClick={() => setUseCustomScenario(false)}
                className={`flex-1 text-center py-1.5 text-[10px] font-orbitron font-bold uppercase tracking-wider border transition-all ${!useCustomScenario
                    ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-400 font-black'
                    : 'bg-zinc-950/30 border-transparent text-zinc-500 hover:text-zinc-350'
                  }`}
              >
                Presets
              </button>
              <button
                type="button"
                onClick={() => setUseCustomScenario(true)}
                className={`flex-1 text-center py-1.5 text-[10px] font-orbitron font-bold uppercase tracking-wider border transition-all ${useCustomScenario
                    ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-400 font-black'
                    : 'bg-zinc-950/30 border-transparent text-zinc-500 hover:text-zinc-350'
                  }`}
              >
                Custom Scenario
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
                      className={`w-full rounded-xs px-3.5 py-3 text-left transition border ${idx === selectedMultichainScenarioIdx
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
                <div className="rounded-md border border-cyan-500/10 bg-cyan-950/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Quick severity</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                    Start with a realistic level, then fine-tune any slider below.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      {
                        label: 'Mild',
                        config: {
                          marketShockPct: 10,
                          liquidityDropPct: 15,
                          protocolExploitSeverity: 5,
                          oracleDelayMinutes: 2,
                          bridgeOutageDurationMinutes: 0,
                        },
                      },
                      {
                        label: 'Moderate',
                        config: {
                          marketShockPct: 25,
                          liquidityDropPct: 35,
                          protocolExploitSeverity: 20,
                          oracleDelayMinutes: 10,
                          bridgeOutageDurationMinutes: 30,
                        },
                      },
                      {
                        label: 'Severe',
                        config: {
                          marketShockPct: 45,
                          liquidityDropPct: 60,
                          protocolExploitSeverity: 45,
                          oracleDelayMinutes: 25,
                          bridgeOutageDurationMinutes: 120,
                        },
                      },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setSelectedCustomSeverity(preset.label as 'Mild' | 'Moderate' | 'Severe')
                          updateCustomScenario(preset.config, 'preset')
                        }}
                        aria-pressed={selectedCustomSeverity === preset.label}
                        className={`rounded-xs border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                          selectedCustomSeverity === preset.label
                            ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.12)]'
                            : 'border-zinc-850 bg-zinc-950 text-zinc-400 hover:border-cyan-500/30 hover:text-cyan-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-zinc-400">
                      {simpleMode ? (
                        <DeFiTooltip term="Market Shock">MARKET SHOCK</DeFiTooltip>
                      ) : (
                        'MARKET SHOCK'
                      )}
                    </span>
                    <span className="text-cyan-400">-{customScenario.marketShockPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={customScenario.marketShockPct}
                    onChange={(e) => updateCustomScenario({ marketShockPct: Number(e.target.value) })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <p className="text-[10px] leading-relaxed text-zinc-500">How much broad market prices fall.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-zinc-400">
                      {simpleMode ? (
                        <DeFiTooltip term="Liquidity Score">LIQUIDITY DROP</DeFiTooltip>
                      ) : (
                        'LIQUIDITY DROP'
                      )}
                    </span>
                    <span className="text-cyan-400">-{customScenario.liquidityDropPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={customScenario.liquidityDropPct}
                    onChange={(e) => updateCustomScenario({ liquidityDropPct: Number(e.target.value) })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <p className="text-[10px] leading-relaxed text-zinc-500">
                    How much harder it becomes to exit positions without slippage.
                  </p>
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
                      updateCustomScenario({ protocolExploitSeverity: Number(e.target.value) })
                    }
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <p className="text-[10px] leading-relaxed text-zinc-500">
                    Extra protocol/smart-contract stress applied to DeFi positions.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-zinc-400">
                      {simpleMode ? (
                        <DeFiTooltip term="Oracle Delay">ORACLE DELAY</DeFiTooltip>
                      ) : (
                        'ORACLE DELAY'
                      )}
                    </span>
                    <span className="text-cyan-400">{customScenario.oracleDelayMinutes} mins</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={120}
                    step={1}
                    value={customScenario.oracleDelayMinutes}
                    onChange={(e) =>
                      updateCustomScenario({ oracleDelayMinutes: Number(e.target.value) })
                    }
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <p className="text-[10px] leading-relaxed text-zinc-500">
                    How stale price feeds become during the stress event.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-[10px] font-bold">
                    <span className="text-zinc-400">
                      {simpleMode ? (
                        <DeFiTooltip term="Bridge Outage">BRIDGE OUTAGE DURATION</DeFiTooltip>
                      ) : (
                        'BRIDGE OUTAGE DURATION'
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={1440}
                        step={5}
                        value={customScenario.bridgeOutageDurationMinutes}
                        onChange={(e) =>
                          updateCustomScenario({
                            bridgeOutageDurationMinutes: Math.min(1440, Math.max(0, Number(e.target.value))),
                          })
                        }
                        className="h-7 w-20 border-zinc-850 bg-zinc-950 px-2 text-right text-[10px] text-cyan-300"
                      />
                      <span className="text-cyan-400">mins</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1440}
                    step={5}
                    value={customScenario.bridgeOutageDurationMinutes}
                    onChange={(e) =>
                      updateCustomScenario({ bridgeOutageDurationMinutes: Number(e.target.value) })
                    }
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <div className="flex flex-wrap gap-2">
                    {[0, 5, 15, 30, 60, 180].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => updateCustomScenario({ bridgeOutageDurationMinutes: minutes })}
                        className={`rounded-xs border px-2 py-1 text-[9px] font-semibold transition ${
                          customScenario.bridgeOutageDurationMinutes === minutes
                            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                            : 'border-zinc-850 bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {minutes === 0 ? 'None' : `${minutes}m`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] leading-relaxed text-zinc-500">
                    How long cross-chain exits are blocked. Small values like 5 or 15 minutes are now supported.
                  </p>
                </div>

                <div className="space-y-2 border-t border-zinc-900 pt-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-550">
                      Chains Affected
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateCustomScenario({ chainsAffected: ALL_CHAIN_TYPES })}
                        className="text-[9px] font-semibold uppercase tracking-wider text-cyan-400 hover:text-cyan-300"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCustomScenario({ chainsAffected: [] })}
                        className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {ALL_CHAIN_TYPES.map((c) => {
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
                              updateCustomScenario({ chainsAffected: newChains })
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
                    onClick={() => {
                      setSelectedCustomSeverity(null)
                      updateCustomScenario(
                        {
                          marketShockPct: 0,
                          liquidityDropPct: 0,
                          protocolExploitSeverity: 0,
                          oracleDelayMinutes: 0,
                          bridgeOutageDurationMinutes: 0,
                          chainsAffected: [...ALL_CHAIN_TYPES],
                        },
                        'preset',
                      )
                    }}
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
              {multichainLoading ? 'Running simulation...' : 'Run Simulation'}
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
                className="relative overflow-hidden border border-cyan-500/20 bg-zinc-950/90 p-5 rounded-xs font-mono text-xs text-left"
              >
                <Meteors number={10} />
                <div className="relative z-10 flex items-center gap-2 border-b border-cyan-500/10 pb-2 mb-3">
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
                              applyLocalMitigation({
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
                            Apply{' '}
                            {rec.action === 'move'
                              ? 'Move Model'
                              : rec.action === 'liquidate'
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
                              applyLocalMitigation({
                                action: 'arbitrage',
                                fromChain: opp.fromChain,
                                toChain: opp.toChain,
                                assetSymbol: opp.assetSymbol,
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
        )}
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
