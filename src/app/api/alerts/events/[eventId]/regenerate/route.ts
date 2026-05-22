import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { enqueueSummary } from '@/server/queue/summary-queue'

export async function POST(_req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
    if (!prisma) {
        return Response.json({ error: 'DATABASE is not configured.' }, { status: 503 })
    }

    const { eventId } = await context.params

    const event = await prisma.alertEvent.findUnique({ where: { id: eventId } })
    if (!event) {
        return Response.json({ error: 'Event not found' }, { status: 404 })
    }

    try {
        const job = await enqueueSummary(eventId, event.protocolSlug)
        return Response.json({ jobId: job.id, status: 'queued' }, { status: 202 })
    } catch (err) {
        console.error('[regenerate] failed to enqueue summary job', err)
        return Response.json({ error: String(err) }, { status: 500 })
    }
}
