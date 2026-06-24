import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { requireWalletOwner } from '@/server/auth/wallet-auth'

export async function GET(req: NextRequest) {
  if (!prisma) {
    return NextResponse.json({
      success: true,
      tasks: [],
      message: 'Database not initialized',
    })
  }

  const walletAddress = new URL(req.url).searchParams.get('walletAddress')?.trim()
  const auth = requireWalletOwner(req, walletAddress)
  if (!auth.ok) return auth.response

  try {
    const recentResearch = await prisma.researchRun.findMany({
      where: { walletAddress: auth.walletAddress },
      orderBy: { createdAt: 'desc' },
      take: 6,
    })

    const recentNotifications = await prisma.notificationLog.findMany({
      where: { channel: { walletAddress: auth.walletAddress } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        channel: true,
      },
    })

    const recentEvents = await prisma.alertEvent.findMany({
      where: { walletAddress: auth.walletAddress },
      orderBy: { triggeredAt: 'desc' },
      take: 6,
    })

    const tasks = [
      ...recentResearch.map((r) => ({
        id: r.id,
        type: 'AI_RESEARCH',
        target: r.protocolSlug.toUpperCase(),
        status: 'COMPLETED',
        time: r.createdAt.toISOString(),
        detail: `Autonomous research brief generated for ${r.protocolSlug}.`,
      })),
      ...recentNotifications.map((n) => ({
        id: n.id,
        type: 'NOTIFICATION_DISPATCH',
        target: n.channel.type,
        status: n.status,
        time: n.createdAt.toISOString(),
        detail: `Dispatched threat alert to ${n.channel.name || n.channel.type} channel. status=${n.status}.`,
      })),
      ...recentEvents.map((e) => ({
        id: e.id,
        type: 'ALERT_EVALUATION',
        target: e.protocolSlug.toUpperCase(),
        status: e.summary ? 'COMPLETED' : 'TRIGGERED',
        time: e.triggeredAt.toISOString(),
        detail: `Rule trigger: ${e.metric} is ${e.direction} ${e.threshold} (current: ${e.currentValue}).`,
      })),
    ]

    tasks.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

    return NextResponse.json({
      success: true,
      tasks: tasks.slice(0, 15),
    })
  } catch (err) {
    console.error('[System Tasks API Error]:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
