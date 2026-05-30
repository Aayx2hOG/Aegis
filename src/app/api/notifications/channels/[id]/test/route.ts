import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { getDatabaseSetupErrorMessage } from '@/server/db/prisma-errors'
import { sendDiscordWebhook } from '@/server/notifications/adapters/discord'
import { sendGenericWebhook } from '@/server/notifications/adapters/webhook'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!prisma) return Response.json({ error: 'Database not configured.' }, { status: 503 })

    const { id } = await params
    if (!id) return Response.json({ error: 'Channel id is required' }, { status: 400 })
    const body = (await req.json()) as Partial<{ message?: string }>

    try {
        const channel = await prisma.notificationChannel.findUnique({ where: { id } })
        if (!channel) return Response.json({ error: 'Channel not found' }, { status: 404 })

        const message = body?.message ?? `Test notification from Aegis: ${new Date().toISOString()}`
        const cfg = channel.config as Record<string, unknown>

        if (channel.type === 'DISCORD') {
            const url = String(cfg.url ?? '')
            if (!url) return Response.json({ error: 'Discord webhook URL not set in channel config' }, { status: 400 })
            await sendDiscordWebhook(url, message)
        } else {
            const url = String(cfg.url ?? '')
            if (!url) return Response.json({ error: 'Webhook URL not set in channel config' }, { status: 400 })
            await sendGenericWebhook(url, { test: true, message })
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
