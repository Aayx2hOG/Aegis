import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { getDatabaseSetupErrorMessage } from '@/server/db/prisma-errors'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!prisma) return Response.json({ error: 'Database not configured.' }, { status: 503 })

    const { id } = await params
    if (!id) return Response.json({ error: 'Channel id is required' }, { status: 400 })
    try {
        const channel = await prisma.notificationChannel.findUnique({ where: { id } })
        if (!channel) return Response.json({ error: 'Channel not found' }, { status: 404 })
        return Response.json({ channel })
    } catch (err) {
        const setupError = getDatabaseSetupErrorMessage(err)
        if (setupError) return Response.json({ error: setupError }, { status: 503 })
        return Response.json({ error: 'Failed to fetch channel' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!prisma) return Response.json({ error: 'Database not configured.' }, { status: 503 })

    const { id } = await params
    if (!id) return Response.json({ error: 'Channel id is required' }, { status: 400 })
    const body = (await req.json()) as Partial<{ name?: string; config?: unknown; enabled?: boolean }>

    try {
        const updated = await prisma.notificationChannel.update({ where: { id }, data: { name: body.name ?? undefined, config: body.config as any ?? undefined, enabled: body.enabled ?? undefined } })
        return Response.json({ channel: updated })
    } catch (err) {
        const setupError = getDatabaseSetupErrorMessage(err)
        if (setupError) return Response.json({ error: setupError }, { status: 503 })
        return Response.json({ error: 'Failed to update channel' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!prisma) return Response.json({ error: 'Database not configured.' }, { status: 503 })

    const { id } = await params
    if (!id) return Response.json({ error: 'Channel id is required' }, { status: 400 })
    try {
        await prisma.notificationChannel.delete({ where: { id } })
        return new Response(null, { status: 204 })
    } catch (err) {
        const setupError = getDatabaseSetupErrorMessage(err)
        if (setupError) return Response.json({ error: setupError }, { status: 503 })
        return Response.json({ error: 'Failed to delete channel' }, { status: 500 })
    }
}
