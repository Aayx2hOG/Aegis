import { ChainType } from '@/lib/chain/types'
import { normalizeProtocolSlug } from '@/lib/protocol/slug-resolver'
import type { ProtocolYieldSummary } from '@/lib/opportunities/yields'

const YIELDS_URL = 'https://yields.llama.fi/pools'

const CHAIN_LABELS: Record<ChainType, string[]> = {
  [ChainType.Solana]: ['solana'],
  [ChainType.Ethereum]: ['ethereum'],
  [ChainType.Polygon]: ['polygon'],
  [ChainType.Arbitrum]: ['arbitrum'],
  [ChainType.Optimism]: ['optimism'],
  [ChainType.Cosmos]: ['cosmos'],
  [ChainType.Base]: ['base'],
}

type YieldPool = {
  pool?: string
  chain?: string
  project?: string
  symbol?: string
  tvlUsd?: number
  apy?: number
  apyBase?: number
  apyReward?: number
  stablecoin?: boolean
  ilRisk?: string
  exposure?: string
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const chainParam = searchParams.get('chain') as ChainType | null
  const chainType = chainParam && Object.values(ChainType).includes(chainParam) ? chainParam : ChainType.Solana
  const acceptedChains = CHAIN_LABELS[chainType]

  try {
    const response = await fetch(YIELDS_URL, { cache: 'no-store' })
    if (!response.ok) throw new Error(`DeFiLlama yields error: ${response.status}`)
    const body = (await response.json()) as { data?: YieldPool[] }
    const chainSummaries = new Map<string, ProtocolYieldSummary>()
    const globalSummaries = new Map<string, ProtocolYieldSummary>()

    for (const pool of body.data ?? []) {
      const project = normalizeProtocolSlug(pool.project ?? '')
      const chain = pool.chain?.trim().toLowerCase()
      const apy = finiteNumber(pool.apy)
      const poolTvlUsd = finiteNumber(pool.tvlUsd)
      if (!project || !chain || apy == null || poolTvlUsd == null) continue
      if (apy <= 0 || apy > 10_000 || poolTvlUsd <= 0) continue

      const summary: ProtocolYieldSummary = {
        protocolSlug: project,
        apy,
        apyBase: finiteNumber(pool.apyBase),
        apyReward: finiteNumber(pool.apyReward),
        poolTvlUsd,
        pool: pool.pool ?? '',
        symbol: pool.symbol ?? 'Unknown pool',
        stablecoin: pool.stablecoin === true,
        hasImpermanentLossRisk: pool.ilRisk === 'yes',
        exposure: pool.exposure ?? null,
        poolChain: pool.chain ?? chain,
        isCurrentChain: acceptedChains.includes(chain),
      }

      const globalCurrent = globalSummaries.get(project)
      if (!globalCurrent || globalCurrent.poolTvlUsd < poolTvlUsd) {
        globalSummaries.set(project, summary)
      }
      if (acceptedChains.includes(chain)) {
        const chainCurrent = chainSummaries.get(project)
        if (!chainCurrent || chainCurrent.poolTvlUsd < poolTvlUsd) {
          chainSummaries.set(project, summary)
        }
      }
    }

    const summaries = new Map(globalSummaries)
    for (const [project, summary] of chainSummaries) summaries.set(project, summary)

    return Response.json({
      data: Array.from(summaries.values()),
      source: 'DeFiLlama Yields',
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[api/defillama/yields]', error)
    return Response.json(
      { data: [], source: 'DeFiLlama Yields', fetchedAt: new Date().toISOString(), unavailable: true },
      { status: 200 },
    )
  }
}
