import { AlertDirection, AlertMetric } from '@prisma/client'

const mockFindRules = jest.fn()
const mockFindLastEvent = jest.fn()
const mockCreateEvent = jest.fn()
const mockUpdateRule = jest.fn()
const mockGetSolanaProtocols = jest.fn()
const mockEnqueueOptionalExplanation = jest.fn()
const mockPublishAlertEvent = jest.fn()
const mockExecuteTool = jest.fn()

jest.mock('@/server/db/prisma', () => ({
  prisma: {
    alertRule: {
      findMany: mockFindRules,
      update: mockUpdateRule,
    },
    alertEvent: {
      findFirst: mockFindLastEvent,
      create: mockCreateEvent,
    },
  },
}))

jest.mock('@/server/api/defillama', () => ({
  getSolanaProtocols: mockGetSolanaProtocols,
}))

jest.mock('@/server/queue/optional-explanation-queue', () => ({
  enqueueOptionalExplanation: mockEnqueueOptionalExplanation,
}))

jest.mock('@/server/db/redis', () => ({
  publishAlertEvent: mockPublishAlertEvent,
}))

jest.mock('@/server/ai/aegis-tools', () => ({
  executeTool: mockExecuteTool,
}))

describe('evaluateAlertsForWallet', () => {
  const originalAlertSummariesEnabled = process.env.AEGIS_ALERT_AI_SUMMARIES_ENABLED

  beforeEach(() => {
    jest.useRealTimers()
    process.env.AEGIS_ALERT_AI_SUMMARIES_ENABLED = 'true'
    mockFindRules.mockReset()
    mockFindLastEvent.mockReset()
    mockCreateEvent.mockReset()
    mockUpdateRule.mockReset()
    mockGetSolanaProtocols.mockReset()
    mockEnqueueOptionalExplanation.mockReset()
    mockPublishAlertEvent.mockReset()
    mockExecuteTool.mockReset()

    mockGetSolanaProtocols.mockResolvedValue([
      { slug: 'jito', name: 'Jito', tvl: 100_000_000, change_1d: 6.5, change_7d: 12 },
    ])
    mockFindLastEvent.mockResolvedValue(null)
    mockCreateEvent.mockResolvedValue({
      id: 'event-1',
      ruleId: 'rule-1',
      walletAddress: 'wallet-1',
      protocolSlug: 'jito',
      metric: AlertMetric.CHANGE_1D,
      threshold: 5,
      direction: AlertDirection.ABOVE,
      currentValue: 6.5,
      triggeredAt: new Date('2026-06-24T00:00:00.000Z'),
      summary: null,
      summaryGeneratedAt: null,
    })
    mockUpdateRule.mockResolvedValue({})
    mockEnqueueOptionalExplanation.mockResolvedValue({ id: 'explanation-job-1' })
    mockPublishAlertEvent.mockResolvedValue(undefined)
  })

  afterEach(() => {
    if (originalAlertSummariesEnabled == null) {
      delete process.env.AEGIS_ALERT_AI_SUMMARIES_ENABLED
    } else {
      process.env.AEGIS_ALERT_AI_SUMMARIES_ENABLED = originalAlertSummariesEnabled
    }
  })

  it('creates an alert event and enqueues summary generation when a rule triggers', async () => {
    const { evaluateAlertsForWallet } = await import('@/server/alerts/evaluator')
    mockFindRules.mockResolvedValue([
      {
        id: 'rule-1',
        walletAddress: 'wallet-1',
        protocolSlug: 'jito',
        metric: AlertMetric.CHANGE_1D,
        threshold: 5,
        direction: AlertDirection.ABOVE,
        enabled: true,
        createdAt: new Date('2026-06-24T00:00:00.000Z'),
      },
    ])

    const result = await evaluateAlertsForWallet('wallet-1')

    expect(result.triggered).toBe(1)
    expect(result.skipped).toBe(0)
    expect(mockCreateEvent).toHaveBeenCalledWith({
      data: {
        ruleId: 'rule-1',
        walletAddress: 'wallet-1',
        protocolSlug: 'jito',
        metric: AlertMetric.CHANGE_1D,
        threshold: 5,
        direction: AlertDirection.ABOVE,
        currentValue: 6.5,
      },
    })
    expect(mockPublishAlertEvent).toHaveBeenCalledWith('EVENT_CREATED', expect.objectContaining({ id: 'event-1' }))
    expect(mockEnqueueOptionalExplanation).toHaveBeenCalledWith('event-1', 'jito')
    expect(mockUpdateRule).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: { lastTriggeredAt: expect.any(Date) },
    })
  })

  it('creates an alert event without automatic summaries when AI summaries are disabled', async () => {
    process.env.AEGIS_ALERT_AI_SUMMARIES_ENABLED = 'false'
    const { evaluateAlertsForWallet } = await import('@/server/alerts/evaluator')
    mockFindRules.mockResolvedValue([
      {
        id: 'rule-1',
        walletAddress: 'wallet-1',
        protocolSlug: 'jito',
        metric: AlertMetric.CHANGE_1D,
        threshold: 5,
        direction: AlertDirection.ABOVE,
        enabled: true,
        createdAt: new Date('2026-06-24T00:00:00.000Z'),
      },
    ])

    const result = await evaluateAlertsForWallet('wallet-1')

    expect(result.triggered).toBe(1)
    expect(mockCreateEvent).toHaveBeenCalled()
    expect(mockEnqueueOptionalExplanation).not.toHaveBeenCalled()
  })

  it('deduplicates repeated rule triggers within the six-hour event window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-24T12:00:00.000Z').getTime())
    const { evaluateAlertsForWallet } = await import('@/server/alerts/evaluator')
    mockFindRules.mockResolvedValue([
      {
        id: 'rule-1',
        walletAddress: 'wallet-1',
        protocolSlug: 'jito',
        metric: AlertMetric.CHANGE_1D,
        threshold: 5,
        direction: AlertDirection.ABOVE,
        enabled: true,
        createdAt: new Date('2026-06-24T00:00:00.000Z'),
      },
    ])
    mockFindLastEvent.mockResolvedValue({ triggeredAt: new Date('2026-06-24T08:00:00.000Z') })

    const result = await evaluateAlertsForWallet('wallet-1')

    expect(result.triggered).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.results[0].reason).toContain('last 6 hours')
    expect(mockCreateEvent).not.toHaveBeenCalled()
    expect(mockEnqueueOptionalExplanation).not.toHaveBeenCalled()
  })

  it('skips a rule when no live value can be resolved', async () => {
    const { evaluateAlertsForWallet } = await import('@/server/alerts/evaluator')
    mockGetSolanaProtocols.mockResolvedValue([])
    mockExecuteTool.mockResolvedValue({})
    mockFindRules.mockResolvedValue([
      {
        id: 'rule-2',
        walletAddress: 'wallet-1',
        protocolSlug: 'unknown-protocol',
        metric: AlertMetric.TVL_USD,
        threshold: 1_000_000,
        direction: AlertDirection.BELOW,
        enabled: true,
        createdAt: new Date('2026-06-24T00:00:00.000Z'),
      },
    ])

    const result = await evaluateAlertsForWallet('wallet-1')

    expect(result.triggered).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.results[0]).toMatchObject({
      ruleId: 'rule-2',
      status: 'skipped',
      currentValue: null,
      reason: 'No live market value was available.',
    })
    expect(mockCreateEvent).not.toHaveBeenCalled()
  })
})
