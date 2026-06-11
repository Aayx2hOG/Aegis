import { getTokenMetadata } from '@/server/api/helius'
import { getEvmTokenMetadata } from '@/server/api/evm'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get('mint')
  const chain = req.nextUrl.searchParams.get('chain') ?? 'ethereum'
  if (!mint) return Response.json({ error: 'mint address required' }, { status: 400 })

  try {
    if (mint.startsWith('0x')) {
      const evmMeta = await getEvmTokenMetadata(mint, chain)
      // Map to Helius DAS getAsset format for compatibility
      const mapped = {
        id: mint,
        content: {
          metadata: {
            name: evmMeta.name,
            symbol: evmMeta.symbol,
          },
        },
        token_info: {
          decimals: evmMeta.decimals,
          supply: Number(evmMeta.totalSupply) || 0,
        },
      }
      return Response.json(mapped)
    } else {
      const metadata = await getTokenMetadata(mint)
      return Response.json(metadata)
    }
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
