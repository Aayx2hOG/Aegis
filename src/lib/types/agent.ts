export type AgentStatus = 'idle' | 'thinking' | 'fetching' | 'synthesizing' | 'done' | 'error';

export interface AgentToolCall {
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  durationMs?: number;
}

export interface AgentState {
  status: AgentStatus;
  currentTool: string | null;
  toolCalls: AgentToolCall[];
  error: string | null;
}

export interface AegisTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}