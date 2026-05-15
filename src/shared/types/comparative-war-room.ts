import { ChainType } from '@/lib/chain/types';

// Extend existing war-room types with chain information
export interface ChainPortfolioPosition {
    chain: ChainType;
    kind: 'token' | 'lp' | 'lending' | 'yield' | 'other';
    symbol: string;
    protocol: string;
    balance: number;
    usdValue: number;
    volatility: number;
    liquidityScore: number;
    collateralFactor?: number;
    apy?: number;
}

export interface MultiChainPortfolio {
    walletAddress: string;
    positions: ChainPortfolioPosition[];
    totalUsdValue: number;
    chains: ChainType[];
    lastUpdated: Date;
}

export interface ChainScenarioConfig {
    marketShockPct: number;
    liquidityDropPct: number;
    protocolExploitSeverity: number;
    oracleDelayMinutes: number;
    bridgeOutageDurationMinutes?: number;
    chainsAffected?: ChainType[];
}

export interface ChainRiskBreakdown {
    chain: ChainType;
    marketRisk: number;
    liquidityRisk: number;
    concentrationRisk: number;
    liquidationRisk: number;
    smartContractRisk: number;
    bridgeRisk?: number;
    aggregateRisk: number;
}

export interface ComparativeSimulationResult {
    scenario: ChainScenarioConfig;
    chainRisks: ChainRiskBreakdown[];
    aggregateRisk: number;
    portfolioImpact: {
        totalUsdValue: number;
        projectedValue: number;
        maxDrawdown: number;
    };

    // Comparative insights
    riskByChain: Record<ChainType, number>;
    mostVulnerableChain: ChainType;
    leastVulnerableChain: ChainType;
    rebalancingRecommendations: RebalancingRecommendation[];
    crossChainArbitrageOpportunities: ArbitrageOpportunity[];
}

export interface RebalancingRecommendation {
    action: 'move' | 'liquidate' | 'increase';
    fromChain?: ChainType;
    toChain?: ChainType;
    assetSymbol: string;
    protocol: string;
    amount: number;
    rationale: string;
    expectedRiskReduction: number;
}

export interface ArbitrageOpportunity {
    assetSymbol: string;
    fromChain: ChainType;
    toChain: ChainType;
    bridgeRequired: boolean;
    expectedProfit: number;
    profitMargin: number;
    riskLevel: 'low' | 'medium' | 'high';
    rationale: string;
}

export interface ChainComparisonMetrics {
    chain: ChainType;
    averageGasPrice: number;
    tvlUsd: number;
    dominantProtocol: string;
    bridgeLiquidity: number;
    averageBlockTime: number;
    validatorHealth: number; // 0-100 score
}
