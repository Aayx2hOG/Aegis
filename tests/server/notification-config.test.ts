import { NotificationChannelType } from '@prisma/client'
import {
  normalizeNotificationConfig,
  protectNotificationConfig,
  redactNotificationConfig,
} from '@/server/notifications/config'

describe('notification config protection', () => {
  const originalKey = process.env.AEGIS_ENCRYPTION_KEY

  afterEach(() => {
    if (originalKey == null) {
      delete process.env.AEGIS_ENCRYPTION_KEY
    } else {
      process.env.AEGIS_ENCRYPTION_KEY = originalKey
    }
  })

  it('encrypts and decrypts channel config when a key is configured', () => {
    process.env.AEGIS_ENCRYPTION_KEY = 'unit-test-encryption-key'
    const config = { botToken: '123456:ABCdef_123', chatId: '-100123456' }

    const protectedConfig = protectNotificationConfig(config)

    expect(protectedConfig).toHaveProperty('encrypted', true)
    expect(JSON.stringify(protectedConfig)).not.toContain(config.botToken)
    expect(normalizeNotificationConfig(protectedConfig, NotificationChannelType.TELEGRAM)).toEqual(config)
  })

  it('redacts Discord webhook URLs in API-safe config', () => {
    const redacted = redactNotificationConfig(
      { url: 'https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz' },
      NotificationChannelType.DISCORD,
    )

    expect(redacted.url).toBe('http...wxyz')
  })
})
