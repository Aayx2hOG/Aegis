import type { PortfolioPosition, RiskAction, RiskBreakdown, ScenarioConfig, SimulationResult } from '@/lib/types'
import {
  EXPLOIT_LOSS_FACTOR,
  AGG_WEIGHTS,
  MARKET_SHOCK_MULT,
  LIQUIDITY_DIVISOR,
  LIQUIDITY_SCENARIO_MULT,
  CONCENTRATION_SCENARIO_MULT,
  LIQUIDATION_MARKET_MULT,
  SMART_CONTRACT_BASE_MULT,
  LIQUIDITY_SLIPPAGE_MULT,
  ACTIONS,
  DEFAULT_CONFIDENCES,
} from '@/lib/config/war-room-config'

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

function randomNormal(): number {
  let u = 0,
    v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

interface MonteCarloMetrics {
  averageEndingValue: number
  var95Usd: number
  drawdown95Pct: number
  liquidationProbability: number
  averageSlippageLossUsd: number
}

function runMonteCarlo(
  positions: PortfolioPosition[],
  scenario: ScenarioConfig,
  trials = 500,
  steps = 10,
): MonteCarloMetrics {
  const initialValue = positions.reduce((acc, p) => acc + p.usdValue, 0)
  if (initialValue === 0) {
    return {
      averageEndingValue: 0,
      var95Usd: 0,
      drawdown95Pct: 0,
      liquidationProbability: 0,
      averageSlippageLossUsd: 0,
    }
  }

  const marketDrift = -Math.abs(scenario.marketShockPct) / 100
  const driftPerStep = marketDrift / steps

  const stableDepegDrift = -Math.abs(scenario.stablecoinDepegPct) / 100
  const stableDriftPerStep = stableDepegDrift / steps

  const liquidityPenaltyFraction = scenario.liquidityDropPct / 100

  let liquidationCount = 0
  let totalSlippageLoss = 0
  const endingValues: number[] = []

  for (let t = 0; t < trials; t++) {
    let trialSlippage = 0
    let isLiquidated = false

    const posValues = positions.map((p) => ({
      position: p,
      currentVal: p.usdValue,
      borrowedAmount: p.kind === 'lending' ? p.usdValue * (p.collateralFactor ?? 0.6) * 0.75 : 0,
    }))

    for (let s = 0; s < steps; s++) {
      for (const posInfo of posValues) {
        const p = posInfo.position
        if (posInfo.currentVal <= 0) continue

        const z = randomNormal()
        let stepReturn = 0

        const symbolUpper = p.symbol.toUpperCase()
        const isStable = symbolUpper.includes('USDC') || symbolUpper.includes('USDT') || symbolUpper.includes('DAI')
        if (isStable) {
          const volStep = ((p.volatility / 100) * 0.1) / Math.sqrt(steps)
          stepReturn = stableDriftPerStep + volStep * z
        } else {
          const volStep = p.volatility / 100 / Math.sqrt(steps)
          stepReturn = driftPerStep + volStep * z
        }

        const stepSlippagePct =
          (liquidityPenaltyFraction * ((100 - p.liquidityScore) / 100) * LIQUIDITY_SLIPPAGE_MULT) / steps
        const stepSlippageLoss = posInfo.currentVal * stepSlippagePct
        trialSlippage += stepSlippageLoss

        posInfo.currentVal = Math.max(0, posInfo.currentVal * Math.exp(stepReturn) - stepSlippageLoss)

        if (p.kind === 'lending' && !isLiquidated) {
          const cf = p.collateralFactor ?? 0.6
          const delayPenalty = 1 + scenario.oracleDelayMinutes * 0.005
          if (posInfo.currentVal * cf < posInfo.borrowedAmount * delayPenalty) {
            isLiquidated = true
            const penalty = posInfo.borrowedAmount * 0.05
            posInfo.currentVal = Math.max(0, posInfo.currentVal - posInfo.borrowedAmount - penalty)
          }
        }
      }
    }

    if (isLiquidated) {
      liquidationCount++
    }

    const totalSimVal = posValues.reduce((sum, pv) => sum + pv.currentVal, 0)
    const exploitLoss = totalSimVal * (scenario.protocolExploitSeverity / 100) * EXPLOIT_LOSS_FACTOR
    const trialEndingValue = Math.max(0, totalSimVal - exploitLoss)

    endingValues.push(trialEndingValue)
    totalSlippageLoss += trialSlippage
  }

  endingValues.sort((a, b) => a - b)
  const index5pct = Math.floor(trials * 0.05)
  const var95Usd = Math.max(0, initialValue - endingValues[index5pct])
  const drawdown95Pct = (var95Usd / initialValue) * 100

  const averageEndingValue = endingValues.reduce((sum, v) => sum + v, 0) / trials
  const averageSlippageLossUsd = totalSlippageLoss / trials

  return {
    averageEndingValue: round(averageEndingValue),
    var95Usd: round(var95Usd),
    drawdown95Pct: round(drawdown95Pct),
    liquidationProbability: round((liquidationCount / trials) * 100),
    averageSlippageLossUsd: round(averageSlippageLossUsd),
  }
}

function riskFromPositions(positions: PortfolioPosition[], scenario: ScenarioConfig): RiskBreakdown {
  const total = positions.reduce((acc, p) => acc + p.usdValue, 0) || 1

  // Run a mini Monte Carlo (200 trials) to get dynamic liquidation and slippage metrics
  const sim = runMonteCarlo(positions, scenario, 200, 5)

  const avgVol = positions.reduce((acc, p) => acc + p.usdValue * p.volatility, 0) / total
  const marketRisk = clamp(avgVol + Math.abs(scenario.marketShockPct) * MARKET_SHOCK_MULT, 0, 100)

  const avgIlliquidity = positions.reduce((acc, p) => acc + p.usdValue * (100 - p.liquidityScore), 0) / total
  const liquidityRisk = clamp(
    avgIlliquidity / LIQUIDITY_DIVISOR + scenario.liquidityDropPct * LIQUIDITY_SCENARIO_MULT,
    0,
    100,
  )

  // Concentration Risk using HHI index
  const hhi = positions.reduce((acc, p) => acc + Math.pow(p.usdValue / total, 2), 0)
  const concentrationRisk = clamp(hhi * 100 + scenario.protocolExploitSeverity * CONCENTRATION_SCENARIO_MULT, 0, 100)

  // Liquidation Risk maps to Monte Carlo liquidation probability
  const liquidationRisk = clamp(
    sim.liquidationProbability + Math.abs(scenario.marketShockPct) * LIQUIDATION_MARKET_MULT,
    0,
    100,
  )

  const smartContractRisk = clamp(
    (positions.reduce((acc, p) => acc + p.usdValue * (p.kind === 'lp' ? 0.8 : p.kind === 'lending' ? 0.7 : 0.45), 0) /
      total) *
      100 *
      SMART_CONTRACT_BASE_MULT +
      scenario.protocolExploitSeverity,
    0,
    100,
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

function simulatePortfolioValue(
  positions: PortfolioPosition[],
  scenario: ScenarioConfig,
): {
  currentValue: number
  projectedValue: number
  varUsd: number
  drawdownPct: number
} {
  const currentValue = positions.reduce((acc, p) => acc + p.usdValue, 0)
  if (currentValue === 0) {
    return { currentValue: 0, projectedValue: 0, varUsd: 0, drawdownPct: 0 }
  }

  const sim = runMonteCarlo(positions, scenario, 1000, 10)

  return {
    currentValue: round(currentValue),
    projectedValue: round(sim.averageEndingValue),
    varUsd: round(sim.var95Usd),
    drawdownPct: round(sim.drawdown95Pct),
  }
}

function recommendActions(risk: RiskBreakdown, positions: PortfolioPosition[]): RiskAction[] {
  const largest = [...positions].sort((a, b) => b.usdValue - a.usdValue)[0]
  const protocolShare = round(getProtocolExposureShare(positions) * 100)

  const actions: RiskAction[] = [
    {
      id: 'hedge-beta',
      title: 'Protect Part of Your Portfolio With a Hedge',
      rationale:
        'Use simple downside protection on SOL and other volatile tokens so losses are smaller during sharp drops.',
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
      rationale:
        'Add extra collateral or reduce borrow size so positions are less likely to be force-closed during fast moves.',
      impact: {
        riskReduction: round(risk.liquidationRisk * ACTIONS.raiseCollateralRiskReduction),
        estimatedCostUsd: round(
          positions.reduce((acc, p) => acc + p.usdValue, 0) * ACTIONS.raiseCollateralCostMultiplier,
        ),
        confidence: DEFAULT_CONFIDENCES.collateral,
      },
    },
    {
      id: 'emergency-runbook',
      title: 'Set Automatic Alerts and Emergency Actions',
      rationale:
        'Create automatic alerts and predefined actions for depegs, exploit news, and liquidity drops to respond faster.',
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

  // Recalculate dynamic liquidation probability
  const sim = runMonteCarlo(safePositions, scenario, 1000, 10)

  return {
    scenario,
    summary: {
      portfolioValueUsd: values.currentValue,
      projectedValueUsd: values.projectedValue,
      projectedDrawdownPct: values.drawdownPct,
      valueAtRiskUsd: values.varUsd,
      riskScoreBefore: aggregateRiskScore(beforeRisk),
      riskScoreAfterShock: aggregateRiskScore(afterRisk),
      liquidationProbabilityPct: sim.liquidationProbability,
    },
    riskBreakdown: afterRisk,
    topActions: recommendActions(afterRisk, safePositions),
    generatedAt: new Date().toISOString(),
  }
}
