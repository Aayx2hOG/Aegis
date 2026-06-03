import Redis from 'ioredis'
import { Worker } from 'bullmq'
import { runResearchAgent } from '@/server/ai/aegis-research-agent'
import { prisma } from '@/server/db/prisma'
import { enqueueNotification } from '@/server/queue/notification-queue'
import { updateEventAndPublishSummary } from '@/server/db/redis'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) {
    console.error('[ai-summary-worker] REDIS_URL not set; this worker requires Redis')
    process.exit(1)
}

const connection = new Redis(redisUrl)

if (!prisma) {
    console.error('[ai-summary-worker] DATABASE_URL is not configured; worker cannot run')
    process.exit(1)
}

const worker = new Worker(
    'ai-summary',
    async (job) => {
        const { eventId, protocolSlug } = job.data as { eventId: string; protocolSlug: string }
        console.log('[ai-summary-worker] processing', eventId, protocolSlug)

        const brief = await runResearchAgent(protocolSlug)
        const summary = typeof brief.brief === 'string' ? brief.brief : null

        await updateEventAndPublishSummary(eventId, summary)

        // Enqueue notification job (notification worker will deliver)
        try {
            await enqueueNotification(eventId)
        } catch (err) {
            console.error('[ai-summary-worker] failed to enqueue notification', err)
            throw err
        }
    },
    { connection, concurrency: 2 }
)

worker.on('completed', (job) => console.log('[ai-summary-worker] completed', job.id))
worker.on('failed', (job, err) => console.error('[ai-summary-worker] failed', job?.id, err))

console.log('[ai-summary-worker] started')
