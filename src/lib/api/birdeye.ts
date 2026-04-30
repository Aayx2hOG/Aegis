import type { TokenPrice } from '@/lib/types/protocol';

const BASE = 'https://public-api.birdeye.so';
const KEY = process.env.BIRDEYE_API_KEY!;

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asPositiveNumber(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

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
    price: asPositiveNumber(data.value) ?? 0,
    priceChange24h: asNumber(data.priceChange24h) ?? 0,
    volume24h: asPositiveNumber(data.v24hUSD),
    marketCap: asPositiveNumber(data.mc),
    liquidity: asPositiveNumber(data.liquidity),
  };
}