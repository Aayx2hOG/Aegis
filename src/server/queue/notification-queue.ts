import Redis from 'ioredis'
import { prisma } from '@/server/db/prisma'
import deliverNotificationsForEvent from '@/server/notifications/delivery'

const redisUrl = process.env.REDIS_URL
const QUEUE_NAME = 'notifications'
const UPSTASH_URL = process.env.UPSTASH_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REST_TOKEN

if (!redisUrl && !UPSTASH_URL) {
    console.warn('[notification-queue] REDIS_URL and UPSTASH_REST_URL not set — using inline fallback for notification jobs')
}

export async function enqueueNotification(eventId: string) {
    // If Upstash configured, enqueue via REST API
    if (UPSTASH_URL && UPSTASH_TOKEN) {
        try {
            const url = `${UPSTASH_URL.replace(/\/$/, '')}/queues/notifications/messages`
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${UPSTASH_TOKEN}`,
                    'Content-Type': 'application/json',
                },
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
        const connection = new Redis(redisUrl, { maxRetriesPerRequest: null as any, lazyConnect: true })
        const { Queue } = await import('bullmq')
        const queue = new Queue(QUEUE_NAME, { connection })
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
