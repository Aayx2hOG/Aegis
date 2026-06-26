import { NextRequest } from 'next/server'
import { getEvmTokenPrice } from '@/server/api/evm'
import {
  getProtocolTokenIdCandidates,
  getProtocolTokenSearchTerms,
  pickBestCoinGeckoSearchMatch,
  type CoinGeckoSearchCoin,
} from '@/lib/protocol/token-price-resolver'

async function fetchCoinById(coinId: string) {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
      coinId,
    )}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
  )
  if (!res.ok) {
    throw new Error(`Coingecko error ${res.status}`)
  }
  return res.json()
}

async function fetchLlamaCoinPrice(coinId: string) {
  const coinKey = `coingecko:${coinId}`
  const llamaRes = await fetch(`https://coins.llama.fi/prices/current/${coinKey}`)
  if (!llamaRes.ok) return null

  const llamaData = (await llamaRes.json()) as {
    coins?: Record<
      string,
      {
        price?: number
        symbol?: string
      }
    >
  }

  const info = llamaData.coins?.[coinKey]
  if (!info || info.price == null) return null

  return {
    id: coinId,
    symbol: info.symbol ?? coinId,
    market_data: {
      current_price: { usd: info.price },
      price_change_percentage_24h: 0,
    },
  }
}

async function searchCoinGeckoId(coinId: string): Promise<string | null> {
  const terms = getProtocolTokenSearchTerms(coinId)

  for (const term of terms) {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(term)}`)
      if (!res.ok) continue

      const data = (await res.json()) as { coins?: CoinGeckoSearchCoin[] }
      const match = pickBestCoinGeckoSearchMatch(term, data.coins ?? [])
      if (match) return match.id
    } catch (err) {
      console.warn(`[api/coingecko] search failed for ${term}`, err)
    }
  }

  return null
}

export async function GET(req: NextRequest) {
  const coinId = req.nextUrl.searchParams.get('id')
  if (!coinId) return Response.json({ error: 'id required' }, { status: 400 })

  // 1. If it's a contract address (starts with 0x), bypass CoinGecko and use DexScreener/DeFiLlama
  if (coinId.startsWith('0x')) {
    try {
      const price = await getEvmTokenPrice(coinId, 'ethereum')
      return Response.json({
        id: coinId,
        symbol: price.symbol,
        market_data: {
          current_price: { usd: price.price },
          price_change_percentage_24h: price.priceChange24h,
        },
      })
    } catch (err) {
      console.error(`[api/coingecko] EVM pricing fallback error:`, err)
    }
  }

  const candidates = getProtocolTokenIdCandidates(coinId)

  // 2. Try direct CoinGecko ids and deterministic protocol aliases.
  for (const candidate of candidates) {
    try {
      const data = await fetchCoinById(candidate)
      return Response.json(data)
    } catch {
      // Continue through deterministic candidates before using broader search.
    }
  }

  // 3. Use CoinGecko search to resolve protocol-like slugs to token ids.
  const searchedId = await searchCoinGeckoId(coinId)
  if (searchedId && !candidates.includes(searchedId)) {
    try {
      const data = await fetchCoinById(searchedId)
      return Response.json(data)
    } catch {
      candidates.push(searchedId)
    }
  }

  // 4. Fallback: DeFiLlama Coins API supports coingecko:<id> keys.
  for (const candidate of candidates) {
    try {
      const llamaData = await fetchLlamaCoinPrice(candidate)
      if (llamaData) return Response.json(llamaData)
    } catch (fallbackErr) {
      console.error(`[api/coingecko] DeFiLlama fallback failed for ${candidate}`, fallbackErr)
    }
  }

  return Response.json({})
}
