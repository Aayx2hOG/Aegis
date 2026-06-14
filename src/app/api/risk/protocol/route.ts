import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ChainType } from '@/lib/chain/types'
import { buildProtocolRiskSnapshot } from '@/server/risk/protocol-risk'

const RiskRequestSchema = z.object({
  protocolSlug: z.string().min(1),
  chainType: z.nativeEnum(ChainType).optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = RiskRequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid parameters', details: parsed.error.format() }, { status: 400 })
  }

  try {
    const snapshot = await buildProtocolRiskSnapshot(parsed.data.protocolSlug, parsed.data.chainType)
    return Response.json({ snapshot })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
