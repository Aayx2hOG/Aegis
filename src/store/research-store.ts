import { atom } from 'jotai';
import type { AgentState } from '@/shared/types/agent';
import type { ResearchResponse } from '@/shared/types/research';

export const agentStateAtom = atom<AgentState>({
  status: 'idle',
  currentTool: null,
  toolCalls: [],
  error: null,
});

export const researchResultAtom = atom<ResearchResponse | null>(null);

export const queryHistoryAtom = atom<string[]>([]);