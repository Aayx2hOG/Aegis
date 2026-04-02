import type { SolanaProtocol } from '@/lib/types/protocol';

const BASE = 'https://api.llama.fi';

export async function getSolanaProtocols(): Promise<SolanaProtocol[]> {
  const res = await fetch(`${BASE}/protocols`, {
    next: { revalidate: 60 }, // cache at the CDN edge for 60s
  });
  if (!res.ok) throw new Error(`DeFiLlama error: ${res.status}`);
  const all: SolanaProtocol[] = await res.json();
  return all.filter((p) => p.chains?.includes('Solana'));
}

export async function getProtocolTvl(slug: string) {
  const res = await fetch(`${BASE}/protocol/${slug}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`DeFiLlama error: ${res.status}`);
  return res.json();
}