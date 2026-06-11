export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const text = await res.text()

  if (!res.ok) {
    const fallbackMessage = `Request failed with status ${res.status}`
    if (!text) throw new Error(fallbackMessage)

    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        throw new Error(parsed.error)
      }
    } catch {
      // Fall through to the raw response body below.
    }

    throw new Error(text || fallbackMessage)
  }

  if (!text) return undefined as T
  return JSON.parse(text) as T
}
