export type AssetKind = 'token' | 'lp' | 'lending' | 'staking'

export interface PortfolioPosition {
    id: string
    label: string
    symbol: string
    protocol: string
    kind: AssetKind
    usdValue: number
    collateralFactor?: number
    volatility: number
    liquidityScore: number
}

export type ScenarioType =
    | 'market-crash'
    | 'stablecoin-depeg'
    | 'liquidity-dry-up'
    | 'oracle-lag'
    | 'smart-contract-incident'

export interface ScenarioConfig {
    type: ScenarioType
    title: string
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

export interface SimulationSummary {
    portfolioValueUsd: number
    projectedValueUsd: number
    projectedDrawdownPct: number
    valueAtRiskUsd: number
    riskScoreBefore: number
    riskScoreAfterShock: number
    liquidationProbabilityPct: number
}

export interface SimulationResult {
    scenario: ScenarioConfig
    summary: SimulationSummary
    riskBreakdown: RiskBreakdown
    topActions: RiskAction[]
    generatedAt: string
}

export interface SimulationRequest {
    positions: PortfolioPosition[]
    scenario: ScenarioConfig
}
