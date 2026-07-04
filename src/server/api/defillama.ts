import { ChainType } from '@/lib/chain/types'
import type { SolanaProtocol } from '@/lib/types'
import Redis from 'ioredis'

const BASE = 'https://api.llama.fi'
const REDIS_COMMAND_TIMEOUT_MS = process.env.NODE_ENV === 'development' ? 1000 : 600
const redisOptions = {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  connectTimeout: process.env.NODE_ENV === 'development' ? 5000 : 1000,
  enableOfflineQueue: false,
}
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, redisOptions) : null
const PROTOCOLS_CACHE_KEY_PREFIX = 'defillama:protocols:'
const PROTOCOLS_TTL = 900 // 15 minutes (900 seconds)

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

async function tryGetCachedProtocols(chainType: ChainType): Promise<string | null> {
  if (!redis) return null
  try {
    return await withTimeout(redis.get(`${PROTOCOLS_CACHE_KEY_PREFIX}${chainType}`), REDIS_COMMAND_TIMEOUT_MS)
  } catch {
    return null
  }
}

async function readCachedProtocols(chainType: ChainType): Promise<SolanaProtocol[] | null> {
  const cached = await tryGetCachedProtocols(chainType)
  if (!cached) return null

  try {
    const parsed = JSON.parse(cached) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) {
      await tryDeleteCorruptCache(chainType)
      return null
    }
    return parsed as SolanaProtocol[]
  } catch {
    await tryDeleteCorruptCache(chainType)
    return null
  }
}

async function trySetCachedProtocols(chainType: ChainType, protocols: SolanaProtocol[]): Promise<void> {
  if (!redis) return
  try {
    await withTimeout(
      redis.set(`${PROTOCOLS_CACHE_KEY_PREFIX}${chainType}`, JSON.stringify(protocols), 'EX', PROTOCOLS_TTL),
      REDIS_COMMAND_TIMEOUT_MS,
    )
  } catch {
    // Cache write failures should never block API responses.
  }
}

async function tryDeleteCorruptCache(chainType: ChainType): Promise<void> {
  if (!redis) return
  try {
    await withTimeout(redis.del(`${PROTOCOLS_CACHE_KEY_PREFIX}${chainType}`), REDIS_COMMAND_TIMEOUT_MS)
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

function getChainTvl(protocol: SolanaProtocol, chainType: ChainType): number {
  const chainTvls = protocol.chainTvls
  if (!chainTvls) return protocol.tvl ?? 0
  const labels = DEFILLAMA_CHAIN_LABELS[chainType] ?? [chainType]
  for (const label of labels) {
    const exact = Object.entries(chainTvls).find(([chain]) => chain.trim().toLowerCase() === label.trim().toLowerCase())
    if (exact && Number.isFinite(exact[1])) return exact[1]
  }
  return 0
}

export async function getProtocolsByChain(chainType: ChainType): Promise<SolanaProtocol[]> {
  let protocols = await readCachedProtocols(chainType)
  if (!protocols) {
    // external fetch with timeout so the server doesn't hang
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(`${BASE}/protocols`, { signal: controller.signal })
      if (!res.ok) throw new Error(`DeFiLlama error: ${res.status}`)
      const all = (await res.json()) as SolanaProtocol[]
      if (!Array.isArray(all)) throw new Error('DeFiLlama returned an invalid protocol catalog')
      protocols = all.filter((protocol) => matchesChain(protocol.chains, chainType))
    } finally {
      clearTimeout(timeout)
    }
    // Never cache an empty response. A transient upstream issue should recover on
    // the next request instead of looking like a valid, synchronized catalog.
    if (protocols.length > 0) {
      await trySetCachedProtocols(chainType, protocols)
    }
  }
  return protocols
    .map((protocol) => ({ ...protocol, tvl: getChainTvl(protocol, chainType) }))
    .filter((protocol) => (protocol.tvl ?? 0) > 0)
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
