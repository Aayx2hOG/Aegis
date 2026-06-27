import { z } from 'zod'

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
})
export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>

export const AgentStatusSchema = z.enum(['idle', 'thinking', 'done', 'error'])
export type AgentStatus = z.infer<typeof AgentStatusSchema>

export const AgentStateSchema = z.object({
  status: AgentStatusSchema,
  currentTool: z.string().nullable(),
  toolCalls: z.array(ToolCallRecordSchema),
  error: z.string().nullable(),
})
export type AgentState = z.infer<typeof AgentStateSchema>

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
  audits: z.string().nullable().optional(),
  chainTvls: z.record(z.string(), z.number()).optional(),
})
export type SolanaProtocol = z.infer<typeof SolanaProtocolSchema>

export const TokenPriceSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  price: z.number(),
  priceChange24h: z.number(),
  volume24h: z.number().nullable().optional(),
  marketCap: z.number().nullable().optional(),
  liquidity: z.number().nullable().optional(),
})
export type TokenPrice = z.infer<typeof TokenPriceSchema>

export const ParsedTransactionSchema = z.object({
  signature: z.string(),
  type: z.string(),
  timestamp: z.number(),
  fee: z.number(),
  source: z.string(),
})
export type ParsedTransaction = z.infer<typeof ParsedTransactionSchema>

// ==========================================
// 3. AI Research Briefs
// ==========================================

export const ResearchBriefSchema = z.object({
  protocol: z.string(),
  brief: z.string(),
  toolCalls: z.array(ToolCallRecordSchema),
})
export type ResearchBrief = z.infer<typeof ResearchBriefSchema>

export const ResearchResponseSchema = z.object({
  brief: ResearchBriefSchema.nullable(),
  loading: z.boolean(),
  error: z.string().nullable(),
})
export type ResearchResponse = z.infer<typeof ResearchResponseSchema>
