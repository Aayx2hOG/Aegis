import Redis from 'ioredis'
import { Worker } from 'bullmq'
import { prisma } from '@/server/db/prisma'
import deliverNotificationsForEvent from '@/server/notifications/delivery'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) {
    console.error('[notification-worker] REDIS_URL not set; this worker requires Redis')
    process.exit(1)
}

const connection = new Redis(redisUrl, { maxRetriesPerRequest: null })

if (!prisma) {
    console.error('[notification-worker] DATABASE_URL is not configured; worker cannot run')
    process.exit(1)
}

const worker = new Worker(
    'notifications',
    async (job) => {
        const { eventId } = job.data as { eventId: string }
        console.log('[notification-worker] processing', eventId)

        const concurrency = Number(process.env.NOTIFICATION_DELIVERY_CONCURRENCY ?? '5')
        // Use the shared delivery helper; it will log per-channel failures and continue.
        await deliverNotificationsForEvent(eventId, concurrency)
    },
    { connection, concurrency: 5 }
)

worker.on('completed', (job) => console.log('[notification-worker] completed', job.id))
worker.on('failed', (job, err) => console.error('[notification-worker] failed', job?.id, err))

console.log('[notification-worker] started')
