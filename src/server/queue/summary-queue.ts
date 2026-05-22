import Redis from 'ioredis'
import { runResearchAgent } from '@/server/ai/aegis-research-agent'
import { prisma } from '@/server/db/prisma'

const redisUrl = process.env.REDIS_URL
const QUEUE_NAME = 'ai-summary'

if (!redisUrl) {
    console.warn('[summary-queue] REDIS_URL not set — using inline fallback for summary jobs')
}

export async function enqueueSummary(eventId: string, protocolSlug: string) {
    if (!redisUrl) {
        // Inline fallback: execute immediately (no retries)
        try {
            if (!prisma) throw new Error('DATABASE_URL is not configured.')
            const brief = await runResearchAgent(protocolSlug)
            const summary = typeof brief.brief === 'string' ? brief.brief : null
            await prisma.alertEvent.update({ where: { id: eventId }, data: { summary, summaryGeneratedAt: new Date() } })
            return { id: `inline-${eventId}` }
        } catch (err) {
            console.error('[summary-inline] failed to generate summary', err)
            throw err
        }
    }

    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null as any, lazyConnect: true })
    const { Queue } = await import('bullmq')
    const queue = new Queue(QUEUE_NAME, { connection })
    return queue.add('generate', { eventId, protocolSlug }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } })
}
