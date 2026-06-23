import { ChainType } from '@/lib/chain/types'
import type { ChainPortfolioPosition, ChainScenarioConfig } from '@/lib/types'

export const DEFAULT_MULTICHAIN_POSITIONS: ChainPortfolioPosition[] = [
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

export type PortfolioInputSource = 'empty' | 'demo' | 'watchlist' | 'protocol' | 'manual'

export const NATIVE_ASSETS_BY_CHAIN: Record<ChainType, { symbol: string; priceUsd: number }> = {
  [ChainType.Solana]: { symbol: 'SOL', priceUsd: 0 },
  [ChainType.Ethereum]: { symbol: 'ETH', priceUsd: 0 },
  [ChainType.Arbitrum]: { symbol: 'ETH', priceUsd: 0 },
  [ChainType.Optimism]: { symbol: 'ETH', priceUsd: 0 },
  [ChainType.Base]: { symbol: 'ETH', priceUsd: 0 },
  [ChainType.Polygon]: { symbol: 'MATIC', priceUsd: 0 },
  [ChainType.Cosmos]: { symbol: 'ATOM', priceUsd: 0 },
}

export const CHAIN_BY_NATIVE_SYMBOL = Object.entries(NATIVE_ASSETS_BY_CHAIN).reduce<Record<string, ChainType[]>>(
  (acc, [chain, asset]) => {
    acc[asset.symbol] = [...(acc[asset.symbol] ?? []), chain as ChainType]
    return acc
  },
  {},
)

export const ALL_CHAIN_TYPES = Object.values(ChainType)

export const MULTICHAIN_SCENARIOS: ChainScenarioConfig[] = [
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

export const MULTICHAIN_SCENARIO_INFO = [
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
