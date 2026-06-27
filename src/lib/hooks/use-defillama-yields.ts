import { useQuery } from '@tanstack/react-query'
import { ChainType } from '@/lib/chain/types'
import { fetchJson } from '@/lib/api/fetch-json'
import type { ProtocolYieldSummary } from '@/lib/opportunities/yields'
import { useHydrated } from '@/lib/hooks/use-hydrated'

type YieldResponse = {
  data: ProtocolYieldSummary[]
  source: string
  fetchedAt: string
  unavailable?: boolean
}

export function useProtocolYields(chainType: ChainType) {
  const hydrated = useHydrated()
  return useQuery<YieldResponse>({
    queryKey: ['protocol-yields', chainType],
    enabled: hydrated,
    queryFn: () => fetchJson<YieldResponse>(`/api/defillama/yields?chain=${encodeURIComponent(chainType)}`),
    staleTime: 5 * 60_000,
    refetchOnMount: 'always',
    retry: 1,
  })
}
