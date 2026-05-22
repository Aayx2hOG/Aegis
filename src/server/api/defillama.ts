import { ChainType } from '@/lib/chain/types'
import type { SolanaProtocol } from '@/shared/types/protocol'
import Redis from 'ioredis'

const BASE = 'https://api.llama.fi'
const REDIS_COMMAND_TIMEOUT_MS = 600
const redisOptions = {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  connectTimeout: 1000,
  enableOfflineQueue: false,
}
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, redisOptions) : null
const PROTOCOLS_CACHE_KEY = 'defillama:protocols'
const PROTOCOLS_TTL = 60 // seconds

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timeout)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timeout)
        reject(err)
      })
  })
}

async function tryGetCachedProtocols(): Promise<string | null> {
  if (!redis) return null
  try {
    return await withTimeout(redis.get(PROTOCOLS_CACHE_KEY), REDIS_COMMAND_TIMEOUT_MS)
  } catch {
    return null
  }
}

async function trySetCachedProtocols(protocols: SolanaProtocol[]): Promise<void> {
  if (!redis) return
  try {
    await withTimeout(
      redis.set(PROTOCOLS_CACHE_KEY, JSON.stringify(protocols), 'EX', PROTOCOLS_TTL),
      REDIS_COMMAND_TIMEOUT_MS
    )
  } catch {
    // Cache write failures should never block API responses.
  }
}

async function tryDeleteCorruptCache(): Promise<void> {
  if (!redis) return
  try {
    await withTimeout(redis.del(PROTOCOLS_CACHE_KEY), REDIS_COMMAND_TIMEOUT_MS)
  } catch {
    // Best-effort cleanup only.
  }
}

const DEFILLAMA_CHAIN_LABELS: Record<ChainType, string[]> = {
  [ChainType.Solana]: ['Solana'],
  [ChainType.Ethereum]: ['Ethereum', 'Ethereum Mainnet'],
  [ChainType.Polygon]: ['Polygon', 'Polygon POS', 'Polygon Mainnet'],
  [ChainType.Arbitrum]: ['Arbitrum', 'Arbitrum One'],
  [ChainType.Optimism]: ['Optimism'],
  [ChainType.Cosmos]: ['Cosmos'],
  [ChainType.Base]: ['Base'],
}

function matchesChain(protocolChains: string[] | undefined, chainType: ChainType): boolean {
  if (!protocolChains || protocolChains.length === 0) return false

  const labels = DEFILLAMA_CHAIN_LABELS[chainType] ?? [chainType]
  return protocolChains.some((chain) => {
    const normalizedChain = chain.trim().toLowerCase()
    return labels.some((label) => {
      const normalizedLabel = label.trim().toLowerCase()
      return normalizedChain.includes(normalizedLabel) || normalizedLabel.includes(normalizedChain)
    })
  })
}

export async function getProtocolsByChain(chainType: ChainType): Promise<SolanaProtocol[]> {
  // Try cache first
  const cached = await tryGetCachedProtocols()
  let all: SolanaProtocol[]
  if (cached) {
    try {
      all = JSON.parse(cached) as SolanaProtocol[]
    } catch {
      await tryDeleteCorruptCache()
      all = []
    }
  } else {
    // external fetch with timeout so the server doesn't hang
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(`${BASE}/protocols`, { signal: controller.signal })
      if (!res.ok) throw new Error(`DeFiLlama error: ${res.status}`)
      all = await res.json()
    } finally {
      clearTimeout(timeout)
    }
    // Cache the result for PROTOCOLS_TTL seconds
    await trySetCachedProtocols(all)
  }
  return all.filter((protocol) => matchesChain(protocol.chains, chainType))
}

export async function getSolanaProtocols(): Promise<SolanaProtocol[]> {
  return getProtocolsByChain(ChainType.Solana)
}

export async function getProtocolTvl(slug: string) {
  const res = await fetch(`${BASE}/protocol/${slug}`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`DeFiLlama error: ${res.status}`)
  return res.json()
}