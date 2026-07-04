import { useQuery } from '@tanstack/react-query'
import { ChainType } from '@/lib/chain/types'
import type { SolanaProtocol } from '@/lib/types'
import { fetchJson } from '@/lib/api/fetch-json'
import { useHydrated } from '@/lib/hooks/use-hydrated'

export function useChainProtocols(chainType: ChainType) {
  const hydrated = useHydrated()
  return useQuery<SolanaProtocol[]>({
    queryKey: ['chain-protocols', chainType],
    enabled: hydrated,
    queryFn: async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20_000)

      try {
        return await fetchJson<SolanaProtocol[]>(`/api/defillama?chain=${encodeURIComponent(chainType)}`, {
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }
    },
    staleTime: 5 * 60_000,
    refetchOnMount: 'always',
    refetchInterval: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 3_000),
  })
}

export function useSolanaProtocols() {
  return useChainProtocols(ChainType.Solana)
}
