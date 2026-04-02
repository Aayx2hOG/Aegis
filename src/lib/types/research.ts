// ─── Types for the agentic research layer ────────────────────────────────────

export interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  durationMs: number;
  error?: string;
}

export interface ResearchBrief {
  protocol: string;
  brief: string;           // markdown text from Aegis AI
  toolCalls: ToolCallRecord[];
}

// Legacy shapes kept for Jotai store compatibility
export interface ResearchQuery {
  query: string;
  protocols?: string[];
}

export interface ResearchResponse {
  answer: string;
  briefs: ResearchBrief[];
  toolCallsUsed: string[];
}