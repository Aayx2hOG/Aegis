import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'

// Delete test artifacts older than TTL (ms)
const TTL_MS = Number(process.env.TEST_ARTIFACT_TTL_MS ?? String(1000 * 60 * 60 * 24)) // default 24h

export async function POST(req: NextRequest) {
    if (!prisma) return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 503 })

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

        return new Response(JSON.stringify({ deleted: old.length }))
    } catch (err) {
        console.error('[test-cleanup] failed', err)
        return new Response(JSON.stringify({ error: (err instanceof Error) ? err.message : String(err) }), { status: 500 })
    }
}
