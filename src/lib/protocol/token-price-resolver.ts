import type { SolanaProtocol } from '@/lib/types'
import { getProtocolSlugCandidates, normalizeProtocolSlug } from './slug-resolver'

export const PROTOCOL_TOKEN_PRICE_OVERRIDES: Record<
  string,
  { geckoId: string; symbol?: string; name?: string; mint?: string }
> = {
  raydium: { geckoId: 'raydium', symbol: 'RAY', name: 'Raydium' },
  'raydium-amm': { geckoId: 'raydium', symbol: 'RAY', name: 'Raydium' },
  orca: { geckoId: 'orca', symbol: 'ORCA', name: 'Orca' },
  'orca-dex': { geckoId: 'orca', symbol: 'ORCA', name: 'Orca' },
  jito: { geckoId: 'jito-governance-token', symbol: 'JTO', name: 'Jito' },
  'jito-liquid-staking': { geckoId: 'jito-governance-token', symbol: 'JTO', name: 'Jito' },
  kamino: { geckoId: 'kamino', symbol: 'KMNO', name: 'Kamino' },
  'kamino-lend': { geckoId: 'kamino', symbol: 'KMNO', name: 'Kamino' },
  drift: { geckoId: 'drift-protocol', symbol: 'DRIFT', name: 'Drift' },
  'drift-trade': { geckoId: 'drift-protocol', symbol: 'DRIFT', name: 'Drift' },
  marginfi: { geckoId: 'marginfi', symbol: 'MRGN', name: 'Marginfi' },
  'marinade-liquid-staking': { geckoId: 'marinade', symbol: 'MNDE', name: 'Marinade' },
  'marinade-native': {
    geckoId: 'msol',
    symbol: 'mSOL',
    name: 'Marinade Staked SOL',
    mint: 'mSoLzZyvTTQAo2JuKyFnE3S2Hxs4dF6U8B9z8SPm1p8',
  },
}

export function resolveProtocolTokenOverride(slug: string) {
  const candidates = getProtocolSlugCandidates(slug)
  for (const candidate of candidates) {
    const override = PROTOCOL_TOKEN_PRICE_OVERRIDES[normalizeProtocolSlug(candidate)]
    if (override) return override
  }
  return null
}

export function resolveProtocolGeckoId(slug: string, protocol?: SolanaProtocol): string | null {
  const explicit =
    (protocol as (SolanaProtocol & { gecko_id?: string | null; geckoId?: string | null }) | undefined)?.gecko_id ??
    (protocol as (SolanaProtocol & { gecko_id?: string | null; geckoId?: string | null }) | undefined)?.geckoId

  if (explicit) return explicit

  const override = resolveProtocolTokenOverride(slug)
  if (override) return override.geckoId

  return normalizeProtocolSlug(slug)
}

const PROTOCOL_SUFFIXES = [
  'amm',
  'dex',
  'protocol',
  'finance',
  'fi',
  'labs',
  'dao',
  'v1',
  'v2',
  'v3',
  'trade',
  'lend',
  'lending',
  'liquidity',
  'liquid-staking',
  'native',
  'restaking',
]

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeProtocolSlug(value)).filter(Boolean)))
}

function stripKnownSuffixes(slug: string): string[] {
  const parts = normalizeProtocolSlug(slug).split('-').filter(Boolean)
  const candidates = [parts.join('-')]

  for (let end = parts.length; end > 1; end--) {
    const suffix = parts.slice(end - 1).join('-')
    if (!PROTOCOL_SUFFIXES.includes(suffix)) break
    candidates.push(parts.slice(0, end - 1).join('-'))
  }

  for (const suffix of PROTOCOL_SUFFIXES) {
    if (parts.at(-1) === suffix && parts.length > 1) {
      candidates.push(parts.slice(0, -1).join('-'))
    }
  }

  return candidates
}

export function getProtocolTokenIdCandidates(slug: string): string[] {
  const override = resolveProtocolTokenOverride(slug)
  const slugCandidates = getProtocolSlugCandidates(slug)
  const stripped = slugCandidates.flatMap(stripKnownSuffixes)
  return unique([override?.geckoId ?? '', ...slugCandidates, ...stripped])
}

export function getProtocolTokenSearchTerms(slug: string): string[] {
  return getProtocolTokenIdCandidates(slug).map((candidate) => candidate.replace(/-/g, ' '))
}

export type CoinGeckoSearchCoin = {
  id: string
  name: string
  symbol: string
  market_cap_rank?: number | null
}

function normalizedText(value: string): string {
  return normalizeProtocolSlug(value).replace(/-/g, '')
}

export function pickBestCoinGeckoSearchMatch(query: string, coins: CoinGeckoSearchCoin[]): CoinGeckoSearchCoin | null {
  const normalizedQuery = normalizeProtocolSlug(query)
  const compactQuery = normalizedText(query)

  let best: { coin: CoinGeckoSearchCoin; score: number } | null = null

  for (const coin of coins) {
    const id = normalizeProtocolSlug(coin.id)
    const name = normalizeProtocolSlug(coin.name)
    const symbol = normalizeProtocolSlug(coin.symbol)
    const compactName = normalizedText(coin.name)
    const rankBonus = coin.market_cap_rank ? Math.max(0, 20 - Math.min(20, coin.market_cap_rank / 50)) : 0

    let score = 0
    if (id === normalizedQuery) score = 100
    else if (symbol === normalizedQuery) score = 90
    else if (name === normalizedQuery || compactName === compactQuery) score = 80
    else if (id.startsWith(normalizedQuery) || normalizedQuery.startsWith(id)) score = 65
    else if (name.startsWith(normalizedQuery) || compactName.startsWith(compactQuery)) score = 55
    else if (id.includes(normalizedQuery) || name.includes(normalizedQuery)) score = 35

    if (score === 0) continue
    score += rankBonus

    if (!best || score > best.score) {
      best = { coin, score }
    }
  }

  return best?.coin ?? null
}
