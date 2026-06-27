import { findProtocolYieldSummary, type ProtocolYieldSummary } from '../../src/lib/opportunities/yields'

const sanctumInfinity: ProtocolYieldSummary = {
  protocolSlug: 'sanctum-infinity',
  apy: 5.95347,
  apyBase: 5.95347,
  apyReward: null,
  poolTvlUsd: 146_579_888,
  pool: 'pool-id',
  symbol: 'INF',
  stablecoin: false,
  hasImpermanentLossRisk: false,
  exposure: 'single',
  poolChain: 'Solana',
  isCurrentChain: true,
}

describe('findProtocolYieldSummary', () => {
  it('maps the Sanctum validator-LST umbrella to its representative ecosystem pool', () => {
    expect(
      findProtocolYieldSummary({ slug: 'sanctum-validator-lsts', name: 'Sanctum Validator LSTs' }, [sanctumInfinity]),
    ).toEqual(sanctumInfinity)
  })

  it('prefers exact project identifiers over fuzzy prefix matches', () => {
    const exact = { ...sanctumInfinity, protocolSlug: 'sanctum-validator-lsts', apy: 4.5 }
    expect(
      findProtocolYieldSummary({ slug: 'sanctum-validator-lsts', name: 'Sanctum Validator LSTs' }, [
        sanctumInfinity,
        exact,
      ])?.apy,
    ).toBe(4.5)
  })
})
