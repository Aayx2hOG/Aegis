import { ChainType } from '@/lib/chain/types';
import type {
    ChainPortfolioPosition,
    MultiChainPortfolio,
    ChainScenarioConfig,
    ChainRiskBreakdown,
    ComparativeSimulationResult,
    RebalancingRecommendation,
    ArbitrageOpportunity,
} from '@/shared/types/comparative-war-room';

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number = 2): number {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
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

    // Risk increases exponentially with outage duration
    // 30 min outage: 5% risk, 60 min: 15%, 120 min: 40%
    const baseBridgeRisk = Math.min(bridgeDurationMinutes / 10, 50);

    // Check if positions have bridge-exposed assets
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

    const leveragedExposure = positions
        .filter((p) => p.kind === 'lending')
        .reduce((acc, p) => acc + p.usdValue * (p.collateralFactor ?? 0.6), 0);

    const liquidationRisk = clamp(
        (leveragedExposure / total) * 100 +
        Math.abs(scenario.marketShockPct) * 1.1 +
        scenario.oracleDelayMinutes * 0.25,
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
 * Generate rebalancing recommendations across chains
 */
function generateRebalancingRecommendations(
    portfolio: MultiChainPortfolio,
    chainRisks: ChainRiskBreakdown[]
): RebalancingRecommendation[] {
    const recommendations: RebalancingRecommendation[] = [];
    const sortedByRisk = [...chainRisks].sort((a, b) => b.aggregateRisk - a.aggregateRisk);

    if (sortedByRisk.length < 2) return recommendations;

    const highRiskChain = sortedByRisk[0];
    const lowRiskChain = sortedByRisk[sortedByRisk.length - 1];

    // Get high-concentration positions on high-risk chain
    const highRiskPositions = portfolio.positions.filter(
        (p) => p.chain === highRiskChain.chain
    );

    for (const position of highRiskPositions) {
        // If position is in a volatile token, suggest moving to stablecoin on low-risk chain
        if (position.volatility > 70) {
            const riskReduction = (highRiskChain.aggregateRisk - lowRiskChain.aggregateRisk) * 0.3;

            recommendations.push({
                action: 'move',
                fromChain: highRiskChain.chain,
                toChain: lowRiskChain.chain,
                assetSymbol: position.symbol,
                protocol: position.protocol,
                amount: position.balance,
                rationale: `High volatility (${position.volatility}%) on high-risk chain. Move to lower-risk chain.`,
                expectedRiskReduction: round(riskReduction),
            });
        }

        // If position has high concentration risk, suggest liquidating portion
        if (position.kind === 'lp' && highRiskChain.concentrationRisk > 60) {
            recommendations.push({
                action: 'liquidate',
                fromChain: highRiskChain.chain,
                assetSymbol: position.symbol,
                protocol: position.protocol,
                amount: position.balance * 0.5,
                rationale: `High concentration risk on ${position.protocol}. Reduce exposure.`,
                expectedRiskReduction: 10,
            });
        }
    }

    return recommendations.slice(0, 5); // Top 5 recommendations
}

/**
 * Detect cross-chain arbitrage opportunities
 */
function detectArbitrageOpportunities(
    portfolio: MultiChainPortfolio
): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const pricesByAssetChain = new Map<string, Map<ChainType, number>>();

    // Group positions by asset
    for (const position of portfolio.positions) {
        const key = position.symbol;
        if (!pricesByAssetChain.has(key)) {
            pricesByAssetChain.set(key, new Map());
        }
        pricesByAssetChain.get(key)!.set(position.chain, position.usdValue / position.balance);
    }

    // Find price discrepancies
    for (const [assetSymbol, pricesMap] of pricesByAssetChain) {
        const prices = Array.from(pricesMap.entries());
        if (prices.length < 2) continue;

        prices.sort((a, b) => a[1] - b[1]);
        const [lowChain, lowPrice] = prices[0];
        const [highChain, highPrice] = prices[prices.length - 1];

        const priceSpread = ((highPrice - lowPrice) / lowPrice) * 100;

        if (priceSpread > 2) {
            // Profitable if spread > 2% to account for bridge/slippage costs
            const bridgeCost = 0.5; // Estimated 0.5%
            const profitMargin = priceSpread - bridgeCost;

            opportunities.push({
                assetSymbol,
                fromChain: lowChain,
                toChain: highChain,
                bridgeRequired: true,
                expectedProfit: profitMargin,
                profitMargin: round(profitMargin),
                riskLevel: priceSpread > 5 ? 'high' : priceSpread > 3 ? 'medium' : 'low',
                rationale: `${priceSpread.toFixed(2)}% price difference detected between chains`,
            });
        }
    }

    return opportunities.sort((a, b) => b.profitMargin - a.profitMargin).slice(0, 5);
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

        // Calculate potential drawdown
        const maxMarketShock = Math.abs(scenario.marketShockPct);
        const potentialDrawdown = (chainRisk.aggregateRisk / 100) * (maxMarketShock / 100);
        maxDrawdown = Math.max(maxDrawdown, potentialDrawdown);
    }

    aggregateRisk = round(aggregateRisk / chainRisks.length);

    // Sort to find most/least vulnerable
    const sortedRisks = [...chainRisks].sort((a, b) => b.aggregateRisk - a.aggregateRisk);
    const mostVulnerableChain = sortedRisks[0].chain;
    const leastVulnerableChain = sortedRisks[sortedRisks.length - 1].chain;

    // Generate recommendations
    const rebalancingRecommendations = generateRebalancingRecommendations(portfolio, chainRisks);
    const crossChainArbitrageOpportunities = detectArbitrageOpportunities(portfolio);

    const projectedValue = portfolio.totalUsdValue * (1 - maxDrawdown);

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
    };
}
