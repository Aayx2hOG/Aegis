import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { runComparisonAgent } from '@/server/ai/aegis-comparison-agent'
import { prisma } from '@/server/db/prisma'
import { normalizeProtocolSlug } from '@/lib/protocol/slug-resolver'
import { ChainType } from '@/lib/chain/types'
import { getOptionalWalletOwner } from '@/server/auth/wallet-auth'

function compactError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (raw.includes('GROQ_API_KEY')) {
    return 'Optional AI provider is not configured. Data-backed comparison is still available.'
  }
  if (raw.toLowerCase().includes('failed to call a function') || raw.toLowerCase().includes('failed_generation')) {
    return 'AI tool-calling failed for this query. A fallback brief was generated.'
  }
  return raw.length > 240 ? `${raw.slice(0, 240)}...` : raw
}

import { z } from 'zod'

const CompareRequestSchema = z.object({
  protocolA: z.string().min(1, 'Protocol A is required'),
  protocolB: z.string().min(1, 'Protocol B is required'),
  walletAddress: z.string().optional().nullable(),
  chainType: z.nativeEnum(ChainType),
})

// POST /api/research/compare
// Body: { protocolA: string, protocolB: string, chainType: ChainType, walletAddress?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = CompareRequestSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid parameters', details: parsed.error.format() }, { status: 400 })
    }

    const { protocolA, protocolB, walletAddress, chainType } = parsed.data
    const authenticatedWalletAddress = getOptionalWalletOwner(req, walletAddress)

    const normalizedA = normalizeProtocolSlug(protocolA)
    const normalizedB = normalizeProtocolSlug(protocolB)
    const combinedSlug = `compare:${normalizedA}:${normalizedB}`

    console.log(
      `[/api/research/compare] Running comparison agent for ${normalizedA} and ${normalizedB} on ${chainType}`,
    )
    const brief = await runComparisonAgent(normalizedA, normalizedB, chainType)

    if (prisma) {
      try {
        await prisma.researchRun.create({
          data: {
            walletAddress: authenticatedWalletAddress,
            protocolSlug: combinedSlug,
            briefMarkdown: brief.brief,
            toolCalls: brief.toolCalls as unknown as Prisma.InputJsonValue,
          },
        })
        console.log(`[/api/research/compare] Persisted run for ${combinedSlug}`)
      } catch (persistErr) {
        console.error('[/api/research/compare] failed to persist comparative run', persistErr)
      }
    }

    return Response.json(brief)
  } catch (err) {
    console.error('[/api/research/compare]', err)
    return Response.json({ error: compactError(err) }, { status: 500 })
  }
}
