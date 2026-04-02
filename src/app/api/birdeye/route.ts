import { getTokenPrice } from '@/lib/api/birdeye';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) return Response.json({ error: 'address required' }, { status: 400 });

  try {
    const price = await getTokenPrice(address);
    return Response.json(price);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}