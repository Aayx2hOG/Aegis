import { z } from 'zod';
import { ChainType } from '@/lib/chain/types';

// ==========================================
// 1. Agent State & Tool Call Records
// ==========================================

export const ToolCallRecordSchema = z.object({
  tool: z.string(),
  toolName: z.string().optional(), // For backwards compatibility
  input: z.record(z.string(), z.unknown()),
  output: z.unknown(),
  durationMs: z.number(),
  error: z.string().optional(),
});
export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>;

export const AgentStatusSchema = z.enum(['idle', 'thinking', 'done', 'error']);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AgentStateSchema = z.object({
  status: AgentStatusSchema,
  currentTool: z.string().nullable(),
  toolCalls: z.array(ToolCallRecordSchema),
  error: z.string().nullable(),
});
export type AgentState = z.infer<typeof AgentStateSchema>;

// ==========================================
// 2. Protocols, Tokens, & Transactions
// ==========================================

export const SolanaProtocolSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tvl: z.number().optional(),
  change_1d: z.number().nullable().optional(),
  change_7d: z.number().nullable().optional(),
  chains: z.array(z.string()).optional(),
  category: z.string().optional(),
});
export type SolanaProtocol = z.infer<typeof SolanaProtocolSchema>;

export const TokenPriceSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  price: z.number(),
  priceChange24h: z.number(),
  volume24h: z.number().nullable().optional(),
  marketCap: z.number().nullable().optional(),
  liquidity: z.number().nullable().optional(),
});
export type TokenPrice = z.infer<typeof TokenPriceSchema>;

export const ParsedTransactionSchema = z.object({
  signature: z.string(),
  type: z.string(),
  timestamp: z.number(),
  fee: z.number(),
  source: z.string(),
});
export type ParsedTransaction = z.infer<typeof ParsedTransactionSchema>;

// ==========================================
// 3. AI Research Briefs
// ==========================================

export const ResearchBriefSchema = z.object({
  protocol: z.string(),
  brief: z.string(),
  toolCalls: z.array(ToolCallRecordSchema),
});
export type ResearchBrief = z.infer<typeof ResearchBriefSchema>;

export const ResearchResponseSchema = z.object({
  brief: ResearchBriefSchema.nullable(),
  loading: z.boolean(),
  error: z.string().nullable(),
});
export type ResearchResponse = z.infer<typeof ResearchResponseSchema>;

// ==========================================
// 4. War Room Simulation (Single Chain)
// ==========================================

export const PortfolioPositionSchema = z.object({
  id: z.string(),
  label: z.string(),
  symbol: z.string(),
  protocol: z.string(),
  kind: z.enum(['token', 'staking', 'lending', 'lp']),
  usdValue: z.number(),
  collateralFactor: z.number().optional(),
  volatility: z.number(),
  liquidityScore: z.number(),
});
export type PortfolioPosition = z.infer<typeof PortfolioPositionSchema>;

export const ScenarioConfigSchema = z.object({
  type: z.enum(['market-crash', 'stablecoin-depeg', 'smart-contract-incident']),
  title: z.string(),
  beginnerLabel: z.string(),
  beginnerSummary: z.string(),
  marketShockPct: z.number(),
  stablecoinDepegPct: z.number(),
  liquidityDropPct: z.number(),
  oracleDelayMinutes: z.number(),
  protocolExploitSeverity: z.number(),
});
export type ScenarioConfig = z.infer<typeof ScenarioConfigSchema>;

export const RiskBreakdownSchema = z.object({
  marketRisk: z.number(),
  liquidityRisk: z.number(),
  concentrationRisk: z.number(),
  liquidationRisk: z.number(),
  smartContractRisk: z.number(),
});
export type RiskBreakdown = z.infer<typeof RiskBreakdownSchema>;

export const RiskActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  rationale: z.string(),
  impact: z.object({
    riskReduction: z.number(),
    estimatedCostUsd: z.number(),
    confidence: z.number(),
  }),
});
export type RiskAction = z.infer<typeof RiskActionSchema>;

export const SimulationResultSchema = z.object({
  scenario: ScenarioConfigSchema,
  summary: z.object({
    portfolioValueUsd: z.number(),
    projectedValueUsd: z.number(),
    projectedDrawdownPct: z.number(),
    valueAtRiskUsd: z.number(),
    riskScoreBefore: z.number(),
    riskScoreAfterShock: z.number(),
    liquidationProbabilityPct: z.number(),
  }),
  riskBreakdown: RiskBreakdownSchema,
  topActions: z.array(RiskActionSchema),
  generatedAt: z.string(),
});
export type SimulationResult = z.infer<typeof SimulationResultSchema>;

export const SimulationRequestSchema = z.object({
  positions: z.array(PortfolioPositionSchema),
  scenario: ScenarioConfigSchema,
});
export type SimulationRequest = z.infer<typeof SimulationRequestSchema>;

// ==========================================
// 5. Comparative War Room (Multi-Chain)
// ==========================================

export const ChainPortfolioPositionSchema = z.object({
  chain: z.nativeEnum(ChainType),
  kind: z.enum(['token', 'lp', 'lending', 'yield', 'other']),
  symbol: z.string(),
  protocol: z.string(),
  balance: z.number(),
  usdValue: z.number(),
  volatility: z.number(),
  liquidityScore: z.number(),
  collateralFactor: z.number().optional(),
  apy: z.number().optional(),
});
export type ChainPortfolioPosition = z.infer<typeof ChainPortfolioPositionSchema>;

export const MultiChainPortfolioSchema = z.object({
  walletAddress: z.string(),
  positions: z.array(ChainPortfolioPositionSchema),
  totalUsdValue: z.number(),
  chains: z.array(z.nativeEnum(ChainType)),
  lastUpdated: z.date().or(z.string().transform((val) => new Date(val))),
});
export type MultiChainPortfolio = z.infer<typeof MultiChainPortfolioSchema>;

export const ChainScenarioConfigSchema = z.object({
  marketShockPct: z.number(),
  liquidityDropPct: z.number(),
  protocolExploitSeverity: z.number(),
  oracleDelayMinutes: z.number(),
  bridgeOutageDurationMinutes: z.number().optional(),
  chainsAffected: z.array(z.nativeEnum(ChainType)).optional(),
});
export type ChainScenarioConfig = z.infer<typeof ChainScenarioConfigSchema>;

export const ChainRiskBreakdownSchema = z.object({
  chain: z.nativeEnum(ChainType),
  marketRisk: z.number(),
  liquidityRisk: z.number(),
  concentrationRisk: z.number(),
  liquidationRisk: z.number(),
  smartContractRisk: z.number(),
  bridgeRisk: z.number().optional(),
  aggregateRisk: z.number(),
});
export type ChainRiskBreakdown = z.infer<typeof ChainRiskBreakdownSchema>;

export const RebalancingRecommendationSchema = z.object({
  action: z.enum(['move', 'liquidate', 'increase']),
  fromChain: z.nativeEnum(ChainType).optional(),
  toChain: z.nativeEnum(ChainType).optional(),
  assetSymbol: z.string(),
  protocol: z.string(),
  amount: z.number(),
  rationale: z.string(),
  expectedRiskReduction: z.number(),
});
export type RebalancingRecommendation = z.infer<typeof RebalancingRecommendationSchema>;

export const ArbitrageOpportunitySchema = z.object({
  assetSymbol: z.string(),
  fromChain: z.nativeEnum(ChainType),
  toChain: z.nativeEnum(ChainType),
  bridgeRequired: z.boolean(),
  expectedProfit: z.number(),
  profitMargin: z.number(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  rationale: z.string(),
});
export type ArbitrageOpportunity = z.infer<typeof ArbitrageOpportunitySchema>;

export const ComparativeSimulationResultSchema = z.object({
  scenario: ChainScenarioConfigSchema,
  chainRisks: z.array(ChainRiskBreakdownSchema),
  aggregateRisk: z.number(),
  portfolioImpact: z.object({
    totalUsdValue: z.number(),
    projectedValue: z.number(),
    maxDrawdown: z.number(),
  }),
  riskByChain: z.record(z.nativeEnum(ChainType), z.number()),
  mostVulnerableChain: z.nativeEnum(ChainType),
  leastVulnerableChain: z.nativeEnum(ChainType),
  rebalancingRecommendations: z.array(RebalancingRecommendationSchema),
  crossChainArbitrageOpportunities: z.array(ArbitrageOpportunitySchema),
  aiBriefing: z.string().optional(),
});
export type ComparativeSimulationResult = z.infer<typeof ComparativeSimulationResultSchema>;

export const ChainComparisonMetricsSchema = z.object({
  chain: z.nativeEnum(ChainType),
  averageGasPrice: z.number(),
  tvlUsd: z.number(),
  dominantProtocol: z.string(),
  bridgeLiquidity: z.number(),
  averageBlockTime: z.number(),
  validatorHealth: z.number(),
});
export type ChainComparisonMetrics = z.infer<typeof ChainComparisonMetricsSchema>;
