import { NextRequest } from 'next/server';
import { getEvmTokenPrice } from '@/server/api/evm';

export async function GET(req: NextRequest) {
  const coinId = req.nextUrl.searchParams.get('id');
  if (!coinId) return Response.json({ error: 'id required' }, { status: 400 });

  // 1. If it's a contract address (starts with 0x), bypass CoinGecko and use DexScreener/DeFiLlama
  if (coinId.startsWith('0x')) {
    try {
      const price = await getEvmTokenPrice(coinId, 'ethereum');
      return Response.json({
        id: coinId,
        symbol: price.symbol,
        market_data: {
          current_price: { usd: price.price },
          price_change_percentage_24h: price.priceChange24h,
        },
      });
    } catch (err) {
      console.error(`[api/coingecko] EVM pricing fallback error:`, err);
    }
  }

  // 2. Fetch standard CoinGecko ID
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}`);
    if (!res.ok) {
      throw new Error(`Coingecko error ${res.status}`);
    }
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    console.warn(`[api/coingecko] main fetch failed, attempting DeFiLlama Coins fallback`, err);

    // 3. Fallback: Use DeFiLlama Coins API (which supports coingecko:<id> prefix)
    try {
      const coinKey = `coingecko:${coinId}`;
      const llamaRes = await fetch(`https://coins.llama.fi/prices/current/${coinKey}`);
      if (llamaRes.ok) {
        const llamaData = await llamaRes.json() as {
          coins?: Record<string, {
            price?: number;
            symbol?: string;
          }>;
        };

        const info = llamaData.coins?.[coinKey];
        if (info && info.price != null) {
          return Response.json({
            id: coinId,
            symbol: info.symbol ?? coinId,
            market_data: {
              current_price: { usd: info.price },
              price_change_percentage_24h: 0, // Llama coins current price has no direct 24h change, default 0
            },
          });
        }
      }
    } catch (fallbackErr) {
      console.error(`[api/coingecko] all fallbacks exhausted`, fallbackErr);
    }

    return Response.json({});
  }
}
