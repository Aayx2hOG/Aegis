import { prisma } from '@/server/db/prisma'
import { sendDiscordWebhook } from '@/server/notifications/adapters/discord'
import { sendGenericWebhook } from '@/server/notifications/adapters/webhook'

type DeliverResult = {
    sent: number
    failed: number
    failures: Array<{ channelId: string; error: string }>
}

export async function deliverNotificationsForEvent(eventId: string, concurrency = 5): Promise<DeliverResult> {
    if (!prisma) throw new Error('Database not configured.')
    const db = prisma

    const event = await db.alertEvent.findUnique({ where: { id: eventId } })
    if (!event) throw new Error('Alert event not found')

    const channels = await db.notificationChannel.findMany({ where: { walletAddress: event.walletAddress, enabled: true } })

    let sent = 0
    let failed = 0
    const failures: Array<{ channelId: string; error: string }> = []

    for (let i = 0; i < channels.length; i += concurrency) {
        const batch = channels.slice(i, i + concurrency)
        await Promise.all(
            batch.map(async (ch) => {
                const log = await db.notificationLog.create({ data: { eventId: event.id, channelId: ch.id, status: 'PENDING' } })
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

                    await db.notificationLog.update({ where: { id: log.id }, data: { status: 'SENT', sentAt: new Date() } })
                    sent += 1
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err)
                    console.error('[deliver-notifications] failed for channel', ch.id, message)
                    await db.notificationLog.update({ where: { id: log.id }, data: { status: 'FAILED', error: message } })
                    failed += 1
                    failures.push({ channelId: ch.id, error: message })
                }
            })
        )
    }

    return { sent, failed, failures }
}

export default deliverNotificationsForEvent
