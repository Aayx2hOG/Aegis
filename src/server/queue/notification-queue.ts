import Redis from 'ioredis'
import { prisma } from '@/server/db/prisma'
import { sendDiscordWebhook } from '@/server/notifications/adapters/discord'
import { sendGenericWebhook } from '@/server/notifications/adapters/webhook'

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

    // Inline fallback delivery
    try {
        if (!prisma) throw new Error('DATABASE_URL is not configured.')

        const event = await prisma.alertEvent.findUnique({ where: { id: eventId } })
        if (!event) throw new Error('Alert event not found')

        const channels = await prisma.notificationChannel.findMany({ where: { walletAddress: event.walletAddress, enabled: true } })

        for (const ch of channels) {
            const log = await prisma.notificationLog.create({ data: { eventId: event.id, channelId: ch.id, status: 'PENDING' } })
            try {
                const cfg = ch.config as Record<string, unknown>
                if (ch.type === 'DISCORD') {
                    const url = String(cfg.url ?? '')
                    if (!url) throw new Error('Missing Discord webhook URL in channel config')
                    await sendDiscordWebhook(url, event.summary ?? `Alert: ${event.protocolSlug}`)
                } else {
                    const url = String(cfg.url ?? '')
                    if (!url) throw new Error('Missing webhook URL in channel config')
                    await sendGenericWebhook(url, { eventId: event.id, protocol: event.protocolSlug, summary: event.summary ?? null })
                }

                await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'SENT', sentAt: new Date() } })
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                console.error('[notification-inline] failed to send notification', message)
                await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'FAILED', error: message } })
            }
        }

        return { id: `inline-notif-${eventId}` }
    } catch (err) {
        console.error('[notification-inline] failed', err)
        throw err
    }
}

export default enqueueNotification
