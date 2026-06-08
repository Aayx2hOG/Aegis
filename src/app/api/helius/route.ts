import { getRecentTransactions } from '@/server/api/helius';
import { getEvmRecentTransactions } from '@/server/api/evm';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  const chain = req.nextUrl.searchParams.get('chain') ?? 'ethereum';
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 10);
  if (!address) return Response.json({ error: 'address required' }, { status: 400 });

  try {
    if (address.startsWith('0x')) {
      const txns = await getEvmRecentTransactions(address, chain, limit);
      return Response.json(txns);
    } else {
      const txns = await getRecentTransactions(address, limit);
      return Response.json(txns);
    }
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}