import { useQuery } from '@tanstack/react-query';
import type { SolanaProtocol } from '@/shared/types/protocol';

export function useSolanaProtocols() {
  return useQuery<SolanaProtocol[]>({
    queryKey: ['solana-protocols'],
    queryFn: () => fetch('/api/defillama').then((r) => r.json()),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}