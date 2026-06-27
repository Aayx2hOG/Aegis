import type { AlertDirection, AlertMetric } from '@prisma/client'

type AlertMessageEvent = {
  protocolSlug: string
  metric: AlertMetric
  threshold: number
  direction: AlertDirection
  currentValue: number
  triggeredAt: Date
  summary?: string | null
}

const METRIC_LABELS: Record<AlertMetric, string> = {
  TVL_USD: 'TVL',
  PRICE_USD: 'Token price',
  CHANGE_1D: '24h change',
  CHANGE_7D: '7d change',
}

function formatProtocolName(slug: string) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatValue(metric: AlertMetric, value: number) {
  if (metric === 'TVL_USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value)
  }

  if (metric === 'PRICE_USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value)
  }

  return `${value.toFixed(2)}%`
}

function getAlertHubUrl() {
  const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  if (!appUrl) return null

  try {
    const url = new URL(appUrl)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null
    return `${url.toString().replace(/\/$/, '')}/alerts`
  } catch {
    return null
  }
}

export function formatAlertNotification(event: AlertMessageEvent) {
  const metric = METRIC_LABELS[event.metric]
  const relation = event.direction === 'BELOW' ? 'at or below' : 'at or above'
  const lines = [
    '🚨 AEGIS ALERT TRIGGERED',
    '',
    `Protocol: ${formatProtocolName(event.protocolSlug)}`,
    `Metric: ${metric}`,
    `Current value: ${formatValue(event.metric, event.currentValue)}`,
    `Alert rule: ${relation} ${formatValue(event.metric, event.threshold)}`,
    `Triggered: ${event.triggeredAt.toISOString()}`,
  ]

  const alertHubUrl = getAlertHubUrl()
  if (alertHubUrl) lines.push(`Open Alert Hub: ${alertHubUrl}`)

  if (event.summary?.trim()) {
    lines.push('', `Context: ${event.summary.trim().slice(0, 600)}`)
  }

  return lines.join('\n').slice(0, 1900)
}
