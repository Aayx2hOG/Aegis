import { AlertDirection, AlertMetric, NotificationChannelType, Prisma } from '@prisma/client'

const mockFindEvent = jest.fn()
const mockFindChannels = jest.fn()
const mockCreateLog = jest.fn()
const mockFindLog = jest.fn()
const mockUpdateLog = jest.fn()
const mockUpsertLog = jest.fn()
const mockSendDiscordWebhook = jest.fn()
const mockSendTelegramMessage = jest.fn()

jest.mock('@/server/db/prisma', () => ({
  prisma: {
    alertEvent: { findUnique: mockFindEvent },
    notificationChannel: { findMany: mockFindChannels },
    notificationLog: {
      create: mockCreateLog,
      findUnique: mockFindLog,
      update: mockUpdateLog,
      upsert: mockUpsertLog,
    },
  },
}))

jest.mock('@/server/notifications/adapters/discord', () => ({
  sendDiscordWebhook: mockSendDiscordWebhook,
}))

jest.mock('@/server/notifications/adapters/telegram', () => ({
  sendTelegramMessage: mockSendTelegramMessage,
}))

describe('deliverNotificationsForEvent', () => {
  beforeEach(() => {
    mockFindEvent.mockReset()
    mockFindChannels.mockReset()
    mockCreateLog.mockReset()
    mockFindLog.mockReset()
    mockUpdateLog.mockReset()
    mockUpsertLog.mockReset()
    mockSendDiscordWebhook.mockReset()
    mockSendTelegramMessage.mockReset()

    mockFindEvent.mockResolvedValue({
      id: 'event-1',
      walletAddress: 'wallet-1',
      protocolSlug: 'jito',
      metric: AlertMetric.CHANGE_1D,
      threshold: 5,
      direction: AlertDirection.ABOVE,
      currentValue: 6.5,
      triggeredAt: new Date('2026-06-24T00:00:00.000Z'),
      summary: 'Jito alert summary',
    })
    mockUpdateLog.mockResolvedValue({})
    mockSendDiscordWebhook.mockResolvedValue(true)
    mockSendTelegramMessage.mockResolvedValue(true)
  })

  it('deduplicates channels that target the same external destination', async () => {
    const { deliverNotificationsForEvent } = await import('@/server/notifications/delivery')
    const url = 'https://discord.com/api/webhooks/123456789012345678/token'
    mockFindChannels.mockResolvedValue([
      { id: 'channel-1', walletAddress: 'wallet-1', type: NotificationChannelType.DISCORD, config: { url } },
      { id: 'channel-2', walletAddress: 'wallet-1', type: NotificationChannelType.DISCORD, config: { url } },
    ])
    mockCreateLog.mockResolvedValue({ id: 'log-1', status: 'PENDING' })

    const result = await deliverNotificationsForEvent('event-1')

    expect(result).toEqual({ sent: 1, failed: 0, failures: [] })
    expect(mockCreateLog).toHaveBeenCalledTimes(1)
    expect(mockCreateLog).toHaveBeenCalledWith({
      data: { eventId: 'event-1', channelId: 'channel-1', status: 'PENDING' },
    })
    expect(mockSendDiscordWebhook).toHaveBeenCalledTimes(1)
    expect(mockSendDiscordWebhook).toHaveBeenCalledWith(url, expect.stringContaining('🚨 AEGIS ALERT TRIGGERED'))
    expect(mockSendDiscordWebhook).toHaveBeenCalledWith(url, expect.stringContaining('Current value: 6.50%'))
  })

  it('does not resend when the event-channel log is already SENT', async () => {
    const { deliverNotificationsForEvent } = await import('@/server/notifications/delivery')
    mockFindChannels.mockResolvedValue([
      {
        id: 'channel-1',
        walletAddress: 'wallet-1',
        type: NotificationChannelType.TELEGRAM,
        config: { botToken: '123456:ABCdef_123', chatId: '-100123456' },
      },
    ])
    mockCreateLog.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    )
    mockFindLog.mockResolvedValue({
      id: 'log-1',
      status: 'SENT',
      error: null,
      createdAt: new Date('2026-06-24T00:00:00.000Z'),
    })

    const result = await deliverNotificationsForEvent('event-1')

    expect(result).toEqual({ sent: 0, failed: 0, failures: [] })
    expect(mockSendTelegramMessage).not.toHaveBeenCalled()
    expect(mockUpdateLog).not.toHaveBeenCalled()
  })
})
