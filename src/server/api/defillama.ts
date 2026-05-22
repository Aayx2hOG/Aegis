import { ChainType } from '@/lib/chain/types'
import type { SolanaProtocol } from '@/shared/types/protocol'

const BASE = 'https://api.llama.fi'

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
  const res = await fetch(`${BASE}/protocols`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`DeFiLlama error: ${res.status}`)
  const all: SolanaProtocol[] = await res.json()
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