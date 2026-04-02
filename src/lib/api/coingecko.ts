// Uses public CoinGecko API (no key needed for basic endpoints)
const BASE = 'https://api.coingecko.com/api/v3';

export async function getSolanaTokenData(ids: string[]) {
  const joined = ids.join(',');
  const res = await fetch(
    `${BASE}/simple/price?ids=${joined}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  return res.json();
}