export type OpportunityProfile = 'conservative' | 'balanced' | 'aggressive'

export interface OpportunityInput {
  slug: string
  name: string
  category?: string
  tvl: number
  change1d?: number | null
  change7d?: number | null
  apy?: number | null
  audits?: string | null
}

export interface OpportunityScore extends OpportunityInput {
  rank: number
  score: number
  stabilityScore: number
  momentumScore: number
  scaleScore: number
  yieldScore: number
  stabilityBand: 'Stable' | 'Mixed' | 'Volatile'
  dataCompleteness: number
  contributions: {
    scale: number
    stability: number
    momentum: number
    yield: number
  }
}

export type OpportunityWeights = {
  scale: number
  stability: number
  momentum: number
  yield: number
}

export const PROFILE_WEIGHTS: Readonly<Record<OpportunityProfile, OpportunityWeights>> = {
  conservative: { scale: 0.45, stability: 0.4, momentum: 0.1, yield: 0.05 },
  balanced: { scale: 0.3, stability: 0.25, momentum: 0.25, yield: 0.2 },
  aggressive: { scale: 0.15, stability: 0.15, momentum: 0.4, yield: 0.3 },
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function normalize(value: number, values: number[]) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return 50
  return ((value - min) / (max - min)) * 100
}

function finite(value: number | null | undefined, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10
}

export function scoreOpportunities(protocols: OpportunityInput[], profile: OpportunityProfile): OpportunityScore[] {
  if (protocols.length === 0) return []

  const weights = PROFILE_WEIGHTS[profile]
  const logTvls = protocols.map((protocol) => Math.log10(Math.max(protocol.tvl, 1)))
  const momentums = protocols.map((protocol) => finite(protocol.change7d) * 0.7 + finite(protocol.change1d) * 0.3)
  const yields = protocols.map((protocol) => finite(protocol.apy))

  const scored = protocols.map((protocol, index) => {
    const oneDay = finite(protocol.change1d)
    const sevenDay = finite(protocol.change7d)
    const scaleScore = normalize(logTvls[index], logTvls)
    const momentumScore = normalize(momentums[index], momentums)
    const yieldScore = protocol.apy == null ? 0 : normalize(yields[index], yields)
    const volatilityProxy = Math.abs(oneDay) + Math.abs(sevenDay - oneDay) * 0.5
    const stabilityScore = clamp(100 - volatilityProxy * 4)
    const score = clamp(
      scaleScore * weights.scale +
        stabilityScore * weights.stability +
        momentumScore * weights.momentum +
        yieldScore * weights.yield,
    )
    const dataPoints = [protocol.tvl > 0, protocol.change1d != null, protocol.change7d != null, protocol.apy != null]
    const dataCompleteness = Math.round((dataPoints.filter(Boolean).length / dataPoints.length) * 100)

    return {
      ...protocol,
      rank: 0,
      score: Math.round(score),
      scaleScore: Math.round(scaleScore),
      momentumScore: Math.round(momentumScore),
      yieldScore: Math.round(yieldScore),
      stabilityScore: Math.round(stabilityScore),
      stabilityBand:
        stabilityScore >= 75 ? ('Stable' as const) : stabilityScore < 45 ? ('Volatile' as const) : ('Mixed' as const),
      dataCompleteness,
      contributions: {
        scale: roundOne(scaleScore * weights.scale),
        stability: roundOne(stabilityScore * weights.stability),
        momentum: roundOne(momentumScore * weights.momentum),
        yield: roundOne(yieldScore * weights.yield),
      },
    }
  })

  return scored
    .sort((a, b) => b.score - a.score || b.tvl - a.tvl)
    .map((protocol, index) => ({ ...protocol, rank: index + 1 }))
}
