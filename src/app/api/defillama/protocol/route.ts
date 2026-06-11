import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return Response.json({ error: 'slug required' }, { status: 400 })

  try {
    const res = await fetch(`https://api.llama.fi/protocol/${encodeURIComponent(slug)}`)
    if (!res.ok) throw new Error(`DefiLlama error ${res.status}`)
    const data = await res.json()
    return Response.json(data)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
