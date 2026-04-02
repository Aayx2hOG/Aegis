import { useQuery } from '@tanstack/react-query';
import type { ParsedTransaction } from '@/lib/types/protocol';

export function useRecentTransactions(address: string | null, limit = 10) {
  return useQuery<ParsedTransaction[]>({
    queryKey: ['helius-txns', address, limit],
    queryFn: () =>
      fetch(`/api/helius?address=${address}&limit=${limit}`).then((r) => r.json()),
    enabled: !!address,
    staleTime: 15_000,
  });
}