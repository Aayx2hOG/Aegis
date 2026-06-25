import type { SolanaProtocol } from '@/lib/types'
import type { AlertMetric, AlertRuleItem, AlertEventItem, DefiLlamaProtocolDetail } from './alert-types'

export type LocalAlertStore = {
  rules: AlertRuleItem[]
  events: AlertEventItem[]
  updatedAt: string
}

export const ALERT_METRIC_LABEL: Record<AlertMetric, string> = {
  CHANGE_1D: '24h change',
  CHANGE_7D: '7d change',
  TVL_USD: 'TVL',
  PRICE_USD: 'Token Price',
}

const LOCAL_ALERT_STORAGE_PREFIX = 'aegis-alerts:'

function getLocalAlertStorageKey(walletAddress: string) {
  return `${LOCAL_ALERT_STORAGE_PREFIX}${walletAddress}`
}

export function createLocalAlertId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function readLocalAlertStore(walletAddress: string): LocalAlertStore {
  if (typeof window === 'undefined') {
    return { rules: [], events: [], updatedAt: new Date().toISOString() }
  }

  try {
    const raw = window.localStorage.getItem(getLocalAlertStorageKey(walletAddress))
    if (!raw) return { rules: [], events: [], updatedAt: new Date().toISOString() }

    const parsed = JSON.parse(raw) as Partial<LocalAlertStore>
    return {
      rules: Array.isArray(parsed.rules) ? (parsed.rules as AlertRuleItem[]) : [],
      events: Array.isArray(parsed.events) ? (parsed.events as AlertEventItem[]) : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return { rules: [], events: [], updatedAt: new Date().toISOString() }
  }
}

export function writeLocalAlertStore(walletAddress: string, store: LocalAlertStore) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(getLocalAlertStorageKey(walletAddress), JSON.stringify(store))
  } catch {
    console.error('Failed to save local alerts')
  }
}

export function formatAlertValue(metric: AlertMetric, value: number): string {
  if (metric === 'TVL_USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }
  if (metric === 'PRICE_USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value)
  }
  return `${value.toFixed(2)}%`
}

export function buildLocalAlertSummary(rule: AlertRuleItem, currentValue: number) {
  const metricLabel = ALERT_METRIC_LABEL[rule.metric]
  const relationLabel = currentValue === rule.threshold ? 'equal to' : currentValue < rule.threshold ? 'below' : 'above'
  const formattedVal = formatAlertValue(rule.metric, currentValue)
  const formattedThreshold = formatAlertValue(rule.metric, rule.threshold)
  return `${rule.protocolSlug} ${metricLabel} is ${formattedVal}, which is ${relationLabel} ${formattedThreshold}.`
}

export function getLocalCurrentValueForRule(rule: AlertRuleItem, market?: SolanaProtocol, price?: number | null) {
  if (rule.metric === 'TVL_USD') return market?.tvl ?? null
  if (rule.metric === 'PRICE_USD') return price ?? null
  if (!market) return null
  return rule.metric === 'CHANGE_7D' ? (market.change_7d ?? null) : (market.change_1d ?? null)
}

export function isLocalAlertTriggered(rule: AlertRuleItem, currentValue: number) {
  return rule.direction === 'BELOW' ? currentValue <= rule.threshold : currentValue >= rule.threshold
}

export function normalizeAlertEvents(events: AlertEventItem[]) {
  const deduped = new Map<string, AlertEventItem>()

  events
    .slice()
    .sort((left, right) => new Date(right.triggeredAt).getTime() - new Date(left.triggeredAt).getTime())
    .forEach((event) => {
      const key =
        event.ruleId ?? `${event.protocolSlug}:${event.metric}:${event.direction}:${event.threshold.toFixed(4)}`
      if (!deduped.has(key)) {
        deduped.set(key, event)
      }
    })

  return Array.from(deduped.values())
}

export function getLatestTokenPriceFromProtocolDetail(detail?: DefiLlamaProtocolDetail): number | null {
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
