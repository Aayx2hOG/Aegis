export interface PortfolioPosition {
  id: string
  label: string
  symbol: string
  protocol: string
  kind: 'token' | 'staking' | 'lending' | 'lp'
  usdValue: number
  collateralFactor?: number
  volatility: number
  liquidityScore: number
}

export interface ScenarioConfig {
  type: 'market-crash' | 'stablecoin-depeg' | 'smart-contract-incident'
  title: string
  beginnerLabel: string
  beginnerSummary: string
  marketShockPct: number
  stablecoinDepegPct: number
  liquidityDropPct: number
  oracleDelayMinutes: number
  protocolExploitSeverity: number
}

export interface RiskBreakdown {
  marketRisk: number
  liquidityRisk: number
  concentrationRisk: number
  liquidationRisk: number
  smartContractRisk: number
}

export interface RiskAction {
  id: string
  title: string
  rationale: string
  impact: {
    riskReduction: number
    estimatedCostUsd: number
    confidence: number
  }
}

export interface SimulationResult {
  scenario: ScenarioConfig
  summary: {
    portfolioValueUsd: number
    projectedValueUsd: number
    projectedDrawdownPct: number
    valueAtRiskUsd: number
    riskScoreBefore: number
    riskScoreAfterShock: number
    liquidationProbabilityPct: number
  }
  riskBreakdown: RiskBreakdown
  topActions: RiskAction[]
  generatedAt: string
}

export interface SimulationRequest {
  positions: PortfolioPosition[]
  scenario: ScenarioConfig
}