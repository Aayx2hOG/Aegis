import { NotificationChannelType } from '@prisma/client'
import { validateNotificationUrl, ChannelConfig } from '@/server/notifications/config'
import crypto from 'node:crypto'

export async function sendGenericWebhook(cfg: ChannelConfig, payload: unknown) {
    const safeUrl = validateNotificationUrl(cfg.url, NotificationChannelType.WEBHOOK)

    const method = cfg.method ?? 'POST'
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(cfg.headers ?? {}) }

    const bodyStr = JSON.stringify(payload)

    // Add HMAC signature if secret provided
    if (cfg.secret) {
        const sigHeader = cfg.signatureHeader ?? 'x-aegis-signature'
        const h = crypto.createHmac('sha256', cfg.secret).update(bodyStr).digest('hex')
        headers[sigHeader] = `sha256=${h}`
    }

    const res = await fetch(safeUrl, {
        method,
        headers,
        body: bodyStr,
    })

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Webhook failed: ${res.status} ${text}`)
    }

    return true
}

export default sendGenericWebhook
