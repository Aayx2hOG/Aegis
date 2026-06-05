import Redis from 'ioredis'
import type { Queue } from 'bullmq'
import deliverNotificationsForEvent from '@/server/notifications/delivery'

const redisUrl = process.env.REDIS_URL
const QUEUE_NAME = 'notifications'
const UPSTASH_URL = process.env.UPSTASH_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REST_TOKEN

if (!redisUrl && !UPSTASH_URL) {
    console.warn('[notification-queue] REDIS_URL and UPSTASH_REST_URL not set — using inline fallback for notification jobs')
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

export async function enqueueNotification(eventId: string) {
    // If Upstash configured, enqueue via REST API
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

            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ messages: [{ body: { eventId } }] }),
            })

            if (!res.ok) {
                const text = await res.text().catch(() => '')
                throw new Error(`Upstash enqueue failed: ${res.status} ${text}`)
            }

            return res.json()
        } catch (err) {
            console.error('[notification-queue] Upstash enqueue failed, falling back', err)
            // fall through
        }
    }

    // Redis/BullMQ path
    if (redisUrl) {
        const queue = await getRedisQueue()
        return queue.add('deliver', { eventId }, { attempts: 5, backoff: { type: 'exponential', delay: 2000 } })
    }

    // Inline fallback delivery: use shared delivery helper (concurrent, resilient)
    try {
        await deliverNotificationsForEvent(eventId)
        return { id: `inline-notif-${eventId}` }
    } catch (err) {
        console.error('[notification-inline] failed', err)
        throw err
    }
}

export default enqueueNotification
