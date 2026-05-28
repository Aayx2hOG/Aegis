export async function sendDiscordWebhook(url: string, content: string) {
    if (!url) throw new Error('Discord webhook URL is required')

    const body = { content }

    const res = await fetch(url, {
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
