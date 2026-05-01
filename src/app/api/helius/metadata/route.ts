import { getTokenMetadata } from '@/server/api/helius';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get('mint');
  if (!mint) return Response.json({ error: 'mint address required' }, { status: 400 });

  try {
    const metadata = await getTokenMetadata(mint);
    return Response.json(metadata);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
