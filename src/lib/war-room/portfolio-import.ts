/* eslint-disable @typescript-eslint/no-explicit-any */

import { ChainType } from '@/lib/chain/types'
import { resolveProtocolFromList } from '@/lib/protocol/slug-resolver'
import type { ChainPortfolioPosition } from '@/lib/types'

const MAP_DEFILLAMA_CHAIN_TO_CHAIN_TYPE: Record<string, ChainType> = {
  solana: ChainType.Solana,
  ethereum: ChainType.Ethereum,
  polygon: ChainType.Polygon,
  arbitrum: ChainType.Arbitrum,
  optimism: ChainType.Optimism,
  cosmos: ChainType.Cosmos,
  base: ChainType.Base,
}

function mapCategoryToKind(category: string): ChainPortfolioPosition['kind'] {
  const cat = category.toLowerCase()
  if (cat.includes('lending') || cat.includes('cdp')) return 'lending'
  if (cat.includes('yield') || cat.includes('farm') || cat.includes('vault')) return 'yield'
  if (cat.includes('staking') || cat.includes('restaking')) return 'yield'
  if (cat.includes('lp') || cat.includes('amm') || cat.includes('dex')) return 'lp'
  if (cat.includes('token')) return 'token'
  return 'other'
}

function getVolatility(category: string): number {
  const cat = category.toLowerCase()
  if (cat.includes('stable') || cat.includes('peg')) return 5
  if (cat.includes('lending') || cat.includes('cdp') || cat.includes('staking')) return 45
  if (cat.includes('yield') || cat.includes('farm') || cat.includes('vault')) return 60
  if (cat.includes('derivatives') || cat.includes('perpetuals') || cat.includes('options')) return 85
  return 55
}

function getLiquidityScore(tvl: number): number {
  if (tvl <= 0) return 50
  const score = Math.round(20 + 10 * Math.log10(tvl / 1000))
  return Math.min(98, Math.max(10, score))
}

function getLatestTokenPriceFromProtocolDetail(detail?: any): number | null {
  if (!detail) return null

  const latestUsdEntry = detail.tokensInUsd?.[detail.tokensInUsd.length - 1]
  const latestTokenEntry = detail.tokens?.[detail.tokens.length - 1]
  if (!latestUsdEntry || !latestTokenEntry) return null

  const usdTokens = latestUsdEntry.tokens ?? {}
  const rawTokens = latestTokenEntry.tokens ?? {}
  const symbols = Object.keys(usdTokens)

  for (const symbol of symbols) {
    const usdValue = usdTokens[symbol]
    const tokenAmount = rawTokens[symbol]
    if (typeof usdValue === 'number' && typeof tokenAmount === 'number' && tokenAmount > 0) {
      const derived = usdValue / tokenAmount
      if (Number.isFinite(derived) && derived > 0) return derived
    }
  }

  return null
}

export async function fetchAndBuildPositions(protocolSlug: string): Promise<ChainPortfolioPosition[]> {
  const res = await fetch(`/api/defillama/protocol?slug=${encodeURIComponent(protocolSlug)}`)
  if (!res.ok) throw new Error(`Status ${res.status}`)
  const data = await res.json()

  if (data.error) {
    throw new Error(data.error)
  }

  const chainsList: string[] = data.chains || []
  const category: string = data.category || 'other'
  const symbol: string = (data.symbol && data.symbol !== '-' ? data.symbol : protocolSlug).toUpperCase()

  let tokenPrice = 0
  let geckoId = data.gecko_id || data.geckoId || protocolSlug
  const address = data.address

  if (address) {
    try {
      const priceRes = await fetch(`https://coins.llama.fi/prices/current/${address}`)
      if (priceRes.ok) {
        const priceData = await priceRes.json()
        const coinInfo = priceData.coins?.[address]
        if (coinInfo && coinInfo.price != null) {
          tokenPrice = coinInfo.price
        }
      }
    } catch (addressErr) {
      console.error('Failed to fetch price by address:', addressErr)
    }
  }

  if (tokenPrice === 0 && address && !address.includes(':') && chainsList.length > 0) {
    const formattedAddress = `${chainsList[0].toLowerCase()}:${address}`
    try {
      const priceRes = await fetch(`https://coins.llama.fi/prices/current/${formattedAddress}`)
      if (priceRes.ok) {
        const priceData = await priceRes.json()
        const coinInfo = priceData.coins?.[formattedAddress]
        if (coinInfo && coinInfo.price != null) {
          tokenPrice = coinInfo.price
        }
      }
    } catch (addressErr) {
      console.error('Failed to fetch price by formatted address:', addressErr)
    }
  }

  if (tokenPrice === 0 && address) {
    const cleanAddress = address.includes(':') ? address.split(':')[1] : address
    if (cleanAddress.startsWith('0x') || cleanAddress.length >= 32) {
      try {
        const dexscreenerRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanAddress}`)
        if (dexscreenerRes.ok) {
          const dexscreenerData = await dexscreenerRes.json()
          const pairs = dexscreenerData.pairs || []
          if (pairs.length > 0) {
            const bestPair = pairs.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
            if (bestPair && bestPair.priceUsd) {
              tokenPrice = Number(bestPair.priceUsd)
            }
          }
        }
      } catch (dexErr) {
        console.error('Failed to fetch price from DexScreener by address:', dexErr)
      }
    }
  }

  if (tokenPrice === 0) {
    if (!geckoId && chainsList.length > 0) {
      const primaryChain = chainsList[0].toLowerCase()
      const mappedChain = MAP_DEFILLAMA_CHAIN_TO_CHAIN_TYPE[primaryChain]
      if (mappedChain) {
        try {
          const listRes = await fetch(`/api/defillama?chain=${encodeURIComponent(mappedChain)}`)
          if (listRes.ok) {
            const listData = await listRes.json()
            const matched = resolveProtocolFromList(protocolSlug, listData)
            if (matched) {
              geckoId = (matched as any).gecko_id || (matched as any).geckoId
            }
          }
        } catch (listErr) {
          console.error('Failed to fetch chain protocols list for lookup:', listErr)
        }
      }
    }

    if (geckoId) {
      try {
        const priceRes = await fetch(`/api/coingecko?id=${encodeURIComponent(geckoId)}`)
        if (priceRes.ok) {
          const priceData = await priceRes.json()
          tokenPrice = priceData.market_data?.current_price?.usd || 0
        }
      } catch (priceErr) {
        console.error('Failed to fetch price from CoinGecko:', priceErr)
      }
    }
  }

  if (tokenPrice === 0 && symbol && symbol !== '-') {
    try {
      const dexscreenerRes = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`,
      )
      if (dexscreenerRes.ok) {
        const dexscreenerData = await dexscreenerRes.json()
        const pairs = dexscreenerData.pairs || []
        const matchingPairs = pairs.filter((p: any) => p.baseToken?.symbol?.toUpperCase() === symbol.toUpperCase())
        if (matchingPairs.length > 0) {
          const bestPair = matchingPairs.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
          if (bestPair && bestPair.priceUsd) {
            tokenPrice = Number(bestPair.priceUsd)
          }
        }
      }
    } catch (dexErr) {
      console.error('Failed to fetch price from DexScreener by symbol:', dexErr)
    }
  }

  if (tokenPrice === 0) {
    tokenPrice = getLatestTokenPriceFromProtocolDetail(data) || 0
  }

  if (tokenPrice === 0) {
    tokenPrice = 1.0
  }

  const chainDataList = chainsList
    .map((chainName) => {
      const normalizedChain = chainName.trim().toLowerCase()
      const chainType = MAP_DEFILLAMA_CHAIN_TO_CHAIN_TYPE[normalizedChain]
      if (!chainType) return null

      let chainTvl = 0
      if (data.chainTvls && data.chainTvls[chainName]) {
        const history = data.chainTvls[chainName].tvl || []
        if (history.length > 0) {
          chainTvl = history[history.length - 1].totalLiquidity || 0
        }
      }
      if (chainTvl === 0 && data.tvl) {
        const history = data.tvl || []
        if (history.length > 0) {
          chainTvl = history[history.length - 1].totalLiquidity || 0
        }
      }

      return { chainType, chainTvl }
    })
    .filter((chainData): chainData is NonNullable<typeof chainData> => chainData !== null)

  return chainDataList.map((chainData) => ({
    chain: chainData.chainType,
    kind: mapCategoryToKind(category),
    symbol,
    protocol: protocolSlug.toLowerCase(),
    balance: 1,
    usdValue: tokenPrice,
    volatility: getVolatility(category),
    liquidityScore: getLiquidityScore(chainData.chainTvl),
  }))
}
