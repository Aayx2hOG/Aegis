import Redis from 'ioredis'
import { Worker } from 'bullmq'
import { runResearchAgent } from '@/server/ai/aegis-research-agent'
import { prisma } from '@/server/db/prisma'
import { updateEventAndPublishSummary } from '@/server/db/redis'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) {
  console.error('[optional-explanation-worker] REDIS_URL not set; this worker requires Redis')
  process.exit(1)
}

const connection = new Redis(redisUrl, { maxRetriesPerRequest: null })

if (!prisma) {
  console.error('[optional-explanation-worker] DATABASE_URL is not configured; worker cannot run')
  process.exit(1)
}

const worker = new Worker(
  'optional-explanation',
  async (job) => {
    const { eventId, protocolSlug } = job.data as { eventId: string; protocolSlug: string }
    console.log('[optional-explanation-worker] processing', eventId, protocolSlug)

    const brief = await runResearchAgent(protocolSlug)
    const summary = typeof brief.brief === 'string' ? brief.brief : null

    await updateEventAndPublishSummary(eventId, summary)
  },
  { connection, concurrency: 2 },
)

worker.on('completed', (job) => console.log('[optional-explanation-worker] completed', job.id))
worker.on('failed', (job, err) => console.error('[optional-explanation-worker] failed', job?.id, err))

console.log('[optional-explanation-worker] started')
