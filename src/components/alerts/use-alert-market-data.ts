'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useMultiChain } from '@/components/chain/chain-provider'
import { useMultiChainWatchlistByChain } from '@/lib/hooks/use-multichain-watchlist'
import { fetchJson } from '@/lib/api/fetch-json'
import { normalizeProtocolSlug, resolveProtocolFromList } from '@/lib/protocol/slug-resolver'
import { resolveProtocolGeckoId } from '@/lib/protocol/token-price-resolver'
import type { ChainType } from '@/lib/chain/types'
import type { SolanaProtocol } from '@/lib/types'
import type { AlertMetric, CoinGeckoResponse, DefiLlamaProtocolDetail, WatchlistMarketRow } from './alert-types'
import { getLatestTokenPriceFromProtocolDetail } from './alert-utils'

export function useAlertMarketData(walletAddress?: string) {
  const { allChains } = useMultiChain()
  const { data: watchlistsByChainData } = useMultiChainWatchlistByChain(walletAddress)
  const watchlistsByChain = useMemo<Record<string, string[]>>(
    () => watchlistsByChainData ?? {},
    [watchlistsByChainData],
  )

  const protocolChainTypes = useMemo(() => Array.from(new Set(allChains.map((chain) => chain.type))), [allChains])

  const protocolQueries = useQueries({
    queries: protocolChainTypes.map((chainType) => ({
      queryKey: ['chain-protocols', chainType],
      queryFn: async () => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 12_000)

        try {
          return await fetchJson<SolanaProtocol[]>(`/api/defillama?chain=${encodeURIComponent(chainType)}`, {
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timeout)
        }
      },
      staleTime: 5 * 60_000,
      refetchInterval: false,
      retry: false,
    })),
  })

  const protocolsByChainType = useMemo(() => {
    return protocolChainTypes.reduce<Partial<Record<ChainType, SolanaProtocol[]>>>((acc, chainType, index) => {
      acc[chainType] = (protocolQueries[index]?.data as SolanaProtocol[] | undefined) ?? []
      return acc
    }, {})
  }, [protocolChainTypes, protocolQueries])

  const watchlistMarketRows = useMemo(() => {
    return allChains.flatMap((chain) => {
      const protocols = protocolsByChainType[chain.type] ?? []
      return (watchlistsByChain[chain.name] ?? []).map<WatchlistMarketRow>((slug) => {
        const market = resolveProtocolFromList(slug, protocols)
        const geckoId = resolveProtocolGeckoId(slug, market)

        return { slug, chainName: chain.name, chainType: chain.type, market, geckoId }
      })
    })
  }, [allChains, protocolsByChainType, watchlistsByChain])

  const geckoIds = useMemo(
    () =>
      Array.from(
        new Set(watchlistMarketRows.map((row) => row.geckoId).filter((value): value is string => Boolean(value))),
      ),
    [watchlistMarketRows],
  )

  const priceQueries = useQueries({
    queries: geckoIds.map((geckoId) => ({
      queryKey: ['coingecko-price', geckoId],
      queryFn: async () => {
        const res = await fetchJson<CoinGeckoResponse>(`/api/coingecko?id=${encodeURIComponent(geckoId)}`)
        return {
          priceUsd: res.market_data?.current_price?.usd ?? null,
          priceChange24h: res.market_data?.price_change_percentage_24h ?? null,
        }
      },
      staleTime: 60_000,
      refetchInterval: 2 * 60_000,
      refetchIntervalInBackground: false,
      retry: false,
    })),
  })

  const detailTargets = useMemo(
    () => watchlistMarketRows.filter((row) => !row.geckoId).map((row) => row.slug),
    [watchlistMarketRows],
  )

  const detailQueries = useQueries({
    queries: detailTargets.map((row) => ({
      queryKey: ['defillama-protocol-detail', row],
      queryFn: async () =>
        fetchJson<DefiLlamaProtocolDetail>(`/api/defillama/protocol?slug=${encodeURIComponent(row)}`),
      staleTime: 5 * 60_000,
      refetchInterval: false,
      retry: false,
    })),
  })

  const priceByGeckoId = useMemo(() => {
    return priceQueries.reduce<Record<string, { priceUsd: number | null; priceChange24h: number | null }>>(
      (acc, query, index) => {
        const geckoId = geckoIds[index]
        if (geckoId && query.data) {
          acc[geckoId] = query.data
        }
        return acc
      },
      {},
    )
  }, [geckoIds, priceQueries])

  const priceBySlug = useMemo(() => {
    const result: Record<string, { priceUsd: number | null; priceChange24h: number | null }> = {}

    watchlistMarketRows.forEach((row) => {
      if (row.geckoId) {
        const price = priceByGeckoId[row.geckoId]
        if (price) result[row.slug] = price
        return
      }

      const detail = detailQueries[detailTargets.indexOf(row.slug)]?.data as DefiLlamaProtocolDetail | undefined
      const priceUsd = getLatestTokenPriceFromProtocolDetail(detail)
      if (priceUsd != null) {
        result[row.slug] = { priceUsd, priceChange24h: null }
      }
    })

    return result
  }, [detailQueries, detailTargets, priceByGeckoId, watchlistMarketRows])

  const findMarketProtocol = useMemo(() => {
    return (protocolSlug: string): SolanaProtocol | undefined => {
      const normalizedTarget = normalizeProtocolSlug(protocolSlug)

      const flatProtocols = Object.values(protocolsByChainType)
        .flat()
        .filter((p): p is SolanaProtocol => Boolean(p))
      const match = resolveProtocolFromList(normalizedTarget, flatProtocols)
      if (match) return match

      const rowMatch = watchlistMarketRows.find(
        (row) =>
          normalizeProtocolSlug(row.slug) === normalizedTarget ||
          (row.market && normalizeProtocolSlug(row.market.slug) === normalizedTarget),
      )
      return rowMatch?.market
    }
  }, [protocolsByChainType, watchlistMarketRows])

  const availableAlertProtocolSlugs = useMemo(
    () => Array.from(new Set(watchlistMarketRows.map((row) => row.slug))),
    [watchlistMarketRows],
  )

  function getSelectedAlertCurrentValue(protocolSlug: string, metric: AlertMetric) {
    const selectedAlertMarketRow = watchlistMarketRows.find(
      (row) => normalizeProtocolSlug(row.slug) === normalizeProtocolSlug(protocolSlug),
    )
    if (!selectedAlertMarketRow) return null
    if (metric === 'TVL_USD') return selectedAlertMarketRow.market?.tvl ?? null
    if (metric === 'PRICE_USD') return priceBySlug[selectedAlertMarketRow.slug]?.priceUsd ?? null
    return metric === 'CHANGE_7D'
      ? (selectedAlertMarketRow.market?.change_7d ?? null)
      : (selectedAlertMarketRow.market?.change_1d ?? null)
  }

  return {
    availableAlertProtocolSlugs,
    findMarketProtocol,
    getSelectedAlertCurrentValue,
    priceBySlug,
    watchlistMarketRows,
  }
}
