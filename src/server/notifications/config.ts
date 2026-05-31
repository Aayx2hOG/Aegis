import net from 'node:net'

import { NotificationChannelType } from '@prisma/client'

type ChannelConfig = {
    url: string
}

const BLOCKED_HOSTS = new Set(['localhost', '0.0.0.0'])
const DISCORD_WEBHOOK_HOSTS = new Set(['discord.com', 'discordapp.com'])

function isPrivateIp(hostname: string) {
    const host = hostname.replace(/^\[|\]$/g, '')
    const version = net.isIP(host)

    if (version === 4) {
        const parts = host.split('.').map((part) => Number(part))
        const [a, b] = parts

        return (
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168)
        )
    }

    if (version === 6) {
        const normalized = host.toLowerCase()
        return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')
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
    const candidate = config && typeof config === 'object' ? (config as Record<string, unknown>) : {}
    return {
        url: validateNotificationUrl(candidate.url, type),
    }
}

