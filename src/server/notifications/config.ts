import net from 'node:net'
import crypto from 'node:crypto'

import { NotificationChannelType } from '@prisma/client'

export type ChannelConfig = {
  url?: string
  botToken?: string
  chatId?: string
  method?: string
  headers?: Record<string, string>
  secret?: string
  signatureHeader?: string
}

type EncryptedChannelConfig = {
  encrypted: true
  v: 1
  alg: 'aes-256-gcm'
  iv: string
  tag: string
  data: string
}

const BLOCKED_HOSTS = new Set(['localhost', '0.0.0.0'])
const DISCORD_WEBHOOK_HOSTS = new Set(['discord.com', 'discordapp.com'])

function getEncryptionKey() {
  const secret = process.env.AEGIS_ENCRYPTION_KEY
  if (!secret) return null
  return crypto.createHash('sha256').update(secret).digest()
}

function isEncryptedConfig(value: unknown): value is EncryptedChannelConfig {
  const candidate = value as Partial<EncryptedChannelConfig>
  return (
    Boolean(candidate) &&
    candidate.encrypted === true &&
    candidate.v === 1 &&
    candidate.alg === 'aes-256-gcm' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.tag === 'string' &&
    typeof candidate.data === 'string'
  )
}

function decryptConfig(config: EncryptedChannelConfig): unknown {
  const key = getEncryptionKey()
  if (!key) throw new Error('AEGIS_ENCRYPTION_KEY is required to read encrypted notification config')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(config.iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(config.tag, 'base64url'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(config.data, 'base64url')), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}

function isPrivateIp(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '')
  const version = net.isIP(host)

  if (version === 4) {
    const parts = host.split('.').map((part) => Number(part))
    const [a, b] = parts

    return (
      a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    )
  }

  if (version === 6) {
    const normalized = host.toLowerCase()
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    )
  }

  return false
}

export function validateNotificationUrl(rawUrl: unknown, type: NotificationChannelType): string {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new Error('Webhook URL is required')
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    throw new Error('Webhook URL is invalid')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS')
  }

  if (parsed.username || parsed.password) {
    throw new Error('Webhook URL must not include credentials')
  }

  const hostname = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.localhost') || isPrivateIp(hostname)) {
    throw new Error('Webhook URL host is not allowed')
  }

  if (type === NotificationChannelType.DISCORD) {
    if (!DISCORD_WEBHOOK_HOSTS.has(hostname) || !parsed.pathname.startsWith('/api/webhooks/')) {
      throw new Error('Discord channels require a valid Discord webhook URL')
    }
  }

  return parsed.toString()
}

export function normalizeNotificationConfig(config: unknown, type: NotificationChannelType): ChannelConfig {
  const unwrapped = isEncryptedConfig(config) ? decryptConfig(config) : config
  const candidate = unwrapped && typeof unwrapped === 'object' ? (unwrapped as Record<string, unknown>) : {}

  if (type === NotificationChannelType.TELEGRAM) {
    const botToken = typeof candidate.botToken === 'string' ? candidate.botToken.trim() : ''
    const chatId = typeof candidate.chatId === 'string' ? candidate.chatId.trim() : ''

    if (!botToken) {
      throw new Error('Telegram Bot Token is required')
    }
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
      throw new Error('Invalid Telegram Bot Token format')
    }

    if (!chatId) {
      throw new Error('Telegram Chat ID is required')
    }
    if (!/^-?\d+$/.test(chatId)) {
      throw new Error('Invalid Telegram Chat ID format')
    }

    return { botToken, chatId }
  }

  const url = validateNotificationUrl(candidate.url, type)
  return { url }
}

export function protectNotificationConfig(config: ChannelConfig): ChannelConfig | EncryptedChannelConfig {
  const key = getEncryptionKey()
  if (!key) return config

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(config), 'utf8'), cipher.final()])

  return {
    encrypted: true,
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: encrypted.toString('base64url'),
  }
}

function maskSecret(value?: string) {
  if (!value) return undefined
  if (value.length <= 8) return '********'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

export function redactNotificationConfig(config: unknown, type: NotificationChannelType) {
  const normalized = normalizeNotificationConfig(config, type)
  if (type === NotificationChannelType.TELEGRAM) {
    return {
      botToken: maskSecret(normalized.botToken),
      chatId: normalized.chatId,
    }
  }

  return {
    url: maskSecret(normalized.url),
  }
}

export function redactNotificationChannel<T extends { config: unknown; type: NotificationChannelType }>(
  channel: T,
): Omit<T, 'config'> & { config: ReturnType<typeof redactNotificationConfig> } {
  return {
    ...channel,
    config: redactNotificationConfig(channel.config, channel.type),
  }
}
