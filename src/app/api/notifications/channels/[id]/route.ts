import { NextRequest } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { getDatabaseSetupErrorMessage } from '@/server/db/prisma-errors'
import {
  normalizeNotificationConfig,
  protectNotificationConfig,
  redactNotificationChannel,
} from '@/server/notifications/config'
import { requireWalletOwner } from '@/server/auth/wallet-auth'

function getWalletAddress(req: NextRequest) {
  return new URL(req.url).searchParams.get('walletAddress')?.trim()
}

function forbiddenChannelResponse() {
  return Response.json({ error: 'Channel not found' }, { status: 404 })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!prisma) return Response.json({ error: 'Database not configured.' }, { status: 503 })

  const { id } = await params
  if (!id) return Response.json({ error: 'Channel id is required' }, { status: 400 })
  const walletAddress = getWalletAddress(req)
  const auth = requireWalletOwner(req, walletAddress)
  if (!auth.ok) return auth.response
  try {
    const channel = await prisma.notificationChannel.findUnique({ where: { id } })
    if (!channel) return Response.json({ error: 'Channel not found' }, { status: 404 })
    if (channel.walletAddress !== auth.walletAddress) return forbiddenChannelResponse()
    return Response.json({ channel: redactNotificationChannel(channel) })
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
  const body = (await req.json()) as Partial<{
    walletAddress: string
    name?: string
    config?: unknown
    enabled?: boolean
  }>
  const auth = requireWalletOwner(req, body.walletAddress)
  if (!auth.ok) return auth.response

  try {
    const channel = await prisma.notificationChannel.findUnique({ where: { id } })
    if (!channel) return Response.json({ error: 'Channel not found' }, { status: 404 })
    if (channel.walletAddress !== auth.walletAddress) return forbiddenChannelResponse()

    let config: ReturnType<typeof normalizeNotificationConfig> | undefined
    try {
      config = body.config == null ? undefined : normalizeNotificationConfig(body.config, channel.type)
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'Invalid channel config' }, { status: 400 })
    }

    const updated = await prisma.notificationChannel.update({
      where: { id },
      data: { name: body.name ?? undefined, config: config ? protectNotificationConfig(config) : undefined, enabled: body.enabled ?? undefined },
    })
    return Response.json({ channel: redactNotificationChannel(updated) })
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
  const walletAddress = getWalletAddress(req)
  const auth = requireWalletOwner(req, walletAddress)
  if (!auth.ok) return auth.response
  try {
    const channel = await prisma.notificationChannel.findUnique({ where: { id } })
    if (!channel) return Response.json({ error: 'Channel not found' }, { status: 404 })
    if (channel.walletAddress !== auth.walletAddress) return forbiddenChannelResponse()
    await prisma.notificationChannel.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (err) {
    const setupError = getDatabaseSetupErrorMessage(err)
    if (setupError) return Response.json({ error: setupError }, { status: 503 })
    return Response.json({ error: 'Failed to delete channel' }, { status: 500 })
  }
}
