import { AlertDirection, AlertMetric } from '@prisma/client'
import { formatAlertNotification } from '@/server/notifications/message'

describe('formatAlertNotification', () => {
  const originalAppUrl = process.env.APP_URL

  afterEach(() => {
    if (originalAppUrl == null) delete process.env.APP_URL
    else process.env.APP_URL = originalAppUrl
  })

  it('builds a useful deterministic risk alert', () => {
    process.env.APP_URL = 'https://aegis.example'

    const message = formatAlertNotification({
      protocolSlug: 'pumpswap',
      metric: AlertMetric.TVL_USD,
      threshold: 50_000_000,
      direction: AlertDirection.BELOW,
      currentValue: 42_300_000,
      triggeredAt: new Date('2026-06-28T16:45:00.000Z'),
      summary: null,
    })

    expect(message).toBe(`🚨 AEGIS ALERT TRIGGERED

Protocol: Pumpswap
Metric: TVL
Current value: $42.3M
Alert rule: at or below $50M
Triggered: 2026-06-28T16:45:00.000Z
Open Alert Hub: https://aegis.example/alerts`)
  })

  it('formats percentage alerts and includes concise optional context', () => {
    delete process.env.APP_URL

    const message = formatAlertNotification({
      protocolSlug: 'jupiter-perpetual-exchange',
      metric: AlertMetric.CHANGE_1D,
      threshold: 5,
      direction: AlertDirection.ABOVE,
      currentValue: 6.5,
      triggeredAt: new Date('2026-06-28T16:45:00.000Z'),
      summary: 'Market activity increased.',
    })

    expect(message).toContain('Protocol: Jupiter Perpetual Exchange')
    expect(message).toContain('Metric: 24h change')
    expect(message).toContain('Current value: 6.50%')
    expect(message).toContain('Alert rule: at or above 5.00%')
    expect(message).toContain('Context: Market activity increased.')
  })
})
