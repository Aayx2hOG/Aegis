import type {
    PortfolioPosition,
    RiskAction,
    RiskBreakdown,
    ScenarioConfig,
    SimulationResult,
} from '@/shared/types'
import {
    EXPLOIT_LOSS_FACTOR,
    AGG_WEIGHTS,
    MARKET_SHOCK_MULT,
    LIQUIDITY_DIVISOR,
    LIQUIDITY_SCENARIO_MULT,
    CONCENTRATION_SCENARIO_MULT,
    LIQUIDATION_MARKET_MULT,
    ORACLE_DELAY_MIN_MULT,
    SMART_CONTRACT_BASE_MULT,
    LIQUIDITY_SLIPPAGE_MULT,
    LIQUIDATION_PROB_MULT,
    ACTIONS,
    DEFAULT_CONFIDENCES,
} from '@/shared/config/war-room-config'

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
    return Math.round(value * 100) / 100
}

function getProtocolExposureShare(positions: PortfolioPosition[]): number {
    const total = positions.reduce((acc, p) => acc + p.usdValue, 0)
    if (total === 0) return 0

    const byProtocol = new Map<string, number>()
    for (const pos of positions) {
        const current = byProtocol.get(pos.protocol) ?? 0
        byProtocol.set(pos.protocol, current + pos.usdValue)
    }

    let maxShare = 0
    for (const value of byProtocol.values()) {
        maxShare = Math.max(maxShare, value / total)
    }

    return maxShare
}

function riskFromPositions(positions: PortfolioPosition[], scenario: ScenarioConfig): RiskBreakdown {
    const total = positions.reduce((acc, p) => acc + p.usdValue, 0) || 1

    const marketRisk = clamp(
        positions.reduce((acc, p) => acc + p.usdValue * p.volatility, 0) / total + Math.abs(scenario.marketShockPct) * MARKET_SHOCK_MULT,
        0,
        100
    )

    const liquidityRisk = clamp(
        positions.reduce((acc, p) => acc + p.usdValue * (100 - p.liquidityScore), 0) / total / LIQUIDITY_DIVISOR + scenario.liquidityDropPct * LIQUIDITY_SCENARIO_MULT,
        0,
        100
    )

    const concentrationRisk = clamp(getProtocolExposureShare(positions) * 100 + scenario.protocolExploitSeverity * CONCENTRATION_SCENARIO_MULT, 0, 100)

    const leveragedExposure = positions
        .filter((p) => p.kind === 'lending')
        .reduce((acc, p) => acc + p.usdValue * (p.collateralFactor ?? 0.6), 0)

    const liquidationRisk = clamp((leveragedExposure / total) * 100 + Math.abs(scenario.marketShockPct) * LIQUIDATION_MARKET_MULT + scenario.oracleDelayMinutes * ORACLE_DELAY_MIN_MULT, 0, 100)

    const smartContractRisk = clamp(
        positions.reduce((acc, p) => acc + p.usdValue * (p.kind === 'lp' ? 0.8 : p.kind === 'lending' ? 0.7 : 0.45), 0) / total * 100 * SMART_CONTRACT_BASE_MULT +
        scenario.protocolExploitSeverity,
        0,
        100
    )

    return {
        marketRisk: round(marketRisk),
        liquidityRisk: round(liquidityRisk),
        concentrationRisk: round(concentrationRisk),
        liquidationRisk: round(liquidationRisk),
        smartContractRisk: round(smartContractRisk),
    }
}

function aggregateRiskScore(risk: RiskBreakdown): number {
    const weighted =
        risk.marketRisk * AGG_WEIGHTS.market +
        risk.liquidityRisk * AGG_WEIGHTS.liquidity +
        risk.concentrationRisk * AGG_WEIGHTS.concentration +
        risk.liquidationRisk * AGG_WEIGHTS.liquidation +
        risk.smartContractRisk * AGG_WEIGHTS.smart
    return round(clamp(weighted, 0, 100))
}

function simulatePortfolioValue(positions: PortfolioPosition[], scenario: ScenarioConfig): {
    currentValue: number
    projectedValue: number
    varUsd: number
    drawdownPct: number
} {
    const currentValue = positions.reduce((acc, p) => acc + p.usdValue, 0)

    const loss = positions.reduce((acc, p) => {
        const marketLoss = p.usdValue * (Math.abs(scenario.marketShockPct) / 100) * (p.volatility / 100)
        const stablecoinLoss = p.symbol.includes('USDC') || p.symbol.includes('USDT') ? p.usdValue * (scenario.stablecoinDepegPct / 100) : 0
        const liquiditySlippage = p.usdValue * (scenario.liquidityDropPct / 100) * ((100 - p.liquidityScore) / 100) * LIQUIDITY_SLIPPAGE_MULT
        return acc + marketLoss + stablecoinLoss + liquiditySlippage
    }, 0)

    const exploitLoss = currentValue * (scenario.protocolExploitSeverity / 100) * EXPLOIT_LOSS_FACTOR
    const projectedValue = Math.max(0, currentValue - loss - exploitLoss)
    const varUsd = currentValue - projectedValue
    const drawdownPct = currentValue === 0 ? 0 : (varUsd / currentValue) * 100

    return {
        currentValue: round(currentValue),
        projectedValue: round(projectedValue),
        varUsd: round(varUsd),
        drawdownPct: round(drawdownPct),
    }
}

function recommendActions(risk: RiskBreakdown, positions: PortfolioPosition[]): RiskAction[] {
    const largest = [...positions].sort((a, b) => b.usdValue - a.usdValue)[0]
    const protocolShare = round(getProtocolExposureShare(positions) * 100)

    const actions: RiskAction[] = [
        {
            id: 'hedge-beta',
            title: 'Protect Part of Your Portfolio With a Hedge',
            rationale: 'Use simple downside protection on SOL and other volatile tokens so losses are smaller during sharp drops.',
            impact: {
                riskReduction: round(risk.marketRisk * ACTIONS.hedgeRiskReduction),
                estimatedCostUsd: round((largest?.usdValue ?? 0) * ACTIONS.hedgeCostMultiplier),
                confidence: DEFAULT_CONFIDENCES.hedge,
            },
        },
        {
            id: 'rebalance-concentration',
            title: 'Spread Funds Across More Than One Protocol',
            rationale: `About ${protocolShare}% of exposure is concentrated in one protocol. Splitting that exposure lowers single-point failure risk.`,
            impact: {
                riskReduction: round(risk.concentrationRisk * ACTIONS.rebalanceRiskReduction),
                estimatedCostUsd: round((largest?.usdValue ?? 0) * ACTIONS.rebalanceCostMultiplier),
                confidence: DEFAULT_CONFIDENCES.rebalance,
            },
        },
        {
            id: 'raise-collateral-buffer',
            title: 'Increase Safety Buffer on Borrowed Positions',
            rationale: 'Add extra collateral or reduce borrow size so positions are less likely to be force-closed during fast moves.',
            impact: {
                riskReduction: round(risk.liquidationRisk * ACTIONS.raiseCollateralRiskReduction),
                estimatedCostUsd: round((positions.reduce((acc, p) => acc + p.usdValue, 0) * ACTIONS.raiseCollateralCostMultiplier)),
                confidence: DEFAULT_CONFIDENCES.collateral,
            },
        },
        {
            id: 'emergency-runbook',
            title: 'Set Automatic Alerts and Emergency Actions',
            rationale: 'Create automatic alerts and predefined actions for depegs, exploit news, and liquidity drops to respond faster.',
            impact: {
                riskReduction: round((risk.smartContractRisk + risk.liquidityRisk) * ACTIONS.emergencyRiskReduction),
                estimatedCostUsd: 0,
                confidence: DEFAULT_CONFIDENCES.emergency,
            },
        },
    ]

    return actions.sort((a, b) => b.impact.riskReduction - a.impact.riskReduction).slice(0, 3)
}

export function runWarRoomSimulation(positions: PortfolioPosition[], scenario: ScenarioConfig): SimulationResult {
    const safePositions = positions.filter((p) => p.usdValue > 0)
    const beforeRisk = riskFromPositions(safePositions, {
        ...scenario,
        marketShockPct: 0,
        stablecoinDepegPct: 0,
        liquidityDropPct: 0,
        oracleDelayMinutes: 0,
        protocolExploitSeverity: 0,
    })
    const afterRisk = riskFromPositions(safePositions, scenario)
    const values = simulatePortfolioValue(safePositions, scenario)

    return {
        scenario,
        summary: {
            portfolioValueUsd: values.currentValue,
            projectedValueUsd: values.projectedValue,
            projectedDrawdownPct: values.drawdownPct,
            valueAtRiskUsd: values.varUsd,
            riskScoreBefore: aggregateRiskScore(beforeRisk),
            riskScoreAfterShock: aggregateRiskScore(afterRisk),
            liquidationProbabilityPct: round(clamp(afterRisk.liquidationRisk * 0.75, 1, 99)),
        },
        riskBreakdown: afterRisk,
        topActions: recommendActions(afterRisk, safePositions),
        generatedAt: new Date().toISOString(),
    }
}