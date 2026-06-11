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

  const messages = body.messages ?? []
  for (const msg of messages) {
    const data = msg.body ?? {}
    const eventId = data.eventId as string | undefined
    if (!eventId) continue

    try {
      // Delegate delivery to shared helper which handles per-channel logging and concurrency
      await deliverNotificationsForEvent(eventId)
    } catch (err) {
      console.error('[notifications-webhook] processing message failed', err)
    }
  }

  return new Response('ok')
}
