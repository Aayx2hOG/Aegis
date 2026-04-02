import { atom } from 'jotai';
import type { AgentState } from '@/lib/types/agent';
import type { ResearchResponse } from '@/lib/types/research';

export const agentStateAtom = atom<AgentState>({
  status: 'idle',
  currentTool: null,
  toolCalls: [],
  error: null,
});

export const researchResultAtom = atom<ResearchResponse | null>(null);

export const queryHistoryAtom = atom<string[]>([]);