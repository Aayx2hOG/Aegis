import type { ParsedTransaction } from '@/lib/types/protocol';

const BASE = 'https://api.helius.xyz/v0';
const KEY = process.env.HELIUS_API_KEY!; // server-only

export async function getRecentTransactions(address: string, limit = 10): Promise<ParsedTransaction[]> {
  const res = await fetch(
    `${BASE}/addresses/${address}/transactions?api-key=${KEY}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Helius error: ${res.status}`);
  return res.json();
}

export async function getTokenHolders(mint: string) {
  const res = await fetch(`${BASE}/token-metadata?api-key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mintAccounts: [mint] }),
  });
  if (!res.ok) throw new Error(`Helius error: ${res.status}`);
  return res.json();
}