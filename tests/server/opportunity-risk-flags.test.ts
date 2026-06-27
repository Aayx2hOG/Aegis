import { getOpportunityAssessment, getOpportunityRiskFlags } from '../../src/lib/opportunities/risk-flags'
import type { OpportunityScore } from '../../src/lib/opportunities/scoring'

const protocol: OpportunityScore = {
  slug: 'example',
  name: 'Example',
  tvl: 5_000_000,
  change1d: -4,
  change7d: -15,
  apy: 45,
  audits: null,
  rank: 1,
  score: 60,
  stabilityScore: 40,
  momentumScore: 20,
  scaleScore: 10,
  yieldScore: 100,
  stabilityBand: 'Volatile',
  dataCompleteness: 100,
  includedFactors: { scale: true, stability: true, momentum: true, yield: true },
  effectiveWeights: { scale: 0.3, stability: 0.25, momentum: 0.25, yield: 0.2 },
  contributions: { scale: 3, stability: 10, momentum: 5, yield: 20 },
}

describe('getOpportunityRiskFlags', () => {
  it('surfaces the most important deterministic warnings', () => {
    const flags = getOpportunityRiskFlags(protocol, {
      protocolSlug: 'example',
      apy: 45,
      apyBase: 10,
      apyReward: 35,
      poolTvlUsd: 2_000_000,
      pool: 'pool-id',
      symbol: 'EXAMPLE-USDC',
      stablecoin: false,
      hasImpermanentLossRisk: true,
      exposure: 'multi',
      poolChain: 'Ethereum',
      isCurrentChain: true,
    })

    expect(flags).toHaveLength(3)
    expect(flags.map((flag) => flag.id)).toEqual(['low-liquidity', 'tvl-decline', 'impermanent-loss'])
  })

  it('states when representative yield data is unavailable', () => {
    const wellCovered = { ...protocol, audits: '2', tvl: 500_000_000, change7d: 2 }
    expect(getOpportunityRiskFlags(wellCovered).map((flag) => flag.id)).toContain('yield-unavailable')
  })

  it('separates confidence and risk from the market score', () => {
    const assessment = getOpportunityAssessment(protocol, {
      protocolSlug: 'example',
      apy: 45,
      apyBase: 10,
      apyReward: 35,
      poolTvlUsd: 2_000_000,
      pool: 'pool-id',
      symbol: 'EXAMPLE-USDC',
      stablecoin: false,
      hasImpermanentLossRisk: true,
      exposure: 'multi',
      poolChain: 'Ethereum',
      isCurrentChain: true,
    })

    expect(assessment).toEqual({
      confidence: 'Medium',
      verdict: 'Review required',
      securityEvidence: 'Unverified',
    })
  })
})
