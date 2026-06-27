import { ChainType } from '@/lib/chain/types'
import type { ParsedTransaction, TokenPrice } from '@/lib/types'

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 6000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return res
  } catch (err) {
    clearTimeout(id)
    throw err
  }
}

function getSubdomain(chainType?: ChainType | string): string {
  if (!chainType) return 'eth'
  const c = String(chainType).toLowerCase()
  if (c.includes('arbitrum')) return 'arbitrum'
  if (c.includes('optimism')) return 'optimism'
  if (c.includes('base')) return 'base'
  if (c.includes('polygon')) return 'polygon'
  return 'eth'
}

function getLlamaChain(chainType?: ChainType | string): string {
  if (!chainType) return 'ethereum'
  const c = String(chainType).toLowerCase()
  if (c.includes('arbitrum')) return 'arbitrum'
  if (c.includes('optimism')) return 'optimism'
  if (c.includes('base')) return 'base'
  if (c.includes('polygon')) return 'polygon'
  return 'ethereum'
}

/**
 * Fetch transaction history from Blockscout
 */
export async function getEvmRecentTransactions(
  address: string,
  chainType?: ChainType | string,
  limit = 10,
): Promise<ParsedTransaction[]> {
  const subdomain = getSubdomain(chainType)
  const url = `https://${subdomain}.blockscout.com/api/v2/addresses/${address}/transactions?limit=${limit}`

  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) throw new Error(`Blockscout status ${res.status}`)
    const data = (await res.json()) as {
      items?: Array<{
        hash: string
        type?: string
        method?: string
        timestamp: string
        fee?: { value?: string }
        result?: string
      }>
    }

    const items = data.items ?? []
    return items.map((tx) => {
      const ts = new Date(tx.timestamp).getTime() / 1000
      const feeWei = tx.fee?.value ? Number(tx.fee.value) : 0
      const feeEth = feeWei / 1e18 // format fee in ether

      return {
        signature: tx.hash,
        type: tx.method || tx.type || 'Transfer',
        timestamp: Number.isFinite(ts) ? ts : Math.floor(Date.now() / 1000),
        fee: feeEth,
        source: `Blockscout (${subdomain})`,
      }
    })
  } catch (err) {
    console.error(`[EVM Transactions] Failed to fetch via Blockscout:`, err)
    throw new Error(`EVM transactions unavailable from Blockscout (${subdomain})`)
  }
}

/**
 * Fetch token metadata from Blockscout
 */
export async function getEvmTokenMetadata(address: string, chainType?: ChainType | string) {
  const subdomain = getSubdomain(chainType)
  const url = `https://${subdomain}.blockscout.com/api/v2/tokens/${address}`

  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) throw new Error(`Blockscout status ${res.status}`)
    const data = (await res.json()) as {
      name?: string
      symbol?: string
      decimals?: string
      total_supply?: string
      icon_url?: string
    }

    return {
      name: data.name ?? 'EVM Token',
      symbol: data.symbol ?? 'EVM',
      decimals: data.decimals ? Number(data.decimals) : 18,
      totalSupply: data.total_supply ?? '0',
      iconUrl: data.icon_url || null,
      source: `Blockscout (${subdomain})`,
    }
  } catch (err) {
    console.error(`[EVM Metadata] Failed to fetch metadata:`, err)
    throw new Error(`EVM token metadata unavailable from Blockscout (${subdomain})`)
  }
}

/**
 * Fetch token pricing from DexScreener with DeFiLlama and Blockscout fallbacks
 */
export async function getEvmTokenPrice(address: string, chainType?: ChainType | string): Promise<TokenPrice> {
  const llamaChain = getLlamaChain(chainType)

  // 1. Try DexScreener first
  try {
    const res = await fetchWithTimeout(`https://api.dexscreener.com/latest/dex/tokens/${address}`)
    if (res.ok) {
      const data = (await res.json()) as {
        pairs?: Array<{
          priceUsd?: string
          priceChange?: { h24?: number }
          volume?: { h24?: number }
          fdv?: number
          marketCap?: number
          liquidity?: { usd?: number }
          baseToken?: { symbol?: string; name?: string }
        }>
      }

      const pairs = data.pairs ?? []
      if (pairs.length > 0) {
        // Find the pair with highest liquidity
        const bestPair = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
        return {
          address,
          symbol: bestPair.baseToken?.symbol ?? 'EVM',
          price: bestPair.priceUsd ? Number(bestPair.priceUsd) : 0,
          priceChange24h: bestPair.priceChange?.h24 ?? 0,
          volume24h: bestPair.volume?.h24 ?? null,
          marketCap: bestPair.marketCap ?? bestPair.fdv ?? null,
          liquidity: bestPair.liquidity?.usd ?? null,
        }
      }
    }
  } catch (err) {
    console.warn(`[DexScreener price query failed]`, err)
  }

  // 2. Fallback: Try DeFiLlama Coins
  try {
    const coinKey = `${llamaChain}:${address}`
    const res = await fetchWithTimeout(`https://coins.llama.fi/prices/current/${coinKey}`)
    if (res.ok) {
      const data = (await res.json()) as {
        coins?: Record<
          string,
          {
            price?: number
            symbol?: string
            confidence?: number
          }
        >
      }

      const info = data.coins?.[coinKey]
      if (info && info.price != null) {
        return {
          address,
          symbol: info.symbol ?? 'EVM',
          price: info.price,
          priceChange24h: 0,
          volume24h: null,
          marketCap: null,
          liquidity: null,
        }
      }
    }
  } catch (err) {
    console.warn(`[DeFiLlama price query failed]`, err)
  }

  throw new Error(`EVM token price unavailable for ${address} on ${llamaChain}`)
}
