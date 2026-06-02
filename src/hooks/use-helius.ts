import { useQuery } from '@tanstack/react-query';
import type { ParsedTransaction } from '@/shared/types';
import { fetchJson } from '@/lib/api/fetch-json';

export function useRecentTransactions(address: string | null, limit = 10) {
  return useQuery<ParsedTransaction[]>({
    queryKey: ['helius-txns', address, limit],
    queryFn: () => fetchJson<ParsedTransaction[]>(`/api/helius?address=${address}&limit=${limit}`),
    enabled: !!address,
    staleTime: 15_000,
    retry: false,
  });
}