import { NotificationChannelType } from '@prisma/client'
import { validateNotificationUrl } from '@/server/notifications/config'

export async function sendDiscordWebhook(url: string, content: string) {
    const safeUrl = validateNotificationUrl(url, NotificationChannelType.DISCORD)

    const body = { content }

    const res = await fetch(safeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Discord webhook failed: ${res.status} ${text}`)
    }

    return true
}

export default sendDiscordWebhook
