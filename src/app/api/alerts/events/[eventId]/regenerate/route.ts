import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { enqueueOptionalExplanation } from '@/server/queue/optional-explanation-queue'
import { requireWalletOwner } from '@/server/auth/wallet-auth'

export async function POST(req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  if (!prisma) {
    return Response.json({ error: 'DATABASE is not configured.' }, { status: 503 })
  }

  const { eventId } = await context.params

  const event = await prisma.alertEvent.findUnique({ where: { id: eventId } })
  if (!event) {
    return Response.json({ error: 'Event not found' }, { status: 404 })
  }
  const auth = requireWalletOwner(req, event.walletAddress)
  if (!auth.ok) return auth.response

  try {
    const job = await enqueueOptionalExplanation(eventId, event.protocolSlug)
    return Response.json({ jobId: job.id, status: 'queued' }, { status: 202 })
  } catch (err) {
    console.error('[regenerate] failed to enqueue optional explanation job', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
