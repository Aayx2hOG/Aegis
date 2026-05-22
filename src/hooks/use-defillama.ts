import { useQuery } from '@tanstack/react-query';
import type { SolanaProtocol } from '@/shared/types/protocol';
import { fetchJson } from '@/lib/api/fetch-json';

export function useSolanaProtocols() {
  return useQuery<SolanaProtocol[]>({
    queryKey: ['solana-protocols'],
    queryFn: () => fetchJson<SolanaProtocol[]>('/api/defillama'),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });
}