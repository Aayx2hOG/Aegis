import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { enqueueSummary } from '@/server/queue/summary-queue'

export async function POST(req: NextRequest) {
    if (!prisma) return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 503 })

    const body = await req.json().catch(() => null)
    const walletAddress = body?.walletAddress?.trim()
    const protocolSlug = body?.protocolSlug?.trim()

    if (!walletAddress || !protocolSlug) {
        return new Response(JSON.stringify({ error: 'walletAddress and protocolSlug are required' }), { status: 400 })
    }

    try {
        // Create a temporary rule to attach the event to
        const rule = await prisma.alertRule.create({
            data: {
                walletAddress,
                protocolSlug,
                metric: 'CHANGE_1D',
                threshold: 0,
                direction: 'ABOVE',
                enabled: false,
            },
        })

        const event = await prisma.alertEvent.create({
            data: {
                ruleId: rule.id,
                walletAddress,
                protocolSlug,
                metric: 'CHANGE_1D',
                threshold: 0,
                direction: 'ABOVE',
                currentValue: 0,
            },
        })

        // Track artifact for cleanup
        await prisma.testArtifact.create({ data: { ruleId: rule.id, eventId: event.id, walletAddress, protocolSlug } })

        // Enqueue summary generation (Upstash or Redis or inline)
        await enqueueSummary(event.id, protocolSlug)

        // If Upstash is configured, enqueue a delayed cleanup message for this test artifact
        const UPSTASH_URL = process.env.UPSTASH_REST_URL
        const UPSTASH_TOKEN = process.env.UPSTASH_REST_TOKEN
        const TTL_MS = Number(process.env.TEST_ARTIFACT_TTL_MS ?? String(1000 * 60 * 60 * 24))
        if (UPSTASH_URL && UPSTASH_TOKEN) {
            try {
                const url = `${UPSTASH_URL.replace(/\/$/, '')}/queues/test-cleanup/messages`
                // Many Upstash queue endpoints accept a per-message delay; include it here (milliseconds)
                await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${UPSTASH_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ messages: [{ body: { artifactId: event.id }, delay: TTL_MS }] }),
                })
            } catch (err) {
                console.error('[test-e2e] failed to enqueue delayed cleanup message', err)
            }
        }

        return new Response(JSON.stringify({ ok: true, eventId: event.id }))
    } catch (err) {
        console.error('[test-e2e] failed', err)
        return new Response(JSON.stringify({ error: (err instanceof Error) ? err.message : String(err) }), { status: 500 })
    }
}
