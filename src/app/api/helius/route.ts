import { getRecentTransactions } from '@/lib/api/helius';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 10);
  if (!address) return Response.json({ error: 'address required' }, { status: 400 });

  try {
    const txns = await getRecentTransactions(address, limit);
    return Response.json(txns);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}