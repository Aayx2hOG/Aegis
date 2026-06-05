import { NextRequest } from 'next/server'
import { runResearchAgent } from '@/server/ai/aegis-research-agent'
import { prisma } from '@/server/db/prisma'
import deliverNotificationsForEvent from '@/server/notifications/delivery'
import { updateEventAndPublishSummary } from '@/server/db/redis'

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

    const messages = body.messages ?? []

    if (!prisma) return new Response(JSON.stringify({ error: 'Database not configured.' }), { status: 503 })

    for (const msg of messages) {
        const data = msg.body ?? {}
        const eventId = data.eventId as string | undefined
        const protocolSlug = data.protocolSlug as string | undefined
        if (!eventId || !protocolSlug) continue

        try {
            // Idempotency: skip if summary already generated (unless forced)
            const existing = await prisma.alertEvent.findUnique({ where: { id: eventId } })
            if (!existing) continue
            if (existing.summaryGeneratedAt && !process.env.FORCE_REGENERATE) {
                console.log('[ai-summary-webhook] summary already exists for', eventId)
                continue
            }

            const brief = await runResearchAgent(protocolSlug)
            const summary = typeof brief.brief === 'string' ? brief.brief : null

            await updateEventAndPublishSummary(eventId, summary)

            // If Upstash is configured, enqueue a notification message so a serverless notification handler can deliver it.
            const UPSTASH_URL = process.env.UPSTASH_REST_URL
            const UPSTASH_TOKEN = process.env.UPSTASH_REST_TOKEN
            if (UPSTASH_URL && UPSTASH_TOKEN) {
                try {
                    const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
                    const destinationUrl = `${appUrl}/api/queues/notifications`
                    const webhookSecret = process.env.UPSTASH_WEBHOOK_SECRET

                    const baseUrl = UPSTASH_URL.replace(/\/$/, '')
                    const baseWithoutV2 = baseUrl.endsWith('/v2') ? baseUrl.slice(0, -3) : baseUrl
                    const url = `${baseWithoutV2}/v2/publish/${destinationUrl}`

                    const headers: Record<string, string> = {
                        'Authorization': `Bearer ${UPSTASH_TOKEN}`,
                        'Content-Type': 'application/json',
                        'Upstash-Queue': 'notifications',
                    }

                    if (webhookSecret) {
                        headers['Upstash-Forward-Authorization'] = `Bearer ${webhookSecret}`
                    }

                    await fetch(url, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ messages: [{ body: { eventId } }] }),
                    })
                } catch (err) {
                    console.error('[ai-summary-webhook] failed to enqueue notification message', err)
                }
            } else {
                // Fallback: deliver notifications immediately in-process (use shared helper)
                try {
                    await deliverNotificationsForEvent(eventId)
                } catch (err) {
                    console.error('[ai-summary-webhook] fallback notification delivery failed', err)
                }
            }
        } catch (err) {
            console.error('[ai-summary-webhook] processing failed for message', msg, err)
        }
    }

    return new Response('ok')
}
