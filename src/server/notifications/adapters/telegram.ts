export async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  })

  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    const desc = json.description || 'Unknown error'
    throw new Error(`Telegram send failed: ${res.status} ${desc}`)
  }

  return true
}

export default sendTelegramMessage
