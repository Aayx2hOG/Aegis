import { prisma } from '@/server/db/prisma'
import { evaluateAlertsForWallet } from '@/server/alerts/evaluator'

// Default evaluation interval is 60 seconds (1 minute).
// Can be customized via ALERT_EVALUATION_INTERVAL_MS env variable.
const EVALUATION_INTERVAL_MS = Number(process.env.ALERT_EVALUATION_INTERVAL_MS || '60000')

async function runEvaluationCycle() {
  console.log(`[scheduler-worker] starting alert evaluation cycle at ${new Date().toISOString()}...`)

  if (!prisma) {
    console.error('[scheduler-worker] database is not configured. (prisma is null)')
    return
  }

  try {
    // 1. Get all active wallet addresses that have enabled alert rules
    const uniqueWallets = await prisma.alertRule.findMany({
      where: { enabled: true },
      select: { walletAddress: true },
      distinct: ['walletAddress'],
    })

    console.log(`[scheduler-worker] found ${uniqueWallets.length} wallet address(es) with active alert rules.`)

    if (uniqueWallets.length === 0) {
      console.log('[scheduler-worker] no active alert rules to evaluate.')
      return
    }

    // 2. Evaluate rules for each wallet address
    for (const { walletAddress } of uniqueWallets) {
      console.log(`[scheduler-worker] evaluating rules for wallet: ${walletAddress}`)
      try {
        const result = await evaluateAlertsForWallet(walletAddress)
        console.log(
          `[scheduler-worker] wallet ${walletAddress} evaluation completed. ` +
            `totalRules=${result.totalRules}, triggered=${result.triggered}, skipped=${result.skipped}`,
        )
      } catch (walletErr) {
        console.error(`[scheduler-worker] error evaluating alerts for wallet ${walletAddress}:`, walletErr)
      }
    }
  } catch (err) {
    console.error('[scheduler-worker] database query failed during evaluation cycle:', err)
  }
}

async function startScheduler() {
  console.log(`[scheduler-worker] starting scheduler...`)
  console.log(
    `[scheduler-worker] evaluation interval set to: ${EVALUATION_INTERVAL_MS}ms (${(EVALUATION_INTERVAL_MS / 1000).toFixed(1)}s)`,
  )

  // Run the first evaluation cycle immediately on startup
  await runEvaluationCycle()

  // Set up the interval loop
  const interval = setInterval(async () => {
    await runEvaluationCycle()
  }, EVALUATION_INTERVAL_MS)

  // Clean shutdown handling
  const shutdown = () => {
    console.log('[scheduler-worker] shutting down...')
    clearInterval(interval)
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

startScheduler().catch((err) => {
  console.error('[scheduler-worker] critical error in scheduler main loop:', err)
  process.exit(1)
})
