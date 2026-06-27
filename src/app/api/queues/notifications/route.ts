import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import deliverNotificationsForEvent from '@/server/notifications/delivery'

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

  if (!prisma) return new Response(JSON.stringify({ error: 'Database not configured.' }), { status: 503 })

  const messages = Array.isArray(body.messages) ? body.messages : body.eventId ? [{ body }] : []
  if (messages.length === 0) {
    return Response.json({ error: 'At least one notification event is required.' }, { status: 400 })
  }

  let failed = 0
  for (const msg of messages) {
    const data = msg.body ?? {}
    const eventId = data.eventId as string | undefined
    if (!eventId) {
      failed += 1
      continue
    }

    try {
      const result = await deliverNotificationsForEvent(eventId)
      failed += result.failed
    } catch (err) {
      console.error('[notifications-webhook] processing message failed', err)
      failed += 1
    }
  }

  if (failed > 0) {
    return Response.json(
      { error: `${failed} notification delivery attempt${failed === 1 ? '' : 's'} failed.` },
      { status: 503 },
    )
  }

  return Response.json({ ok: true })
}
