import { PROFILE_WEIGHTS, scoreOpportunities } from '../../src/lib/opportunities/scoring'

const protocols = [
  {
    slug: 'large-stable',
    name: 'Large Stable',
    tvl: 2_000_000_000,
    change1d: 0.2,
    change7d: 1,
    apy: 5,
  },
  {
    slug: 'small-fast',
    name: 'Small Fast',
    tvl: 20_000_000,
    change1d: 8,
    change7d: 30,
    apy: 25,
  },
  {
    slug: 'declining',
    name: 'Declining',
    tvl: 300_000_000,
    change1d: -3,
    change7d: -12,
    apy: 8,
  },
]

describe('scoreOpportunities', () => {
  it('favors scale and stability for conservative users', () => {
    expect(scoreOpportunities(protocols, 'conservative')[0].slug).toBe('large-stable')
  })

  it('favors momentum for aggressive users', () => {
    expect(scoreOpportunities(protocols, 'aggressive')[0].slug).toBe('small-fast')
  })

  it('returns ranked, bounded scores without mutating inputs', () => {
    const result = scoreOpportunities(protocols, 'balanced')

    expect(result.map((item) => item.rank)).toEqual([1, 2, 3])
    expect(result.every((item) => item.score >= 0 && item.score <= 100)).toBe(true)
    expect(protocols[0]).not.toHaveProperty('score')
  })

  it('exposes enough information to independently reconstruct a score', () => {
    const result = scoreOpportunities(protocols, 'balanced')[0]
    const weights = PROFILE_WEIGHTS.balanced
    const reconstructed =
      result.scaleScore * weights.scale +
      result.stabilityScore * weights.stability +
      result.momentumScore * weights.momentum +
      result.yieldScore * weights.yield
    const contributionTotal =
      result.contributions.scale +
      result.contributions.stability +
      result.contributions.momentum +
      result.contributions.yield

    expect(Math.abs(result.score - reconstructed)).toBeLessThanOrEqual(1)
    expect(Math.abs(result.score - contributionTotal)).toBeLessThanOrEqual(0.2)
    expect(result.dataCompleteness).toBe(100)
  })
})
