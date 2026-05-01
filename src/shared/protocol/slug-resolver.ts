import type { SolanaProtocol } from '@/shared/types/protocol'

export const PROTOCOL_SLUG_ALIASES: Record<string, string[]> = {
  raydium: ['raydium-amm'],
  orca: ['orca-dex'],
  marinade: ['marinade-liquid-staking', 'marinade-native', 'marinade-select'],
  jito: ['jito-liquid-staking', 'jito-restaking'],
  kamino: ['kamino-lend', 'kamino-liquidity'],
  drift: ['drift-trade', 'drift-staked-sol'],
  marginfi: ['marginfi-lending', 'marginfi-lst'],
}

export function normalizeProtocolSlug(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '-')
}

export function getProtocolSlugCandidates(input: string): string[] {
  const normalized = normalizeProtocolSlug(input)
  const aliases = PROTOCOL_SLUG_ALIASES[normalized] ?? []
  return [normalized, ...aliases]
}

function pickBestByTvl(candidates: SolanaProtocol[]): SolanaProtocol | undefined {
  if (candidates.length === 0) return undefined
  return [...candidates].sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))[0]
}

export function resolveProtocolFromList(input: string, protocols: SolanaProtocol[]): SolanaProtocol | undefined {
  const candidates = getProtocolSlugCandidates(input)

  const exactCandidate = protocols.find((p) => candidates.includes(p.slug.toLowerCase()))
  if (exactCandidate) return exactCandidate

  const normalized = normalizeProtocolSlug(input)
  return pickBestByTvl(
    protocols.filter((p) => {
      const slug = p.slug.toLowerCase()
      const name = p.name.toLowerCase().replace(/\s+/g, '-')
      return slug.includes(normalized) || name.includes(normalized)
    })
  )
}