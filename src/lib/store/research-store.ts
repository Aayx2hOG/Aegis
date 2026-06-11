import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { AgentState, ResearchResponse } from '@/lib/types'

export const agentStateAtom = atom<AgentState>({
  status: 'idle',
  currentTool: null,
  toolCalls: [],
  error: null,
})

export const researchResultAtom = atom<ResearchResponse | null>(null)

export const queryHistoryAtom = atom<string[]>([])

export const beginnerModeAtom = atomWithStorage<boolean>('aegis-beginner-mode', false)

