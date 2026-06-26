import { AlertDirection, AlertMetric } from '@prisma/client'
import { prisma } from '@/server/db/prisma'
import { getSolanaProtocols } from '@/server/api/defillama'
import { enqueueOptionalExplanation } from '@/server/queue/optional-explanation-queue'
import { resolveProtocolFromList } from '@/lib/protocol/slug-resolver'
import { publishAlertEvent } from '@/server/db/redis'
import { executeTool } from '@/server/ai/aegis-tools'
import { areAlertAiSummariesEnabled } from '@/server/ai/config'
import type { SolanaProtocol } from '@/lib/types'

const EVENT_DEDUP_MS = 1000 * 60 * 60 * 6

function isTriggered(currentValue: number, threshold: number, direction: AlertDirection): boolean {
  return direction === AlertDirection.BELOW ? currentValue <= threshold : currentValue >= threshold
}

function formatMetricValue(metric: AlertMetric, value: number): string {
  if (metric === AlertMetric.TVL_USD) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(value)
  }
  if (metric === AlertMetric.PRICE_USD) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value)
  }
  return `${value.toFixed(2)}%`
}

async function resolveCurrentValue(
  rule: { protocolSlug: string; metric: AlertMetric },
  market?: SolanaProtocol,
): Promise<number | null> {
  if (rule.metric === AlertMetric.PRICE_USD) {
    try {
      const snapshot = (await executeTool('get_protocol_snapshot', { slug: rule.protocolSlug })) as {
        tokenPrice?: { price?: number }
      }
      return snapshot?.tokenPrice?.price ?? null
    } catch (err) {
      console.error(`[resolveCurrentValue] Failed to fetch price for ${rule.protocolSlug}:`, err)
      return null
    }
  }

  // TVL_USD or CHANGE_1D or CHANGE_7D
  if (market) {
    if (rule.metric === AlertMetric.TVL_USD) {
      return typeof market.tvl === 'number' ? market.tvl : null
    }
    if (rule.metric === AlertMetric.CHANGE_1D) {
      return typeof market.change_1d === 'number' ? market.change_1d : null
    }
    if (rule.metric === AlertMetric.CHANGE_7D) {
      return typeof market.change_7d === 'number' ? market.change_7d : null
    }
  }

  // Fallback for uncached or non-Solana protocols
  try {
    const tvlData = (await executeTool('get_protocol_tvl', { slug: rule.protocolSlug })) as {
      tvl?: number
      change1d?: number
      change7d?: number
    }
    if (rule.metric === AlertMetric.TVL_USD) {
      return typeof tvlData?.tvl === 'number' ? tvlData.tvl : null
    }
    if (rule.metric === AlertMetric.CHANGE_1D) {
      return typeof tvlData?.change1d === 'number' ? tvlData.change1d : null
    }
    if (rule.metric === AlertMetric.CHANGE_7D) {
      return typeof tvlData?.change7d === 'number' ? tvlData.change7d : null
    }
  } catch (err) {
    console.error(`[resolveCurrentValue] Fallback TVL fetch failed for ${rule.protocolSlug}:`, err)
  }

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
    const currentValue = await resolveCurrentValue(rule, market)

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

    const formattedVal = formatMetricValue(rule.metric, currentValue)
    const formattedThreshold = formatMetricValue(rule.metric, rule.threshold)
    const relation = rule.direction === AlertDirection.BELOW ? 'below or equal to' : 'above or equal to'

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
        reason: `Live value ${formattedVal} did not meet the rule condition (must be ${relation} ${formattedThreshold}).`,
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

    // Publish the created event to Redis Pub/Sub
    try {
      await publishAlertEvent('EVENT_CREATED', {
        id: createdEvent.id,
        ruleId: createdEvent.ruleId,
        walletAddress: createdEvent.walletAddress,
        protocolSlug: createdEvent.protocolSlug,
        metric: createdEvent.metric,
        threshold: createdEvent.threshold,
        direction: createdEvent.direction,
        currentValue: createdEvent.currentValue,
        triggeredAt: createdEvent.triggeredAt,
        summary: createdEvent.summary,
        summaryGeneratedAt: createdEvent.summaryGeneratedAt,
      })
    } catch (err) {
      console.error('[evaluateAlertsForWallet] failed to publish event to Redis:', err)
    }

    // Email delivery is disabled. Record that delivery was not attempted.
    const emailMessage = 'Email delivery disabled.'

    if (areAlertAiSummariesEnabled()) {
      // Optional explanation layer; alert triggering itself is fully rule-based.
      try {
        await enqueueOptionalExplanation(createdEvent.id, rule.protocolSlug as string)
      } catch (err) {
        console.error('[evaluateAlertsForWallet] failed to enqueue optional explanation job', err)
      }
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
      reason: `Rule condition met (live value ${formattedVal} is ${relation} ${formattedThreshold}) and alert event created. ${emailMessage}`,
    })
  }

  return {
    totalRules: rules.length,
    triggered,
    skipped,
    results,
  }
}
