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

function normalizeLoose(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function isLooseMatch(left: string, right: string) {
  if (left === right) return true
  const short = Math.min(left.length, right.length)
  const long = Math.max(left.length, right.length)
  if (short === 0) return false
  if (short / long < 0.65) return false
  return left.startsWith(right) || right.startsWith(left)
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

  const looseCandidates = Array.from(
    new Set([protocol.slug, normalizedName, ...slugCandidates].map((candidate) => normalizeLoose(candidate))),
  )

  return summaries
    .filter(
      (summary) => {
        const summarySlug = normalizeLoose(summary.protocolSlug)
        const summarySymbol = normalizeLoose(summary.symbol)
        return (
          looseCandidates.some((candidate) => isLooseMatch(candidate, summarySlug)) ||
          looseCandidates.some((candidate) => isLooseMatch(candidate, summarySymbol))
        )
      },
    )
    .sort((left, right) => right.poolTvlUsd - left.poolTvlUsd)[0]
}
