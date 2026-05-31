import Redis from 'ioredis'
import type { Queue } from 'bullmq'
import { runResearchAgent } from '@/server/ai/aegis-research-agent'
import { prisma } from '@/server/db/prisma'
import { enqueueNotification } from '@/server/queue/notification-queue'

const redisUrl = process.env.REDIS_URL
const QUEUE_NAME = 'ai-summary'
const UPSTASH_URL = process.env.UPSTASH_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REST_TOKEN

if (!redisUrl && !UPSTASH_URL) {
    console.warn('[summary-queue] REDIS_URL and UPSTASH_REST_URL not set — using inline fallback for summary jobs')
}

let redisQueuePromise: Promise<Queue> | null = null

async function getRedisQueue() {
    if (!redisUrl) throw new Error('REDIS_URL is not configured.')
    redisQueuePromise ??= (async () => {
        const connection = new Redis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true })
        const { Queue } = await import('bullmq')
        return new Queue(QUEUE_NAME, { connection })
    })()
    return redisQueuePromise
}

export async function enqueueSummary(eventId: string, protocolSlug: string) {
    // If Upstash is configured, prefer enqueueing via Upstash REST API (serverless-friendly)
    if (UPSTASH_URL && UPSTASH_TOKEN) {
        try {
            const url = `${UPSTASH_URL.replace(/\/$/, '')}/queues/ai-summary/messages`
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${UPSTASH_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages: [{ body: { eventId, protocolSlug } }] }),
            })

            if (!res.ok) {
                const text = await res.text().catch(() => '')
                throw new Error(`Upstash enqueue failed: ${res.status} ${text}`)
            }

            const json = await res.json()
            return json
        } catch (err) {
            console.error('[summary-queue] Upstash enqueue failed, falling back', err)
            // fall through to Redis or inline fallback
        }
    }

    // If Redis is configured, use BullMQ as before
    if (redisUrl) {
        const queue = await getRedisQueue()
        return queue.add('generate', { eventId, protocolSlug }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } })
    }

    // Inline fallback: execute immediately (no retries)
    try {
        if (!prisma) throw new Error('DATABASE_URL is not configured.')
        const brief = await runResearchAgent(protocolSlug)
        const summary = typeof brief.brief === 'string' ? brief.brief : null
        await prisma.$executeRaw`UPDATE "AlertEvent" SET "summary" = ${summary}, "summaryGeneratedAt" = ${new Date()} WHERE id = ${eventId}`
        // Trigger notifications inline when no queue is configured
        try {
            await enqueueNotification(eventId)
        } catch (err) {
            console.error('[summary-inline] failed to enqueue notification', err)
        }

        return { id: `inline-${eventId}` }
    } catch (err) {
        console.error('[summary-inline] failed to generate summary', err)
        throw err
    }
}
