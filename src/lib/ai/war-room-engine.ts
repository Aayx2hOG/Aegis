import type {
    PortfolioPosition,
    RiskAction,
    RiskBreakdown,
    ScenarioConfig,
    SimulationResult,
} from '@/lib/types/war-room'

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
        positions.reduce((acc, p) => acc + p.usdValue * p.volatility, 0) / total + Math.abs(scenario.marketShockPct) * 0.6,
        0,
        100
    )

    const liquidityRisk = clamp(
        positions.reduce((acc, p) => acc + p.usdValue * (100 - p.liquidityScore), 0) / total / 1.4 + scenario.liquidityDropPct * 0.5,
        0,
        100
    )

    const concentrationRisk = clamp(getProtocolExposureShare(positions) * 100 + scenario.protocolExploitSeverity * 0.5, 0, 100)

    const leveragedExposure = positions
        .filter((p) => p.kind === 'lending')
        .reduce((acc, p) => acc + p.usdValue * (p.collateralFactor ?? 0.6), 0)

    const liquidationRisk = clamp((leveragedExposure / total) * 100 + Math.abs(scenario.marketShockPct) * 1.1 + scenario.oracleDelayMinutes * 0.25, 0, 100)

    const smartContractRisk = clamp(
        positions.reduce((acc, p) => acc + p.usdValue * (p.kind === 'lp' ? 0.8 : p.kind === 'lending' ? 0.7 : 0.45), 0) / total * 100 * 0.5 +
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
        risk.marketRisk * 0.28 +
        risk.liquidityRisk * 0.2 +
        risk.concentrationRisk * 0.17 +
        risk.liquidationRisk * 0.2 +
        risk.smartContractRisk * 0.15
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
        const liquiditySlippage = p.usdValue * (scenario.liquidityDropPct / 100) * ((100 - p.liquidityScore) / 100) * 0.35
        return acc + marketLoss + stablecoinLoss + liquiditySlippage
    }, 0)

    const exploitLoss = currentValue * (scenario.protocolExploitSeverity / 100) * 0.08
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
                riskReduction: round(risk.marketRisk * 0.25),
                estimatedCostUsd: round((largest?.usdValue ?? 0) * 0.004),
                confidence: 0.83,
            },
        },
        {
            id: 'rebalance-concentration',
            title: 'Spread Funds Across More Than One Protocol',
            rationale: `About ${protocolShare}% of exposure is concentrated in one protocol. Splitting that exposure lowers single-point failure risk.`,
            impact: {
                riskReduction: round(risk.concentrationRisk * 0.3),
                estimatedCostUsd: round((largest?.usdValue ?? 0) * 0.0025),
                confidence: 0.79,
            },
        },
        {
            id: 'raise-collateral-buffer',
            title: 'Increase Safety Buffer on Borrowed Positions',
            rationale: 'Add extra collateral or reduce borrow size so positions are less likely to be force-closed during fast moves.',
            impact: {
                riskReduction: round(risk.liquidationRisk * 0.35),
                estimatedCostUsd: round((positions.reduce((acc, p) => acc + p.usdValue, 0) * 0.0018)),
                confidence: 0.87,
            },
        },
        {
            id: 'emergency-runbook',
            title: 'Set Automatic Alerts and Emergency Actions',
            rationale: 'Create automatic alerts and predefined actions for depegs, exploit news, and liquidity drops to respond faster.',
            impact: {
                riskReduction: round((risk.smartContractRisk + risk.liquidityRisk) * 0.15),
                estimatedCostUsd: 0,
                confidence: 0.74,
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
