import { AlertDirection, AlertMetric } from '@prisma/client'
import { NextRequest } from 'next/server'
import { getDatabaseSetupErrorMessage } from '@/server/db/prisma-errors'
import { prisma } from '@/server/db/prisma'
import { normalizeProtocolSlug } from '@/lib/protocol/slug-resolver'
import { requireWalletOwner } from '@/server/auth/wallet-auth'

function isAlertMetric(value: string): value is AlertMetric {
  return (
    value === AlertMetric.CHANGE_1D ||
    value === AlertMetric.CHANGE_7D ||
    value === AlertMetric.TVL_USD ||
    value === AlertMetric.PRICE_USD
  )
}

function isAlertDirection(value: string): value is AlertDirection {
  return value === AlertDirection.BELOW || value === AlertDirection.ABOVE
}

export async function GET(req: NextRequest) {
  if (!prisma) {
    return Response.json(
      { error: 'Database is not configured. Set DATABASE_URL or POSTGRES_PRISMA_URL.' },
      { status: 503 },
    )
  }

  const url = new URL(req.url)
  const walletAddress = url.searchParams.get('walletAddress')?.trim()
  const auth = requireWalletOwner(req, walletAddress)
  if (!auth.ok) return auth.response

  try {
    const [rules, recentEvents] = await Promise.all([
      prisma.alertRule.findMany({
        where: { walletAddress: auth.walletAddress },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.alertEvent.findMany({
        where: { walletAddress: auth.walletAddress },
        orderBy: { triggeredAt: 'desc' },
        take: 15,
      }),
    ])

    return Response.json({ rules, recentEvents })
  } catch (err) {
    const setupError = getDatabaseSetupErrorMessage(err)
    if (setupError) {
      return Response.json({ error: setupError }, { status: 503 })
    }

    return Response.json({ error: 'Alerts unavailable.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!prisma) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })
  }

  const body = (await req.json()) as Partial<{
    walletAddress: string
    protocolSlug: string
    metric: string
    threshold: number
    direction: string
  }>

  if (!body.walletAddress || !body.protocolSlug || !body.metric || body.threshold == null || !body.direction) {
    return Response.json(
      { error: 'walletAddress, protocolSlug, metric, threshold, direction are required' },
      { status: 400 },
    )
  }

  const auth = requireWalletOwner(req, body.walletAddress)
  if (!auth.ok) return auth.response

  if (!isAlertMetric(body.metric) || !isAlertDirection(body.direction)) {
    return Response.json({ error: 'Invalid metric or direction.' }, { status: 400 })
  }

  const threshold = Number(body.threshold)
  if (!Number.isFinite(threshold)) {
    return Response.json({ error: 'threshold must be a number' }, { status: 400 })
  }

  const rule = await prisma.alertRule.create({
    data: {
      walletAddress: auth.walletAddress,
      protocolSlug: normalizeProtocolSlug(body.protocolSlug),
      metric: body.metric,
      threshold,
      direction: body.direction,
      enabled: true,
    },
  })

  return Response.json({ rule }, { status: 201 })
}
