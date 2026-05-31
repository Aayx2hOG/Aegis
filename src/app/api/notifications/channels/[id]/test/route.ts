import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { getDatabaseSetupErrorMessage } from '@/server/db/prisma-errors'
import { sendDiscordWebhook } from '@/server/notifications/adapters/discord'
import { sendGenericWebhook } from '@/server/notifications/adapters/webhook'
import { normalizeNotificationConfig } from '@/server/notifications/config'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!prisma) return Response.json({ error: 'Database not configured.' }, { status: 503 })

    const { id } = await params
    if (!id) return Response.json({ error: 'Channel id is required' }, { status: 400 })
    const body = (await req.json()) as Partial<{ walletAddress: string; message?: string }>
    if (!body.walletAddress?.trim()) return Response.json({ error: 'walletAddress is required' }, { status: 400 })

    try {
        const channel = await prisma.notificationChannel.findUnique({ where: { id } })
        if (!channel) return Response.json({ error: 'Channel not found' }, { status: 404 })
        if (channel.walletAddress !== body.walletAddress.trim()) return Response.json({ error: 'Channel not found' }, { status: 404 })
        if (!channel.enabled) return Response.json({ error: 'Channel is disabled' }, { status: 409 })

        const message = body?.message ?? `Test notification from Aegis: ${new Date().toISOString()}`
        let cfg: ReturnType<typeof normalizeNotificationConfig>
        try {
            cfg = normalizeNotificationConfig(channel.config, channel.type)
        } catch (err) {
            return Response.json({ error: err instanceof Error ? err.message : 'Invalid channel config' }, { status: 400 })
        }

        if (channel.type === 'DISCORD') {
            await sendDiscordWebhook(cfg.url, message)
        } else {
            await sendGenericWebhook(cfg.url, { test: true, message })
        }

        const log = await prisma.notificationLog.create({ data: { eventId: `test-${Date.now()}`, channelId: channel.id, status: 'SENT', sentAt: new Date() } })
        return Response.json({ ok: true, log })
    } catch (err) {
        const setupError = getDatabaseSetupErrorMessage(err)
        if (setupError) return Response.json({ error: setupError }, { status: 503 })
        const message = err instanceof Error ? err.message : 'Failed to send test notification'
        return Response.json({ error: message }, { status: 500 })
    }
}
