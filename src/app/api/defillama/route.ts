import { ChainType } from '@/lib/chain/types';
import { getProtocolsByChain, getSolanaProtocols } from '@/server/api/defillama';

const CHAIN_TYPES = new Set(Object.values(ChainType));

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chainParam = searchParams.get('chain');
    const chainType = chainParam && CHAIN_TYPES.has(chainParam as ChainType) ? (chainParam as ChainType) : ChainType.Solana;
    const protocols = chainType === ChainType.Solana ? await getSolanaProtocols() : await getProtocolsByChain(chainType);
    return Response.json(protocols);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}