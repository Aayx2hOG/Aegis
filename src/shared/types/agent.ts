export type AgentStatus = 'idle' | 'thinking' | 'done' | 'error'

export interface ToolCallRecord {
  toolName: string
  input: Record<string, unknown>
  output: unknown
  durationMs: number
}

export interface AgentState {
  status: AgentStatus
  currentTool: string | null
  toolCalls: ToolCallRecord[]
  error: string | null
}