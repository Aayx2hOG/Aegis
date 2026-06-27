'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChainType } from '@/lib/chain/types'
import { useMultiChain } from '@/components/chain/chain-provider'
import { normalizeProtocolSlug } from '@/lib/protocol/slug-resolver'
import { toast } from 'sonner'

const MAX_WATCHLIST_ITEMS = 20
const WATCHLIST_UPDATED_EVENT = 'aegis-watchlist-updated'

function notifyWatchlistUpdated() {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new Event(WATCHLIST_UPDATED_EVENT))
}

/**
 * Generate cache key for watchlist across chains
 * Format: watchlist-cache:{chainType}:{environment}:{walletAddress|guest}
 */
function getWatchlistCacheKey(chainType: ChainType, environment: string, walletAddress?: string): string {
  return `watchlist-cache:${chainType}:${environment}:${walletAddress ?? 'guest'}`
}

function sanitizeWatchlist(slugs: string[]): string[] {
  const normalized = slugs.map((slug) => normalizeProtocolSlug(slug)).filter(Boolean)
  return Array.from(new Set(normalized)).slice(0, MAX_WATCHLIST_ITEMS)
}

function loadWatchlistByKey(cacheKey: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(cacheKey)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return sanitizeWatchlist(parsed.filter((v): v is string => typeof v === 'string'))
  } catch {
    return []
  }
}

function saveWatchlistByKey(cacheKey: string, slugs: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(sanitizeWatchlist(slugs)))
  } catch {
    console.error('Failed to save watchlist')
  }
}

function migrateLegacyWatchlist(chainType: ChainType, environment: string, walletAddress?: string): string[] {
  if (typeof window === 'undefined') return []

  const currentKey = getWatchlistCacheKey(chainType, environment, walletAddress)
  const stored = window.localStorage.getItem(currentKey)
  if (stored !== null) {
    return loadWatchlistByKey(currentKey)
  }

  const legacyKeys = [
    walletAddress ? `watchlist-cache:${chainType}:${walletAddress}` : null,
    walletAddress && chainType === ChainType.Solana ? `watchlist-cache:${environment}:${walletAddress}` : null,
    walletAddress ? `watchlist-cache:${chainType}-${environment}:${walletAddress}` : null,
    walletAddress ? `watchlist-cache:${environment}-${chainType}:${walletAddress}` : null,
  ].filter((key): key is string => Boolean(key))

  for (const legacyKey of legacyKeys) {
    const legacy = loadWatchlistByKey(legacyKey)
    if (legacy.length === 0) continue

    saveWatchlistByKey(currentKey, legacy)
    return legacy
  }

  saveWatchlistByKey(currentKey, [])
  return []
}

/**
 * Load watchlist for a specific chain and wallet
 */
export function useWatchlist(chainType: ChainType, environment: string, walletAddress?: string) {
  const cacheKey = getWatchlistCacheKey(chainType, environment, walletAddress)

  return useQuery({
    queryKey: [cacheKey],
    queryFn: () => loadWatchlistByKey(cacheKey),
    staleTime: 0,
  })
}

/**
 * Load watchlists across all active chains for a wallet
 */
export function useMultiChainWatchlist(walletAddress?: string) {
  const { activeChain, activeChainConnections, allChains } = useMultiChain()
  const query = useQuery<Partial<Record<ChainType, string[]>>>({
    queryKey: ['multichain-watchlist', walletAddress, activeChain, activeChainConnections],
    queryFn: () => {
      const result: Partial<Record<ChainType, string[]>> = {}

      // Include watchlists for all chain types we know about, plus any explicitly active connections.
      const knownTypes = Array.from(new Set([...activeChainConnections, ...allChains.map((c) => c.type)]))

      knownTypes.forEach((chainType) => {
        // Prefer the active chain if types match, otherwise match environment of the active chain, falling back to first available.
        const chain =
          activeChain?.type === chainType
            ? activeChain
            : allChains.find((c) => c.type === chainType && c.environment === activeChain?.environment) ||
              allChains.find((c) => c.type === chainType)
        if (chain) {
          result[chainType] = migrateLegacyWatchlist(chainType, chain.environment, walletAddress)
        }
      })

      return result
    },
    staleTime: 0,
  })

  useEffect(() => {
    const handleWatchlistUpdate = () => {
      query.refetch()
    }

    window.addEventListener(WATCHLIST_UPDATED_EVENT, handleWatchlistUpdate)
    window.addEventListener('storage', handleWatchlistUpdate)

    return () => {
      window.removeEventListener(WATCHLIST_UPDATED_EVENT, handleWatchlistUpdate)
      window.removeEventListener('storage', handleWatchlistUpdate)
    }
  }, [query])

  return query
}

export function useMultiChainWatchlistByChain(walletAddress?: string) {
  const { allChains } = useMultiChain()
  const query = useQuery<Record<string, string[]>>({
    queryKey: ['multichain-watchlist-by-chain', walletAddress, allChains.map((chain) => chain.name)],
    queryFn: () => {
      const result: Record<string, string[]> = {}

      allChains.forEach((chain) => {
        result[chain.name] = migrateLegacyWatchlist(chain.type, chain.environment, walletAddress)
      })

      return result
    },
    staleTime: 0,
  })

  useEffect(() => {
    const handleWatchlistUpdate = () => {
      query.refetch()
    }

    window.addEventListener(WATCHLIST_UPDATED_EVENT, handleWatchlistUpdate)
    window.addEventListener('storage', handleWatchlistUpdate)

    return () => {
      window.removeEventListener(WATCHLIST_UPDATED_EVENT, handleWatchlistUpdate)
      window.removeEventListener('storage', handleWatchlistUpdate)
    }
  }, [query])

  return query
}

/**
 * Add protocol to watchlist for a specific chain
 */
export function addToWatchlist(chainType: ChainType, environment: string, slug: string, walletAddress?: string) {
  try {
    const cacheKey = getWatchlistCacheKey(chainType, environment, walletAddress)
    const current = loadWatchlistByKey(cacheKey)
    const updated = sanitizeWatchlist([...current, slug])
    saveWatchlistByKey(cacheKey, updated)
    notifyWatchlistUpdated()
    return true
  } catch (error) {
    console.error('Failed to add to watchlist:', error)
    toast.error('Failed to add protocol to watchlist')
    return false
  }
}

/**
 * Remove protocol from watchlist for a specific chain
 */
export function removeFromWatchlist(chainType: ChainType, environment: string, slug: string, walletAddress?: string) {
  try {
    const cacheKey = getWatchlistCacheKey(chainType, environment, walletAddress)
    const current = loadWatchlistByKey(cacheKey)
    const updated = current.filter((s) => normalizeProtocolSlug(s) !== normalizeProtocolSlug(slug))
    saveWatchlistByKey(cacheKey, updated)
    notifyWatchlistUpdated()
    return true
  } catch (error) {
    console.error('Failed to remove from watchlist:', error)
    toast.error('Failed to remove protocol from watchlist')
    return false
  }
}

/**
 * Clear watchlist for a specific chain
 */
export function clearWatchlist(chainType: ChainType, environment: string, walletAddress?: string) {
  try {
    const cacheKey = getWatchlistCacheKey(chainType, environment, walletAddress)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(cacheKey)
      notifyWatchlistUpdated()
    }
    return true
  } catch (error) {
    console.error('Failed to clear watchlist:', error)
    return false
  }
}
