import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { requireWalletOwner } from '@/server/auth/wallet-auth'

export async function GET(req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  if (!prisma) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })

  const { eventId } = await context.params
  const event = await prisma.alertEvent.findUnique({ where: { id: eventId } })
  if (!event) return Response.json({ error: 'Event not found' }, { status: 404 })
  const auth = requireWalletOwner(req, event.walletAddress)
  if (!auth.ok) return auth.response
  return Response.json({ event })
}
