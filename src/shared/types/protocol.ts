export interface SolanaProtocol {
  slug: string
  name: string
  tvl?: number
  change_1d?: number | null
  change_7d?: number | null
  chains?: string[]
  category?: string
}

export interface TokenPrice {
  address: string
  symbol: string
  price: number
  priceChange24h: number
  volume24h?: number | null
  marketCap?: number | null
  liquidity?: number | null
}

export interface ParsedTransaction {
  signature: string
  type: string
  timestamp: number
  fee: number
  source: string
}