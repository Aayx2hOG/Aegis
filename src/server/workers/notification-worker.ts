import Redis from 'ioredis'
import { Worker } from 'bullmq'
import { prisma } from '@/server/db/prisma'
import { sendDiscordWebhook } from '@/server/notifications/adapters/discord'
import { sendGenericWebhook } from '@/server/notifications/adapters/webhook'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) {
    console.error('[notification-worker] REDIS_URL not set; this worker requires Redis')
    process.exit(1)
}

const connection = new Redis(redisUrl)

if (!prisma) {
    console.error('[notification-worker] DATABASE_URL is not configured; worker cannot run')
    process.exit(1)
}

const worker = new Worker(
    'notifications',
    async (job) => {
        const { eventId } = job.data as { eventId: string }
        console.log('[notification-worker] processing', eventId)

        const event = await prisma!.alertEvent.findUnique({ where: { id: eventId } })
        if (!event) throw new Error('Alert event not found')

        const channels = await prisma!.notificationChannel.findMany({ where: { walletAddress: event.walletAddress, enabled: true } })

        for (const ch of channels) {
            const log = await prisma!.notificationLog.create({ data: { eventId: event.id, channelId: ch.id, status: 'PENDING' } })
            try {
                const cfg = ch.config as Record<string, any>
                if (ch.type === 'DISCORD') {
                    const url = String(cfg.url ?? '')
                    if (!url) throw new Error('Missing Discord webhook URL in channel config')
                    await sendDiscordWebhook(url, event.summary ?? `Alert: ${event.protocolSlug}`)
                } else {
                    const url = String(cfg.url ?? '')
                    if (!url) throw new Error('Missing webhook URL in channel config')
                    await sendGenericWebhook(url, { eventId: event.id, protocol: event.protocolSlug, summary: event.summary ?? null })
                }

                await prisma!.notificationLog.update({ where: { id: log.id }, data: { status: 'SENT', sentAt: new Date() } })
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                console.error('[notification-worker] failed to send notification', message)
                await prisma!.notificationLog.update({ where: { id: log.id }, data: { status: 'FAILED', error: message } })
                throw err
            }
        }
    },
    { connection, concurrency: 5 }
)

worker.on('completed', (job) => console.log('[notification-worker] completed', job.id))
worker.on('failed', (job, err) => console.error('[notification-worker] failed', job?.id, err))

console.log('[notification-worker] started')
