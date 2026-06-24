import { runWarRoomSimulation } from '@/server/ai/war-room-engine'
import type { PortfolioPosition, ScenarioConfig } from '@/lib/types'

describe('runWarRoomSimulation', () => {
  const originalRandom = Math.random

  afterEach(() => {
    Math.random = originalRandom
  })

  it('keeps zero-value portfolios at zero risk value outputs', () => {
    Math.random = jest.fn(() => 0.5)
    const scenario: ScenarioConfig = {
      type: 'market-crash',
      title: 'Market crash',
      beginnerLabel: 'Crash',
      beginnerSummary: 'Market falls sharply.',
      marketShockPct: -30,
      stablecoinDepegPct: 0,
      liquidityDropPct: 50,
      oracleDelayMinutes: 10,
      protocolExploitSeverity: 20,
    }

    const result = runWarRoomSimulation([], scenario)

    expect(result.summary.portfolioValueUsd).toBe(0)
    expect(result.summary.projectedValueUsd).toBe(0)
    expect(result.summary.valueAtRiskUsd).toBe(0)
    expect(result.summary.projectedDrawdownPct).toBe(0)
    expect(result.topActions).toHaveLength(3)
  })

  it('increases aggregate risk under a severe stress scenario', () => {
    Math.random = jest.fn(() => 0.5)
    const positions: PortfolioPosition[] = [
      {
        id: 'pos-1',
        label: 'SOL lend',
        symbol: 'SOL',
        protocol: 'Kamino',
        kind: 'lending',
        usdValue: 100_000,
        collateralFactor: 0.55,
        volatility: 60,
        liquidityScore: 50,
      },
      {
        id: 'pos-2',
        label: 'USDC',
        symbol: 'USDC',
        protocol: 'Jito',
        kind: 'token',
        usdValue: 50_000,
        volatility: 5,
        liquidityScore: 90,
      },
    ]
    const scenario: ScenarioConfig = {
      type: 'market-crash',
      title: 'Market crash',
      beginnerLabel: 'Crash',
      beginnerSummary: 'Market falls sharply.',
      marketShockPct: -35,
      stablecoinDepegPct: 10,
      liquidityDropPct: 60,
      oracleDelayMinutes: 20,
      protocolExploitSeverity: 30,
    }

    const result = runWarRoomSimulation(positions, scenario)

    expect(result.summary.portfolioValueUsd).toBe(150_000)
    expect(result.summary.riskScoreAfterShock).toBeGreaterThan(result.summary.riskScoreBefore)
    expect(result.summary.projectedValueUsd).toBeLessThan(result.summary.portfolioValueUsd)
    expect(result.riskBreakdown.marketRisk).toBeGreaterThan(0)
    expect(result.riskBreakdown.liquidityRisk).toBeGreaterThan(0)
    expect(result.topActions).toHaveLength(3)
  })
})
