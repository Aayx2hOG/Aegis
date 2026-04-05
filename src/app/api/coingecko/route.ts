import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const coinId = req.nextUrl.searchParams.get('id');
  if (!coinId) return Response.json({ error: 'id required' }, { status: 400 });

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}`);
    if (!res.ok) throw new Error(`Coingecko error ${res.status}`);
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
