import { AlertDirection, AlertMetric } from '@prisma/client'
import { prisma } from '@/server/db/prisma'
import { getSolanaProtocols } from '@/server/api/defillama'
import { enqueueSummary } from '@/server/queue/summary-queue'
import { resolveProtocolFromList } from '@/shared/protocol/slug-resolver'

const EVENT_DEDUP_MS = 1000 * 60 * 60 * 6

function isTriggered(currentValue: number, threshold: number, direction: AlertDirection): boolean {
  return direction === AlertDirection.BELOW ? currentValue <= threshold : currentValue >= threshold
}

function getMetricValue(
  metric: AlertMetric,
  change1d: number | null | undefined,
  change7d: number | null | undefined,
): number | null {
  if (metric === AlertMetric.CHANGE_1D) return typeof change1d === 'number' ? change1d : null
  if (metric === AlertMetric.CHANGE_7D) return typeof change7d === 'number' ? change7d : null
  return null
}

// Email functionality removed: evaluator will only create events and enqueue summaries.

export async function evaluateAlertsForWallet(walletAddress: string) {
  if (!prisma) {
    throw new Error('DATABASE_URL is not configured.')
  }

  const [rules, protocols] = await Promise.all([
    prisma.alertRule.findMany({
      where: { walletAddress, enabled: true },
      orderBy: { createdAt: 'desc' },
    }),
    getSolanaProtocols(),
  ])

  let triggered = 0
  let skipped = 0
  const results: Array<{
    ruleId: string
    protocolSlug: string
    metric: AlertMetric
    threshold: number
    direction: AlertDirection
    status: 'triggered' | 'skipped'
    currentValue: number | null
    reason: string
  }> = []

  for (const rule of rules) {
    const market = resolveProtocolFromList(rule.protocolSlug, protocols)
    const currentValue = getMetricValue(rule.metric, market?.change_1d, market?.change_7d)

    if (currentValue == null) {
      skipped++
      results.push({
        ruleId: rule.id,
        protocolSlug: rule.protocolSlug,
        metric: rule.metric,
        threshold: rule.threshold,
        direction: rule.direction,
        status: 'skipped',
        currentValue: null,
        reason: 'No live market value was available.',
      })
      continue
    }

    if (!isTriggered(currentValue, rule.threshold, rule.direction)) {
      skipped++
      results.push({
        ruleId: rule.id,
        protocolSlug: rule.protocolSlug,
        metric: rule.metric,
        threshold: rule.threshold,
        direction: rule.direction,
        status: 'skipped',
        currentValue,
        reason: 'Live value did not meet the rule condition.',
      })
      continue
    }

    const lastEvent = await prisma.alertEvent.findFirst({
      where: { ruleId: rule.id },
      orderBy: { triggeredAt: 'desc' },
      select: { triggeredAt: true },
    })

    const recentlyTriggered = lastEvent && Date.now() - new Date(lastEvent.triggeredAt).getTime() < EVENT_DEDUP_MS

    if (recentlyTriggered) {
      skipped++
      results.push({
        ruleId: rule.id,
        protocolSlug: rule.protocolSlug,
        metric: rule.metric,
        threshold: rule.threshold,
        direction: rule.direction,
        status: 'skipped',
        currentValue,
        reason: 'Rule already triggered in the last 6 hours; alert event and email were not repeated.',
      })
      continue
    }

    const createdEvent = await prisma.alertEvent.create({
      data: {
        ruleId: rule.id,
        walletAddress: rule.walletAddress,
        protocolSlug: rule.protocolSlug,
        metric: rule.metric,
        threshold: rule.threshold,
        direction: rule.direction,
        currentValue,
      },
    })

    // Email delivery is disabled. Record that delivery was not attempted.
    const emailMessage = 'Email delivery disabled.'

    // Enqueue summary generation job (worker will update the event).
    try {
      await enqueueSummary(createdEvent.id, rule.protocolSlug as string)
    } catch (err) {
      console.error('[evaluateAlertsForWallet] failed to enqueue AI summary job', err)
    }

    await prisma.alertRule.update({
      where: { id: rule.id },
      data: { lastTriggeredAt: new Date() },
    })

    // No email metadata to persist since email is disabled.

    triggered++
    results.push({
      ruleId: rule.id,
      protocolSlug: rule.protocolSlug,
      metric: rule.metric,
      threshold: rule.threshold,
      direction: rule.direction,
      status: 'triggered',
      currentValue,
      reason: `Rule condition met and alert event created. ${emailMessage}`,
    })
  }

  return {
    totalRules: rules.length,
    triggered,
    skipped,
    results,
  }
}

