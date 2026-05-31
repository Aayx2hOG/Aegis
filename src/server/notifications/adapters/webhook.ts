import { NotificationChannelType } from '@prisma/client'
import { validateNotificationUrl } from '@/server/notifications/config'

export async function sendGenericWebhook(url: string, payload: unknown) {
    const safeUrl = validateNotificationUrl(url, NotificationChannelType.WEBHOOK)

    const res = await fetch(safeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Webhook failed: ${res.status} ${text}`)
    }

    return true
}

export default sendGenericWebhook
