import { ClusterName } from '@prisma/client'
import { prisma } from '@/server/db/prisma'
import { ChainType } from '@/lib/chain/types'
import { executeTool } from '@/server/ai/aegis-tools'
import { normalizeProtocolSlug } from '@/lib/protocol/slug-resolver'

type RiskSignal = {
  label: string
  value: number | null
  contribution: number
  rationale: string
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function numberOrNull(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function chainTypeToCluster(chainType?: ChainType) {
  if (chainType === ChainType.Solana) return ClusterName.MAINNET_BETA
  return ClusterName.MAINNET_BETA
}

function scoreTvl(tvl: number | null): RiskSignal {
  if (tvl == null) {
    return { label: 'TVL coverage', value: null, contribution: 18, rationale: 'TVL is unavailable from live sources.' }
  }

  if (tvl >= 1_000_000_000) {
    return { label: 'TVL coverage', value: tvl, contribution: 2, rationale: 'Large TVL reduces liquidity-fragility risk.' }
  }
  if (tvl >= 100_000_000) {
    return { label: 'TVL coverage', value: tvl, contribution: 8, rationale: 'Moderate TVL suggests acceptable depth.' }
  }
  return { label: 'TVL coverage', value: tvl, contribution: 18, rationale: 'Lower TVL increases liquidity-fragility risk.' }
}

function scoreChange(label: string, value: number | null, severe: number, moderate: number): RiskSignal {
  if (value == null) {
    return { label, value, contribution: 10, rationale: `${label} is unavailable from live sources.` }
  }
  if (value <= severe) {
    return { label, value, contribution: 22, rationale: `${label} shows a severe drawdown.` }
  }
  if (value <= moderate) {
    return { label, value, contribution: 12, rationale: `${label} shows a material drawdown.` }
  }
  if (value >= Math.abs(moderate)) {
    return { label, value, contribution: 3, rationale: `${label} is positive or recovering.` }
  }
  return { label, value, contribution: 6, rationale: `${label} is stable.` }
}

function scoreMarket(price: number | null, priceChange24h: number | null): RiskSignal {
  if (price == null || price <= 0) {
    return {
      label: 'Market coverage',
      value: price,
      contribution: 14,
      rationale: 'Token price is unavailable or unusable from live sources.',
    }
  }
  if (priceChange24h != null && priceChange24h <= -12) {
    return {
      label: 'Market coverage',
      value: priceChange24h,
      contribution: 18,
      rationale: 'Token market is selling off sharply over 24h.',
    }
  }
  return { label: 'Market coverage', value: price, contribution: 4, rationale: 'Live token market data is available.' }
}

function scoreActivity(recentTransactions: unknown): RiskSignal {
  if (!Array.isArray(recentTransactions)) {
    return {
      label: 'Activity coverage',
      value: null,
      contribution: 8,
      rationale: 'Recent on-chain activity could not be verified.',
    }
  }
  if (recentTransactions.length === 0) {
    return { label: 'Activity coverage', value: 0, contribution: 8, rationale: 'No recent parsed activity was found.' }
  }
  return {
    label: 'Activity coverage',
    value: recentTransactions.length,
    contribution: 2,
    rationale: 'Recent parsed activity is visible.',
  }
}

export async function buildProtocolRiskSnapshot(protocolSlug: string, chainType?: ChainType) {
  const slug = normalizeProtocolSlug(protocolSlug)
  const [tvlResult, snapshotResult] = await Promise.allSettled([
    executeTool('get_protocol_tvl', { slug }),
    executeTool('get_protocol_snapshot', { slug }),
  ])

  const tvlData = tvlResult.status === 'fulfilled' ? (tvlResult.value as Record<string, unknown>) : {}
  const snapshot = snapshotResult.status === 'fulfilled' ? (snapshotResult.value as Record<string, unknown>) : {}
  const tokenPrice = (snapshot.tokenPrice ?? snapshot.marketFallback ?? {}) as Record<string, unknown>

  const tvl = numberOrNull(tvlData.tvl)
  const change1d = numberOrNull(tvlData.change1d)
  const change7d = numberOrNull(tvlData.change7d)
  const price = numberOrNull(tokenPrice.price)
  const priceChange24h = numberOrNull(tokenPrice.priceChange24h)

  const signals: RiskSignal[] = [
    scoreTvl(tvl),
    scoreChange('24h TVL change', change1d, -10, -5),
    scoreChange('7d TVL change', change7d, -20, -12),
    scoreMarket(price, priceChange24h),
    scoreActivity(snapshot.recentTransactions),
  ]

  const score = clamp(Math.round(signals.reduce((sum, signal) => sum + signal.contribution, 0)))
  const level = score >= 70 ? 'critical' : score >= 45 ? 'elevated' : score >= 25 ? 'watch' : 'stable'

  if (prisma) {
    await prisma.protocolSnapshot.create({
      data: {
        protocolSlug: slug,
        cluster: chainTypeToCluster(chainType),
        tvlUsd: tvl,
        change1dPct: change1d,
        change7dPct: change7d,
        source: 'aegis-risk-snapshot',
      },
    })
  }

  return {
    protocolSlug: slug,
    chainType: chainType ?? ChainType.Solana,
    score,
    level,
    capturedAt: new Date().toISOString(),
    metrics: {
      tvlUsd: tvl,
      change1dPct: change1d,
      change7dPct: change7d,
      tokenPriceUsd: price,
      tokenPriceChange24hPct: priceChange24h,
    },
    signals,
    sourceHealth: {
      tvl: tvlResult.status === 'fulfilled' ? 'live' : 'unavailable',
      snapshot: snapshotResult.status === 'fulfilled' ? 'live' : 'unavailable',
    },
  }
}
