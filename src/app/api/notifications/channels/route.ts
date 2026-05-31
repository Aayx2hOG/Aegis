import { NextRequest } from 'next/server'
import { NotificationChannelType } from '@prisma/client'
import { prisma } from '@/server/db/prisma'
import { getDatabaseSetupErrorMessage } from '@/server/db/prisma-errors'
import { normalizeNotificationConfig } from '@/server/notifications/config'

function isChannelType(value: string): value is NotificationChannelType {
    return value === NotificationChannelType.DISCORD || value === NotificationChannelType.WEBHOOK
}

export async function GET(req: NextRequest) {
    if (!prisma) {
        return Response.json({ error: 'Database is not configured. Set DATABASE_URL or POSTGRES_PRISMA_URL.' }, { status: 503 })
    }

    const url = new URL(req.url)
    const walletAddress = url.searchParams.get('walletAddress')?.trim()

    if (!walletAddress) {
        return Response.json({ error: 'walletAddress is required' }, { status: 400 })
    }

    try {
        const channels = await prisma.notificationChannel.findMany({ where: { walletAddress } })
        return Response.json({ channels })
    } catch (err) {
        const setupError = getDatabaseSetupErrorMessage(err)
        if (setupError) return Response.json({ error: setupError }, { status: 503 })
        return Response.json({ error: 'Failed to list channels.' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    if (!prisma) {
        return Response.json({ error: 'Database is not configured. Set DATABASE_URL or POSTGRES_PRISMA_URL.' }, { status: 503 })
    }

    const body = (await req.json()) as Partial<{ walletAddress: string; type: string; config: unknown; name?: string; enabled?: boolean }>

    if (!body.walletAddress || !body.type || body.config == null) {
        return Response.json({ error: 'walletAddress, type, and config are required' }, { status: 400 })
    }

    if (!isChannelType(body.type)) {
        return Response.json({ error: 'Invalid channel type' }, { status: 400 })
    }

    let config: ReturnType<typeof normalizeNotificationConfig>
    try {
        config = normalizeNotificationConfig(body.config, body.type)
    } catch (err) {
        return Response.json({ error: err instanceof Error ? err.message : 'Invalid channel config' }, { status: 400 })
    }

    try {
        const channel = await prisma.notificationChannel.create({
            data: {
                walletAddress: body.walletAddress.trim(),
                type: body.type,
                config,
                name: body.name ?? null,
                enabled: body.enabled ?? true,
            },
        })

        return Response.json({ channel }, { status: 201 })
    } catch (err) {
        const setupError = getDatabaseSetupErrorMessage(err)
        if (setupError) return Response.json({ error: setupError }, { status: 503 })
        return Response.json({ error: 'Failed to create channel.' }, { status: 500 })
    }
}
