import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db/prisma'
import { evaluateAlertsForWallet } from '@/server/alerts/evaluator'

const CRON_SECRET = process.env.ALERT_CRON_SECRET || process.env.CRON_SECRET

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}

async function handleCron(req: NextRequest) {
  // 1. Verify cron secret if configured
  if (CRON_SECRET) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
      return unauthorized()
    }
  }

  if (!prisma) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 })
  }

  try {
    // 2. Fetch all unique wallets with active rules
    const uniqueWallets = await prisma.alertRule.findMany({
      where: { enabled: true },
      select: { walletAddress: true },
      distinct: ['walletAddress'],
    })

    const summaries = []

    // 3. Evaluate each wallet's alerts
    for (const { walletAddress } of uniqueWallets) {
      try {
        const summary = await evaluateAlertsForWallet(walletAddress)
        summaries.push({
          walletAddress,
          totalRules: summary.totalRules,
          triggered: summary.triggered,
          skipped: summary.skipped,
          results: summary.results,
        })
      } catch (err) {
        console.error(`[cron-evaluate] failed for wallet ${walletAddress}:`, err)
        summaries.push({
          walletAddress,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return NextResponse.json({
      success: true,
      walletsEvaluated: uniqueWallets.length,
      summaries,
    })
  } catch (err) {
    console.error('[cron-evaluate] critical error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
