import { ChainType } from '@/lib/chain/types';
import type {
    ChainPortfolioPosition,
    MultiChainPortfolio,
    ChainScenarioConfig,
    ChainRiskBreakdown,
    ComparativeSimulationResult,
    RebalancingRecommendation,
    ArbitrageOpportunity,
} from '@/shared/types';

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

function randomNormal(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

interface MonteCarloMetrics {
    averageEndingValue: number;
    var95Usd: number;
    drawdown95Pct: number;
    liquidationProbability: number;
}

function runMonteCarloForChain(
    positions: ChainPortfolioPosition[],
    scenario: ChainScenarioConfig,
    chain: ChainType,
    trials = 500,
    steps = 10
): MonteCarloMetrics {
    const initialValue = positions.reduce((acc, p) => acc + p.usdValue, 0);
    if (initialValue === 0) {
        return { averageEndingValue: 0, var95Usd: 0, drawdown95Pct: 0, liquidationProbability: 0 };
    }

    const marketDrift = -Math.abs(scenario.marketShockPct) / 100;
    const driftPerStep = marketDrift / steps;

    const liquidityPenaltyFraction = scenario.liquidityDropPct / 100;

    let liquidationCount = 0;
    const endingValues: number[] = [];

    const isBridgeAffected = scenario.chainsAffected?.includes(chain) && scenario.bridgeOutageDurationMinutes;
    const bridgeLossPct = isBridgeAffected
        ? Math.min((scenario.bridgeOutageDurationMinutes ?? 0) / 10, 50) / 100
        : 0;

    for (let t = 0; t < trials; t++) {
        let isLiquidated = false;

        const posValues = positions.map(p => ({
            position: p,
            currentVal: p.usdValue,
            borrowedAmount: p.kind === 'lending' ? p.usdValue * (p.collateralFactor ?? 0.6) * 0.75 : 0
        }));

        for (let s = 0; s < steps; s++) {
            for (const posInfo of posValues) {
                const p = posInfo.position;
                if (posInfo.currentVal <= 0) continue;

                const z = randomNormal();
                let stepReturn = 0;

                const symbolUpper = p.symbol.toUpperCase();
                const isStable = symbolUpper.includes('USDC') || symbolUpper.includes('USDT') || symbolUpper.includes('DAI');

                if (isStable) {
                    const volStep = (p.volatility / 100) * 0.1 / Math.sqrt(steps);
                    stepReturn = volStep * z;
                } else {
                    const volStep = (p.volatility / 100) / Math.sqrt(steps);
                    stepReturn = driftPerStep + volStep * z;
                }

                const stepSlippagePct = liquidityPenaltyFraction * ((100 - p.liquidityScore) / 100) * 0.35 / steps;
                const stepSlippageLoss = posInfo.currentVal * stepSlippagePct;

                posInfo.currentVal = Math.max(0, posInfo.currentVal * Math.exp(stepReturn) - stepSlippageLoss);

                if (p.kind === 'lending' && !isLiquidated) {
                    const cf = p.collateralFactor ?? 0.6;
                    const delayPenalty = 1 + (scenario.oracleDelayMinutes * 0.005);
                    if (posInfo.currentVal * cf < posInfo.borrowedAmount * delayPenalty) {
                        isLiquidated = true;
                        const penalty = posInfo.borrowedAmount * 0.05;
                        posInfo.currentVal = Math.max(0, posInfo.currentVal - posInfo.borrowedAmount - penalty);
                    }
                }
            }
        }

        if (isLiquidated) {
            liquidationCount++;
        }

        let totalSimVal = posValues.reduce((sum, pv) => sum + pv.currentVal, 0);
        const exploitLoss = totalSimVal * (scenario.protocolExploitSeverity / 100) * 0.08;
        totalSimVal = Math.max(0, totalSimVal - exploitLoss);

        if (isBridgeAffected) {
            const bridgeExposedValue = posValues
                .filter(pv => pv.position.kind === 'yield' || pv.position.kind === 'lp')
                .reduce((sum, pv) => sum + pv.currentVal, 0);
            totalSimVal = Math.max(0, totalSimVal - bridgeExposedValue * bridgeLossPct);
        }

        endingValues.push(totalSimVal);
    }

    endingValues.sort((a, b) => a - b);
    const index5pct = Math.floor(trials * 0.05);
    const var95Usd = Math.max(0, initialValue - endingValues[index5pct]);
    const drawdown95Pct = (var95Usd / initialValue) * 100;

    const averageEndingValue = endingValues.reduce((sum, v) => sum + v, 0) / trials;

    return {
        averageEndingValue,
        var95Usd,
        drawdown95Pct,
        liquidationProbability: (liquidationCount / trials) * 100,
    };
}

/**
 * Get protocol exposure share (concentration risk factor)
 */
function getProtocolExposureShare(positions: ChainPortfolioPosition[]): number {
    const total = positions.reduce((acc, p) => acc + p.usdValue, 0);
    if (total === 0) return 0;

    const byProtocol = new Map<string, number>();
    for (const pos of positions) {
        const current = byProtocol.get(pos.protocol) ?? 0;
        byProtocol.set(pos.protocol, current + pos.usdValue);
    }

    let maxShare = 0;
    for (const value of byProtocol.values()) {
        maxShare = Math.max(maxShare, value / total);
    }

    return maxShare;
}

/**
 * Calculate bridge risk based on chain outage duration
 * Assumes liquidity loss during outage period
 */
function calculateBridgeRisk(
    bridgeDurationMinutes: number = 0,
    positions: ChainPortfolioPosition[]
): number {
    if (bridgeDurationMinutes === 0) return 0;

    const baseBridgeRisk = Math.min(bridgeDurationMinutes / 10, 50);

    const bridgeExposedValue = positions
        .filter(p => p.kind === 'yield' || p.kind === 'lp')
        .reduce((acc, p) => acc + p.usdValue, 0);

    const totalValue = positions.reduce((acc, p) => acc + p.usdValue, 0);
    const exposureRatio = totalValue > 0 ? bridgeExposedValue / totalValue : 0;

    return clamp(baseBridgeRisk * (0.5 + exposureRatio), 0, 100);
}

/**
 * Calculate risk breakdown for positions on a single chain
 */
function calculateChainRisk(
    positions: ChainPortfolioPosition[],
    scenario: ChainScenarioConfig,
    chain: ChainType
): ChainRiskBreakdown {
    const total = positions.reduce((acc, p) => acc + p.usdValue, 0) || 1;

    // Mini Monte Carlo (200 trials) for chain risk factors
    const sim = runMonteCarloForChain(positions, scenario, chain, 200, 5);

    const marketRisk = clamp(
        positions.reduce((acc, p) => acc + p.usdValue * p.volatility, 0) / total +
        Math.abs(scenario.marketShockPct) * 0.6,
        0,
        100
    );

    const liquidityRisk = clamp(
        positions.reduce((acc, p) => acc + p.usdValue * (100 - p.liquidityScore), 0) / total / 1.4 +
        scenario.liquidityDropPct * 0.5,
        0,
        100
    );

    const concentrationRisk = clamp(
        getProtocolExposureShare(positions) * 100 + scenario.protocolExploitSeverity * 0.5,
        0,
        100
    );

    const liquidationRisk = clamp(
        sim.liquidationProbability + Math.abs(scenario.marketShockPct) * 1.1,
        0,
        100
    );

    const smartContractRisk = clamp(
        (positions.reduce(
            (acc, p) => acc + p.usdValue * (p.kind === 'lp' ? 0.8 : p.kind === 'lending' ? 0.7 : 0.45),
            0
        ) /
            total) *
        100 *
        0.5 +
        scenario.protocolExploitSeverity,
        0,
        100
    );

    const bridgeRisk =
        scenario.chainsAffected?.includes(chain) && scenario.bridgeOutageDurationMinutes
            ? calculateBridgeRisk(scenario.bridgeOutageDurationMinutes, positions)
            : 0;

    const aggregateRisk =
        marketRisk * 0.25 +
        liquidityRisk * 0.18 +
        concentrationRisk * 0.15 +
        liquidationRisk * 0.18 +
        smartContractRisk * 0.14 +
        (bridgeRisk ?? 0) * 0.1;

    return {
        chain,
        marketRisk: round(marketRisk),
        liquidityRisk: round(liquidityRisk),
        concentrationRisk: round(concentrationRisk),
        liquidationRisk: round(liquidationRisk),
        smartContractRisk: round(smartContractRisk),
        bridgeRisk: round(bridgeRisk),
        aggregateRisk: round(aggregateRisk),
    };
}

/**
 * Generate rebalancing recommendations across chains with simulated risk reductions
 */
function generateRebalancingRecommendations(
    portfolio: MultiChainPortfolio,
    chainRisks: ChainRiskBreakdown[],
    scenario: ChainScenarioConfig
): RebalancingRecommendation[] {
    const recommendations: RebalancingRecommendation[] = [];
    const sortedByRisk = [...chainRisks].sort((a, b) => b.aggregateRisk - a.aggregateRisk);

    if (sortedByRisk.length < 2) return recommendations;

    const highRiskChain = sortedByRisk[0];
    const lowRiskChain = sortedByRisk[sortedByRisk.length - 1];

    const highRiskPositions = portfolio.positions.filter(
        (p) => p.chain === highRiskChain.chain
    );

    for (const position of highRiskPositions) {
        if (position.volatility > 70) {
            // Estimate risk reduction by simulating the portfolio after shifting this position
            const beforeSim = runMonteCarloForChain(portfolio.positions, scenario, highRiskChain.chain, 200, 5);
            
            // Hypothetically shift the position's asset value to the safe low-risk chain
            const modifiedPositions = portfolio.positions.map(p => {
                if (p.symbol === position.symbol && p.chain === highRiskChain.chain) {
                    return { ...p, usdValue: p.usdValue * 0.1 }; // reduce exposure by 90%
                }
                return p;
            });
            const afterSim = runMonteCarloForChain(modifiedPositions, scenario, highRiskChain.chain, 200, 5);
            const varReduction = Math.max(1, beforeSim.drawdown95Pct - afterSim.drawdown95Pct);

            recommendations.push({
                action: 'move',
                fromChain: highRiskChain.chain,
                toChain: lowRiskChain.chain,
                assetSymbol: position.symbol,
                protocol: position.protocol,
                amount: position.balance,
                rationale: `High volatility (${position.volatility}%) on high-risk chain ${highRiskChain.chain}. Shift this exposure to lower-risk chain ${lowRiskChain.chain} to mitigate expected drawdown.`,
                expectedRiskReduction: round(varReduction),
            });
        }

        if (position.kind === 'lp' && highRiskChain.concentrationRisk > 60) {
            recommendations.push({
                action: 'liquidate',
                fromChain: highRiskChain.chain,
                assetSymbol: position.symbol,
                protocol: position.protocol,
                amount: position.balance * 0.5,
                rationale: `High concentration risk on ${position.protocol} inside ${highRiskChain.chain}. Reduce pool exposures by 50% to shield against smart contract vulnerabilities.`,
                expectedRiskReduction: 12.5,
            });
        }
    }

    return recommendations.slice(0, 5);
}

/**
 * Detect cross-chain arbitrage opportunities
 */
function detectArbitrageOpportunities(
    portfolio: MultiChainPortfolio
): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const pricesByAssetChain = new Map<string, Map<ChainType, number>>();

    for (const position of portfolio.positions) {
        const key = position.symbol;
        if (!pricesByAssetChain.has(key)) {
            pricesByAssetChain.set(key, new Map());
        }
        if (position.balance > 0) {
            pricesByAssetChain.get(key)!.set(position.chain, position.usdValue / position.balance);
        }
    }

    for (const [assetSymbol, pricesMap] of pricesByAssetChain) {
        const prices = Array.from(pricesMap.entries());
        if (prices.length < 2) continue;

        prices.sort((a, b) => a[1] - b[1]);
        const [lowChain, lowPrice] = prices[0];
        const [highChain, highPrice] = prices[prices.length - 1];

        if (lowPrice <= 0) continue;
        const priceSpread = ((highPrice - lowPrice) / lowPrice) * 100;

        if (priceSpread > 2) {
            const bridgeCost = 0.5;
            const profitMargin = priceSpread - bridgeCost;

            opportunities.push({
                assetSymbol,
                fromChain: lowChain,
                toChain: highChain,
                bridgeRequired: true,
                expectedProfit: profitMargin,
                profitMargin: round(profitMargin),
                riskLevel: priceSpread > 5 ? 'high' : priceSpread > 3 ? 'medium' : 'low',
                rationale: `${priceSpread.toFixed(2)}% price discrepancy detected between ${lowChain} and ${highChain}. profitable routing via across/debridge.`,
            });
        }
    }

    return opportunities.sort((a, b) => b.profitMargin - a.profitMargin).slice(0, 5);
}

function generateAiBriefing(
    portfolio: MultiChainPortfolio,
    chainRisks: ChainRiskBreakdown[],
    scenario: ChainScenarioConfig,
    mostVulnerable: ChainType,
    leastVulnerable: ChainType,
    maxDrawdown: number,
    aggregateRisk: number
): string {
    const riskLevel = aggregateRisk > 70 ? 'CRITICAL' : aggregateRisk > 40 ? 'ELEVATED' : 'STABLE';
    const activeThreats: string[] = [];

    if (scenario.marketShockPct > 0) {
        activeThreats.push(`Market Shock of -${scenario.marketShockPct}% simulated. Volatile assets are exhibiting high-beta drawdown correlations.`);
    }
    if (scenario.liquidityDropPct > 0) {
        activeThreats.push(`Liquidity contraction of ${scenario.liquidityDropPct}% detected. High slippage penalizing quick exits.`);
    }
    if (scenario.protocolExploitSeverity > 0) {
        activeThreats.push(`Lending/Yield exploit risk simulation level: ${scenario.protocolExploitSeverity}/10. High-risk smart contracts flagged.`);
    }
    if (scenario.bridgeOutageDurationMinutes && scenario.bridgeOutageDurationMinutes > 0) {
        activeThreats.push(`Cross-chain bridge outage simulated for ${scenario.bridgeOutageDurationMinutes} minutes. Liquidity locked on: ${(scenario.chainsAffected ?? []).join(', ')}.`);
    }
    if (scenario.oracleDelayMinutes > 0) {
        activeThreats.push(`Oracle update latency simulation of ${scenario.oracleDelayMinutes} minutes. Liquidation delay penalties applied.`);
    }

    if (activeThreats.length === 0) {
        activeThreats.push("No active scenario stressors configured. Portfolio operating under baseline market conditions.");
    }

    const vulnerabilitySummary = `Portfolio vulnerability is currently ${riskLevel} (${aggregateRisk}/100) with a simulated 95th-percentile value-at-risk (VaR) drawdown of -${(maxDrawdown * 100).toFixed(1)}%.

The primary hazard vector resides on the ${mostVulnerable.toUpperCase()} chain, which registers the highest aggregate risk profile. Conversely, ${leastVulnerable.toUpperCase()} presents the most stable risk profile.`;

    const recommendationText = `MITIGATION PATHWAYS:
• Rebalance assets away from high-beta contracts on ${mostVulnerable.toUpperCase()} to stable pools or native assets on ${leastVulnerable.toUpperCase()} to reduce VaR.
• If bridging, lock in routes before slippage bounds expand further.`;

    return `[ANALYSIS INITIALIZED]
${vulnerabilitySummary}

[ACTIVE RISK VECTORS]
${activeThreats.map(t => `• ${t}`).join('\n')}

[MITIGATION INSTRUCTIONS]
${recommendationText}`;
}

/**
 * Run comparative simulation across all chains
 */
export function runComparativeSimulation(
    portfolio: MultiChainPortfolio,
    scenario: ChainScenarioConfig
): ComparativeSimulationResult {
    const positionsByChain = new Map<ChainType, ChainPortfolioPosition[]>();

    for (const position of portfolio.positions) {
        if (!positionsByChain.has(position.chain)) {
            positionsByChain.set(position.chain, []);
        }
        positionsByChain.get(position.chain)!.push(position);
    }

    const chainRisks = Array.from(positionsByChain.entries()).map(([chain, positions]) =>
        calculateChainRisk(positions, scenario, chain)
    );

    const riskByChain = Object.values(ChainType).reduce((acc, chainType) => {
        acc[chainType] = 0;
        return acc;
    }, {} as Record<ChainType, number>);
    
    let aggregateRisk = 0;
    let maxDrawdown = 0;

    for (const chainRisk of chainRisks) {
        riskByChain[chainRisk.chain] = chainRisk.aggregateRisk;
        aggregateRisk += chainRisk.aggregateRisk;

        const chainPositions = positionsByChain.get(chainRisk.chain) ?? [];
        const sim = runMonteCarloForChain(chainPositions, scenario, chainRisk.chain, 1000, 10);
        maxDrawdown = Math.max(maxDrawdown, sim.drawdown95Pct / 100);
    }

    aggregateRisk = round(aggregateRisk / (chainRisks.length || 1));

    const sortedRisks = [...chainRisks].sort((a, b) => b.aggregateRisk - a.aggregateRisk);
    const mostVulnerableChain = sortedRisks[0]?.chain ?? ChainType.Solana;
    const leastVulnerableChain = sortedRisks[sortedRisks.length - 1]?.chain ?? ChainType.Solana;

    const rebalancingRecommendations = generateRebalancingRecommendations(portfolio, chainRisks, scenario);
    const crossChainArbitrageOpportunities = detectArbitrageOpportunities(portfolio);

    const projectedValue = portfolio.totalUsdValue * (1 - maxDrawdown);

    const aiBriefing = generateAiBriefing(
        portfolio,
        chainRisks,
        scenario,
        mostVulnerableChain,
        leastVulnerableChain,
        maxDrawdown,
        aggregateRisk
    );

    return {
        scenario,
        chainRisks,
        aggregateRisk,
        portfolioImpact: {
            totalUsdValue: round(portfolio.totalUsdValue),
            projectedValue: round(projectedValue),
            maxDrawdown: round(maxDrawdown * 100),
        },
        riskByChain,
        mostVulnerableChain,
        leastVulnerableChain,
        rebalancingRecommendations,
        crossChainArbitrageOpportunities,
        aiBriefing,
    };
}
