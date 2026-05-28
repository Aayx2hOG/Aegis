import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { sendDiscordWebhook } from '@/server/notifications/adapters/discord'
import { sendGenericWebhook } from '@/server/notifications/adapters/webhook'

const WEBHOOK_SECRET = process.env.UPSTASH_WEBHOOK_SECRET

function unauthorized() {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
}

export async function POST(req: NextRequest) {
    if (WEBHOOK_SECRET) {
        const auth = req.headers.get('authorization')
        if (!auth || auth !== `Bearer ${WEBHOOK_SECRET}`) return unauthorized()
    }

    const body = await req.json().catch(() => null)
    if (!body) return new Response('no body', { status: 400 })

    if (!prisma) return new Response(JSON.stringify({ error: 'Database not configured.' }), { status: 503 })

    const messages = body.messages ?? []
    for (const msg of messages) {
        const data = msg.body ?? {}
        const eventId = data.eventId as string | undefined
        if (!eventId) continue

        try {
            const event = await prisma.alertEvent.findUnique({ where: { id: eventId } })
            if (!event) continue

            const channels = await prisma.notificationChannel.findMany({ where: { walletAddress: event.walletAddress, enabled: true } })
            for (const ch of channels) {
                const log = await prisma.notificationLog.create({ data: { eventId, channelId: ch.id, status: 'PENDING' } })
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
                    await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'SENT', sentAt: new Date() } })
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err)
                    console.error('[notifications-webhook] delivery failed', message)
                    await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'FAILED', error: message } })
                }
            }
        } catch (err) {
            console.error('[notifications-webhook] processing message failed', err)
        }
    }

    return new Response('ok')
}
