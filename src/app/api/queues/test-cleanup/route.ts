import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'

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
    const artifactId = data.artifactId as string | undefined
    if (!artifactId) continue

    try {
      const art = await prisma.testArtifact.findUnique({ where: { id: artifactId } })
      if (!art) continue

      // delete associated event and rule if they still exist
      try {
        await prisma.alertEvent.deleteMany({ where: { id: art.eventId } })
        await prisma.alertRule.deleteMany({ where: { id: art.ruleId } })
      } catch (err) {
        console.error('[test-cleanup-webhook] failed to delete related records', err)
      }

      await prisma.testArtifact.delete({ where: { id: artifactId } })
    } catch (err) {
      console.error('[test-cleanup-webhook] failed to process artifact', artifactId, err)
    }
  }

  return new Response('ok')
}
