import Groq from 'groq-sdk'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'groq-sdk/resources/chat/completions'
import { ChainType } from '@/lib/chain/types'
import { TOOLS, executeTool } from './aegis-tools'
import { COMPARISON_SYSTEM_PROMPT as COMP_PROMPT } from './aegis-prompts'
import type { ResearchBrief } from '@/lib/types'
import { formatTokenUsd, formatUsd } from '@/lib/format/number'
import { isResearchAiEnabled } from './config'

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set. Configure it in your deployment environment.')
  }
  return new Groq({ apiKey })
}

const MODEL = 'llama-3.3-70b-versatile'
const MAX_ITERATIONS = 6

function safeJsonParse(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return {}
  }
}

function buildChainLabel(chainType?: ChainType): string {
  switch (chainType) {
    case ChainType.Ethereum:
      return 'Ethereum'
    case ChainType.Polygon:
      return 'Polygon'
    case ChainType.Arbitrum:
      return 'Arbitrum'
    case ChainType.Optimism:
      return 'Optimism'
    case ChainType.Base:
      return 'Base'
    case ChainType.Cosmos:
      return 'Cosmos'
    case ChainType.Solana:
    default:
      return 'Solana'
  }
}

function usd(value: unknown): string {
  return formatUsd(value)
}

function formatPct(value: unknown, fallbackText = 'Unavailable'): string {
  const num = Number(value)
  if (Number.isFinite(num)) return `${num.toFixed(2)}%`
  if (typeof value === 'string' && value.trim()) return value.trim()
  return fallbackText
}

function text(value: unknown): string {
  if (value == null) return 'Unavailable'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'Unavailable'
  if (typeof value === 'string') return value.trim() ? value : 'Unavailable'
  return 'Unavailable'
}

interface ComparisonResultMeta {
  name?: string
  description?: string
}

interface ComparisonResultTvl {
  tvl?: number
  change1d?: number
  change7d?: number
  category?: string
  mcap?: number
}

interface ComparisonResultSnapshot {
  name?: string
  description?: string
  category?: string
  tokenPrice?: {
    price?: number
    marketCap?: number
  }
  marketFallback?: {
    price?: number
    marketCap?: number
  }
}

type ComparisonResults = {
  snapA: ComparisonResultSnapshot | null
  tvlA: ComparisonResultTvl | null
  metaA: ComparisonResultMeta | null
  snapB: ComparisonResultSnapshot | null
  tvlB: ComparisonResultTvl | null
  metaB: ComparisonResultMeta | null
}

function buildFallbackComparisonBrief(
  protocolA: string,
  protocolB: string,
  results: ComparisonResults,
  toolCalls: ResearchBrief['toolCalls'],
  chainType?: ChainType,
): ResearchBrief {
  const metaA = results.metaA ?? {}
  const tvlA = results.tvlA ?? {}
  const snapA = results.snapA ?? {}
  const metaB = results.metaB ?? {}
  const tvlB = results.tvlB ?? {}
  const snapB = results.snapB ?? {}

  const nameA = text(snapA.name ?? metaA.name) || protocolA
  const nameB = text(snapB.name ?? metaB.name) || protocolB

  const resolvedPriceA = snapA.tokenPrice?.price ?? snapA.marketFallback?.price
  const resolvedPriceB = snapB.tokenPrice?.price ?? snapB.marketFallback?.price

  const resolvedMcapA = snapA.tokenPrice?.marketCap ?? snapA.marketFallback?.marketCap
  const resolvedMcapB = snapB.tokenPrice?.marketCap ?? snapB.marketFallback?.marketCap

  const brief = [
    '### Head-to-Head Overview',
    `This is a comparative analysis of **${nameA}** and **${nameB}** on ${buildChainLabel(chainType)}.`,
    `- **${nameA}**: ${snapA.description ?? metaA.description ?? 'No description available.'}`,
    `- **${nameB}**: ${snapB.description ?? metaB.description ?? 'No description available.'}`,
    '',
    '### Core Metric Comparison Table',
    '| Metric | ' + nameA + ' | ' + nameB + ' |',
    '| --- | --- | --- |',
    `| TVL | ${usd(tvlA.tvl)} | ${usd(tvlB.tvl)} |`,
    `| 24h TVL Change | ${formatPct(tvlA.change1d)} | ${formatPct(tvlB.change1d)} |`,
    `| 7d TVL Change | ${formatPct(tvlA.change7d)} | ${formatPct(tvlB.change7d)} |`,
    `| Token Price | ${formatTokenUsd(resolvedPriceA)} | ${formatTokenUsd(resolvedPriceB)} |`,
    `| Market Cap | ${usd(resolvedMcapA)} | ${usd(resolvedMcapB)} |`,
    '',
    '### Yields & Economic Design',
    `- **${nameA}** is categorized as a ${tvlA.category ?? 'DeFi'} protocol. Its tokenomics and yield mechanisms are closely integrated into its market-making or supply models.`,
    `- **${nameB}** operates as a ${tvlB.category ?? 'DeFi'} protocol, offering alternative incentive schemas and distinct fee allocations.`,
    '',
    '### Security & System Risks',
    `- **${nameA}** has a TVL footprint of ${usd(tvlA.tvl)}. Its key risk profiles relate to protocol concentration and smart contract vulnerabilities.`,
    `- **${nameB}** exhibits a TVL footprint of ${usd(tvlB.tvl)}. Operational risks include liquidation probability thresholds and contract design.`,
    '',
    '### Summary Verdict (Battle Card Winner)',
    `Both protocols exhibit distinct strategic advantages. **${nameA}** is optimal for users seeking specific chain integrations in ${tvlA.category ?? 'DeFi'}, whereas **${nameB}** provides unique mechanics tailored for ${tvlB.category ?? 'DeFi'}. Review real-time parameters before allocating assets.`,
  ].join('\n')

  return {
    protocol: `compare:${protocolA}:${protocolB}`,
    brief,
    toolCalls,
  }
}

export async function runComparisonAgent(
  protocolA: string,
  protocolB: string,
  chainType?: ChainType,
): Promise<ResearchBrief> {
  const toolCalls: ResearchBrief['toolCalls'] = []
  const chainLabel = buildChainLabel(chainType)

  console.log(`[runComparisonAgent] Initiating parallel tool fetch for ${protocolA} and ${protocolB}`)

  const startFetch = Date.now()
  const [snapARes, tvlARes, metaARes, snapBRes, tvlBRes, metaBRes] = await Promise.allSettled([
    executeTool('get_protocol_snapshot', { slug: protocolA }),
    executeTool('get_protocol_tvl', { slug: protocolA }),
    executeTool('get_protocol_metadata', { slug: protocolA }),
    executeTool('get_protocol_snapshot', { slug: protocolB }),
    executeTool('get_protocol_tvl', { slug: protocolB }),
    executeTool('get_protocol_metadata', { slug: protocolB }),
  ])
  const fetchDuration = Date.now() - startFetch

  const results: ComparisonResults = {
    snapA: snapARes.status === 'fulfilled' ? (snapARes.value as ComparisonResultSnapshot) : null,
    tvlA: tvlARes.status === 'fulfilled' ? (tvlARes.value as ComparisonResultTvl) : null,
    metaA: metaARes.status === 'fulfilled' ? (metaARes.value as ComparisonResultMeta) : null,
    snapB: snapBRes.status === 'fulfilled' ? (snapBRes.value as ComparisonResultSnapshot) : null,
    tvlB: tvlBRes.status === 'fulfilled' ? (tvlBRes.value as ComparisonResultTvl) : null,
    metaB: metaBRes.status === 'fulfilled' ? (metaBRes.value as ComparisonResultMeta) : null,
  }

  interface PreseededToolCall {
    id: string
    slug: string
    res: PromiseSettledResult<unknown>
    name: string
  }

  const preseededToolCalls: PreseededToolCall[] = [
    { id: 'get_protocol_snapshot', slug: protocolA, res: snapARes, name: 'get_protocol_snapshot' },
    { id: 'get_protocol_tvl', slug: protocolA, res: tvlARes, name: 'get_protocol_tvl' },
    { id: 'get_protocol_metadata', slug: protocolA, res: metaARes, name: 'get_protocol_metadata' },
    { id: 'get_protocol_snapshot', slug: protocolB, res: snapBRes, name: 'get_protocol_snapshot' },
    { id: 'get_protocol_tvl', slug: protocolB, res: tvlBRes, name: 'get_protocol_tvl' },
    { id: 'get_protocol_metadata', slug: protocolB, res: metaBRes, name: 'get_protocol_metadata' },
  ]

  interface GroqToolCallObj {
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }

  const groqToolCalls: GroqToolCallObj[] = []
  const groqToolResponses: ChatCompletionMessageParam[] = []

  const isFulfilled = <T>(p: PromiseSettledResult<T>): p is PromiseFulfilledResult<T> => p.status === 'fulfilled'
  const isRejected = (p: PromiseSettledResult<unknown>): p is PromiseRejectedResult => p.status === 'rejected'

  preseededToolCalls.forEach((tc, index) => {
    const callId = `call_${tc.name}_${index}`
    const output = isFulfilled(tc.res)
      ? tc.res.value
      : { error: isRejected(tc.res) ? String(tc.res.reason) : 'Unknown error' }
    const error = isRejected(tc.res) ? String(tc.res.reason) : undefined

    toolCalls.push({
      tool: tc.name,
      input: { slug: tc.slug },
      output,
      durationMs: Math.round(fetchDuration / 6),
      error,
    })

    groqToolCalls.push({
      id: callId,
      type: 'function',
      function: {
        name: tc.name,
        arguments: JSON.stringify({ slug: tc.slug }),
      },
    })

    groqToolResponses.push({
      role: 'tool',
      tool_call_id: callId,
      content: JSON.stringify(output),
    })
  })

  if (!isResearchAiEnabled()) {
    return buildFallbackComparisonBrief(protocolA, protocolB, results, toolCalls, chainType)
  }

  try {
    const groq = getGroqClient()

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: COMP_PROMPT },
      {
        role: 'user',
        content: `Generate a comparative research brief comparing the ${chainLabel} DeFi protocols: "${protocolA}" and "${protocolB}". Use your tools to gather live data first.`,
      },
      // Seed pre-fetched tool outputs so LLM doesn't call them again
      {
        role: 'assistant',
        content: null,
        tool_calls: groqToolCalls,
      } as unknown as ChatCompletionMessageParam,
      ...groqToolResponses,
    ]

    let iterations = 0
    while (iterations < MAX_ITERATIONS) {
      iterations++

      const response = await groq.chat.completions.create({
        model: MODEL,
        messages,
        tools: TOOLS as ChatCompletionTool[],
        tool_choice: 'auto',
      })

      const choice = response.choices[0]
      const msg = choice.message

      messages.push(msg as ChatCompletionMessageParam)

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return {
          protocol: `compare:${protocolA}:${protocolB}`,
          brief: msg.content ?? '',
          toolCalls,
        }
      }

      for (const call of msg.tool_calls) {
        const name = call.function.name
        const input = safeJsonParse(call.function.arguments)

        const start = Date.now()
        let output: unknown
        let error: string | undefined

        try {
          output = await executeTool(name, input)
        } catch (err) {
          error = String(err)
          output = { error }
        }

        toolCalls.push({
          tool: name,
          input,
          output,
          durationMs: Date.now() - start,
          error,
        })

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(output),
        })
      }
    }
  } catch (err) {
    console.error('[runComparisonAgent] comparative ReAct loop failed, falling back', err)
    return buildFallbackComparisonBrief(protocolA, protocolB, results, toolCalls, chainType)
  }

  return buildFallbackComparisonBrief(protocolA, protocolB, results, toolCalls, chainType)
}
