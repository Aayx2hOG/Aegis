import { useQuery } from '@tanstack/react-query';
import { ChainType } from '@/lib/chain/types';
import type { SolanaProtocol } from '@/shared/types/protocol';
import { fetchJson } from '@/lib/api/fetch-json';

export function useChainProtocols(chainType: ChainType) {
  return useQuery<SolanaProtocol[]>({
    queryKey: ['chain-protocols', chainType],
    queryFn: () => fetchJson<SolanaProtocol[]>(`/api/defillama?chain=${encodeURIComponent(chainType)}`),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useSolanaProtocols() {
  return useChainProtocols(ChainType.Solana);
}