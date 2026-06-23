import { prisma } from '@/server/db/prisma'

// Delete test artifacts older than TTL (ms)
const TTL_MS = Number(process.env.TEST_ARTIFACT_TTL_MS ?? String(1000 * 60 * 60 * 24)) // default 24h
const CLEANUP_SECRET = process.env.TEST_CLEANUP_SECRET || process.env.UPSTASH_WEBHOOK_SECRET

function isCleanupApiEnabled() {
  return process.env.AEGIS_ENABLE_E2E_TEST_API === 'true' || process.env.NODE_ENV !== 'production'
}

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

function disabled() {
  return Response.json({ error: 'Test cleanup API is disabled in this environment.' }, { status: 404 })
}

function hasValidCleanupSecret(req: Request) {
  if (!CLEANUP_SECRET) return process.env.NODE_ENV !== 'production'
  return req.headers.get('authorization') === `Bearer ${CLEANUP_SECRET}`
}

export async function POST(req: Request) {
  if (!isCleanupApiEnabled()) return disabled()
  if (!hasValidCleanupSecret(req)) return unauthorized()
  if (!prisma) return Response.json({ error: 'Database not configured' }, { status: 503 })

  try {
    const cutoff = new Date(Date.now() - TTL_MS)
    const old = await prisma.testArtifact.findMany({ where: { createdAt: { lt: cutoff } } })

    for (const art of old) {
      try {
        await prisma.alertEvent.deleteMany({ where: { id: art.eventId } })
        await prisma.alertRule.deleteMany({ where: { id: art.ruleId } })
      } catch (err) {
        console.error('[test-cleanup] failed to delete related records', err)
      }
    }

    await prisma.testArtifact.deleteMany({ where: { createdAt: { lt: cutoff } } })

    return Response.json({ deleted: old.length })
  } catch (err) {
    console.error('[test-cleanup] failed', err)
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
