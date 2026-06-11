import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'

export async function GET(_req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  if (!prisma) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })

  const { eventId } = await context.params
  const event = await prisma.alertEvent.findUnique({ where: { id: eventId } })
  if (!event) return Response.json({ error: 'Event not found' }, { status: 404 })
  return Response.json({ event })
}
