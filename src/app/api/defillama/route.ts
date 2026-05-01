import { getSolanaProtocols } from '@/server/api/defillama';

export async function GET() {
  try {
    const protocols = await getSolanaProtocols();
    return Response.json(protocols);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}