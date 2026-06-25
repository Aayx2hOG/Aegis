import type { ChainType } from '@/lib/chain/types'
import type { SolanaProtocol } from '@/lib/types'

export type AlertMetric = 'CHANGE_1D' | 'CHANGE_7D' | 'TVL_USD' | 'PRICE_USD'
export type AlertDirection = 'BELOW' | 'ABOVE'
export type AlertStorageMode = 'database' | 'local' | 'loading'

export interface ResearchHistoryItem {
  id: string
  protocolSlug: string
  briefMarkdown: string
  createdAt: string
}

export interface AlertRuleItem {
  id: string
  protocolSlug: string
  metric: AlertMetric
  threshold: number
  direction: AlertDirection
  enabled: boolean
  createdAt: string
}

export interface AlertEventItem {
  ruleId?: string
  id: string
  protocolSlug: string
  metric: AlertMetric
  threshold: number
  direction: AlertDirection
  currentValue: number
  triggeredAt: string
  summary?: string
  summaryGeneratedAt?: string
}

export interface AlertTestResultItem {
  id: string
  ruleId: string
  protocolSlug: string
  metric: AlertMetric
  threshold: number
  direction: AlertDirection
  currentValue: number
  triggered: boolean
  createdAt: string
  summary: string
}

export interface AlertEvaluationResultItem {
  ruleId: string
  protocolSlug: string
  metric: AlertMetric
  threshold: number
  direction: AlertDirection
  status: 'triggered' | 'skipped'
  currentValue: number | null
  reason: string
}

export type CoinGeckoResponse = {
  market_data?: {
    current_price?: {
      usd?: number | null
    }
    price_change_percentage_24h?: number | null
  }
}

export type DefiLlamaProtocolDetail = {
  slug?: string
  tokensInUsd?: Array<{ date: number; tokens?: Record<string, number> }>
  tokens?: Array<{ date: number; tokens?: Record<string, number> }>
  mcap?: number | null
  symbol?: string | null
  address?: string | null
}

export type WatchlistMarketRow = {
  slug: string
  chainName: string
  chainType: ChainType
  market?: SolanaProtocol & {
    gecko_id?: string | null
    geckoId?: string | null
  }
  geckoId: string | null
}
