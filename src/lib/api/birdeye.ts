import type { TokenPrice } from '@/lib/types/protocol';

const BASE = 'https://public-api.birdeye.so';
const KEY = process.env.BIRDEYE_API_KEY!;

export async function getTokenPrice(address: string): Promise<TokenPrice> {
  const res = await fetch(`${BASE}/defi/price?address=${address}`, {
    headers: { 'X-API-KEY': KEY },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`Birdeye error: ${res.status}`);
  const { data } = await res.json();
  return {
    address,
    symbol: data.symbol ?? '',
    price: data.value ?? 0,
    priceChange24h: data.priceChange24h ?? 0,
    volume24h: data.v24hUSD ?? 0,
    marketCap: data.mc ?? null,
    liquidity: data.liquidity ?? null,
  };
}