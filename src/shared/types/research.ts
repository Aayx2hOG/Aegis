export interface ResearchBrief {
  protocol: string
  brief: string
  toolCalls: ToolCallRecord[]
}

export interface ToolCallRecord {
  tool: string
  input: Record<string, unknown>
  output: unknown
  durationMs: number
  error?: string
}

export interface ResearchResponse {
  brief: ResearchBrief | null
  loading: boolean
  error: string | null
}