export async function sendGenericWebhook(url: string, payload: unknown) {
    if (!url) throw new Error('Webhook URL is required')

    const res = await fetch(url, {
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
