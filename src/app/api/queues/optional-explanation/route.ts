import { NextRequest } from 'next/server'
import { runResearchAgent } from '@/server/ai/aegis-research-agent'
import { prisma } from '@/server/db/prisma'
import { updateEventAndPublishSummary } from '@/server/db/redis'

const WEBHOOK_SECRET = process.env.UPSTASH_WEBHOOK_SECRET

function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
}

export async function POST(req: NextRequest) {
  if (WEBHOOK_SECRET) {
    const auth = req.headers.get('authorization')
    if (!auth || auth !== `Bearer ${WEBHOOK_SECRET}`) return unauthorized()
  }

  const body = await req.json().catch(() => null)
  if (!body) return new Response('no body', { status: 400 })

  const messages = body.messages ?? []

  if (!prisma) return new Response(JSON.stringify({ error: 'Database not configured.' }), { status: 503 })

  for (const msg of messages) {
    const data = msg.body ?? {}
    const eventId = data.eventId as string | undefined
    const protocolSlug = data.protocolSlug as string | undefined
    if (!eventId || !protocolSlug) continue

    try {
      // Idempotency: skip if summary already generated (unless forced)
      const existing = await prisma.alertEvent.findUnique({ where: { id: eventId } })
      if (!existing) continue
      if (existing.summaryGeneratedAt && !process.env.FORCE_REGENERATE) {
        console.log('[optional-explanation-webhook] explanation already exists for', eventId)
        continue
      }

      const brief = await runResearchAgent(protocolSlug)
      const summary = typeof brief.brief === 'string' ? brief.brief : null

      await updateEventAndPublishSummary(eventId, summary)
    } catch (err) {
      console.error('[optional-explanation-webhook] processing failed for message', msg, err)
    }
  }

  return new Response('ok')
}
