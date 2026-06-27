import Redis from 'ioredis'
import type { Queue } from 'bullmq'
import { runResearchAgent } from '@/server/ai/aegis-research-agent'
import { prisma } from '@/server/db/prisma'
import { updateEventAndPublishSummary } from '@/server/db/redis'

const redisUrl = process.env.REDIS_URL
const QUEUE_NAME = 'optional-explanation'
const UPSTASH_URL = process.env.UPSTASH_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REST_TOKEN

if (!redisUrl && !UPSTASH_URL) {
  console.warn(
    '[optional-explanation-queue] REDIS_URL and UPSTASH_REST_URL not set — using inline fallback for explanation jobs',
  )
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

export async function enqueueOptionalExplanation(eventId: string, protocolSlug: string) {
  // If Upstash is configured, prefer enqueueing via Upstash REST API (serverless-friendly)
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const appUrl =
        process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
      const destinationUrl = `${appUrl}/api/queues/optional-explanation`
      const webhookSecret = process.env.UPSTASH_WEBHOOK_SECRET

      const baseUrl = UPSTASH_URL.replace(/\/$/, '')
      const baseWithoutV2 = baseUrl.endsWith('/v2') ? baseUrl.slice(0, -3) : baseUrl
      const url = `${baseWithoutV2}/v2/publish/${destinationUrl}`

      const headers: Record<string, string> = {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
        'Upstash-Queue': QUEUE_NAME,
        'Upstash-Forward-Content-Type': 'application/json',
      }

      if (webhookSecret) {
        headers['Upstash-Forward-Authorization'] = `Bearer ${webhookSecret}`
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: [{ body: { eventId, protocolSlug } }] }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Upstash enqueue failed: ${res.status} ${text}`)
      }

      const json = await res.json()
      return json
    } catch (err) {
      console.error('[optional-explanation-queue] Upstash enqueue failed, falling back', err)
      // fall through to Redis or inline fallback
    }
  }

  // If Redis is configured, use BullMQ as before
  if (redisUrl) {
    const queue = await getRedisQueue()
    return queue.add(
      'generate',
      { eventId, protocolSlug },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    )
  }

  // Inline fallback: execute immediately (no retries)
  try {
    if (!prisma) throw new Error('DATABASE_URL is not configured.')
    const brief = await runResearchAgent(protocolSlug)
    const summary = typeof brief.brief === 'string' ? brief.brief : null
    await updateEventAndPublishSummary(eventId, summary)

    return { id: `inline-${eventId}` }
  } catch (err) {
    console.error('[optional-explanation-inline] failed to generate explanation', err)
    throw err
  }
}

export const enqueueSummary = enqueueOptionalExplanation
