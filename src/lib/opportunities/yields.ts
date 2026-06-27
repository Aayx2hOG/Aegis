export type ProtocolYieldSummary = {
  protocolSlug: string
  apy: number
  apyBase: number | null
  apyReward: number | null
  poolTvlUsd: number
  pool: string
  symbol: string
  stablecoin: boolean
  hasImpermanentLossRisk: boolean
  exposure: string | null
  poolChain: string
  isCurrentChain: boolean
}

const YIELD_PROJECT_ALIASES: Readonly<Record<string, string[]>> = {
  'sanctum-validator-lsts': ['sanctum-infinity'],
}

export function findProtocolYieldSummary(
  protocol: { slug: string; name: string },
  summaries: ProtocolYieldSummary[],
  slugCandidates: string[] = [],
) {
  const normalizedName = protocol.name.trim().toLowerCase().replace(/\s+/g, '-')
  const primaryCandidates = new Set([protocol.slug, normalizedName, ...slugCandidates])
  const exact = summaries.find((summary) => primaryCandidates.has(summary.protocolSlug))
  if (exact) return exact
  const aliased = summaries.find((summary) =>
    (YIELD_PROJECT_ALIASES[protocol.slug] ?? []).includes(summary.protocolSlug),
  )
  if (aliased) return aliased

  return summaries
    .filter(
      (summary) =>
        protocol.slug.startsWith(`${summary.protocolSlug}-`) ||
        summary.protocolSlug.startsWith(`${protocol.slug}-`) ||
        normalizedName.startsWith(`${summary.protocolSlug}-`) ||
        summary.protocolSlug.startsWith(`${normalizedName}-`),
    )
    .sort((left, right) => right.poolTvlUsd - left.poolTvlUsd)[0]
}
