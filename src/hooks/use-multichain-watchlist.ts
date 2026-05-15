'use client';

import { useQuery } from '@tanstack/react-query';
import { ChainType } from '@/lib/chain/types';
import { useMultiChain } from '@/components/chain/chain-provider';
import { normalizeProtocolSlug } from '@/shared/protocol/slug-resolver';
import { toast } from 'sonner';

const MAX_WATCHLIST_ITEMS = 20;
const GUEST_WATCHLIST_CACHE_KEY = 'watchlist-cache:guest';

/**
 * Generate cache key for watchlist across chains
 * Format: watchlist-cache:{chainType}:{environment}:{walletAddress}
 */
function getWatchlistCacheKey(
    chainType: ChainType,
    environment: string,
    walletAddress?: string
): string {
    if (!walletAddress) return GUEST_WATCHLIST_CACHE_KEY;
    return `watchlist-cache:${chainType}:${environment}:${walletAddress}`;
}

/**
 * Get all watchlist cache keys for a wallet across all active chains
 */
function getActiveWatchlistCacheKeys(
    activeChains: ChainType[],
    walletAddress?: string
): Record<ChainType, string> {
    const keys: Record<string, string> = {};

    // TODO: Get environment per chain from context
    activeChains.forEach((chainType) => {
        keys[chainType] = getWatchlistCacheKey(chainType, 'mainnet', walletAddress);
    });

    return keys;
}

function sanitizeWatchlist(slugs: string[]): string[] {
    const normalized = slugs
        .map((slug) => normalizeProtocolSlug(slug))
        .filter(Boolean);
    return Array.from(new Set(normalized)).slice(0, MAX_WATCHLIST_ITEMS);
}

function loadWatchlistByKey(cacheKey: string): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(cacheKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return sanitizeWatchlist(
            parsed.filter((v): v is string => typeof v === 'string')
        );
    } catch {
        return [];
    }
}

function saveWatchlistByKey(cacheKey: string, slugs: string[]) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(cacheKey, JSON.stringify(sanitizeWatchlist(slugs)));
    } catch {
        console.error('Failed to save watchlist');
    }
}

/**
 * Load watchlist for a specific chain and wallet
 */
export function useWatchlist(
    chainType: ChainType,
    environment: string,
    walletAddress?: string
) {
    const cacheKey = getWatchlistCacheKey(chainType, environment, walletAddress);

    return useQuery({
        queryKey: [cacheKey],
        queryFn: () => loadWatchlistByKey(cacheKey),
        staleTime: Infinity,
        gcTime: Infinity,
    });
}

/**
 * Load watchlists across all active chains for a wallet
 */
export function useMultiChainWatchlist(walletAddress?: string) {
    const { activeChainConnections, allChains } = useMultiChain();

    return useQuery<Partial<Record<ChainType, string[]>>>({
        queryKey: ['multichain-watchlist', walletAddress, activeChainConnections],
        queryFn: () => {
            const result: Partial<Record<ChainType, string[]>> = {};

            activeChainConnections.forEach((chainType) => {
                const chain = allChains.find((c) => c.type === chainType);
                if (chain) {
                    const cacheKey = getWatchlistCacheKey(chainType, chain.environment, walletAddress);
                    result[chainType] = loadWatchlistByKey(cacheKey);
                }
            });

            return result;
        },
        staleTime: Infinity,
        gcTime: Infinity,
    });
}

/**
 * Add protocol to watchlist for a specific chain
 */
export function addToWatchlist(
    chainType: ChainType,
    environment: string,
    slug: string,
    walletAddress?: string
) {
    try {
        const cacheKey = getWatchlistCacheKey(chainType, environment, walletAddress);
        const current = loadWatchlistByKey(cacheKey);
        const updated = sanitizeWatchlist([...current, slug]);
        saveWatchlistByKey(cacheKey, updated);
        return true;
    } catch (error) {
        console.error('Failed to add to watchlist:', error);
        toast.error('Failed to add protocol to watchlist');
        return false;
    }
}

/**
 * Remove protocol from watchlist for a specific chain
 */
export function removeFromWatchlist(
    chainType: ChainType,
    environment: string,
    slug: string,
    walletAddress?: string
) {
    try {
        const cacheKey = getWatchlistCacheKey(chainType, environment, walletAddress);
        const current = loadWatchlistByKey(cacheKey);
        const updated = current.filter((s) => normalizeProtocolSlug(s) !== normalizeProtocolSlug(slug));
        saveWatchlistByKey(cacheKey, updated);
        return true;
    } catch (error) {
        console.error('Failed to remove from watchlist:', error);
        toast.error('Failed to remove protocol from watchlist');
        return false;
    }
}

/**
 * Clear watchlist for a specific chain
 */
export function clearWatchlist(
    chainType: ChainType,
    environment: string,
    walletAddress?: string
) {
    try {
        const cacheKey = getWatchlistCacheKey(chainType, environment, walletAddress);
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(cacheKey);
        }
        return true;
    } catch (error) {
        console.error('Failed to clear watchlist:', error);
        return false;
    }
}
