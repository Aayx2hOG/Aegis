// Tool schemas — OpenAI / Groq format

export const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_protocol_tvl',
      description:
        'Fetch TVL, 24 h TVL change, and chain breakdown for a Solana DeFi protocol from DeFiLlama.',
      parameters: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'DeFiLlama protocol slug, e.g. "raydium", "orca", "marinade"',
          },
        },
        required: ['slug'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_recent_transactions',
      description:
        'Fetch the most recent parsed transactions for a Solana address using Helius.',
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Base58 Solana account or program address',
          },
          limit: {
            type: 'number',
            description: 'Number of transactions to return (1-50, default 10)',
          },
        },
        required: ['address'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_token_price',
      description:
        'Fetch the current price, 24 h change, volume, and market cap for a Solana token via Birdeye.',
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Token mint address',
          },
        },
        required: ['address'],
      },
    },
  },
];

// Tool executor (server-side only)

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  switch (name) {
    case 'get_protocol_tvl': {
      const slug = input.slug as string;
      // /tvl/{slug} returns a single number — avoids the huge historical array in /protocol/{slug}
      const [tvlRes, metaRes] = await Promise.all([
        fetch(`https://api.llama.fi/tvl/${slug}`),
        fetch(`https://api.llama.fi/protocol/${slug}`),
      ]);
      if (!tvlRes.ok) throw new Error(`DeFiLlama TVL error ${tvlRes.status}`);
      if (!metaRes.ok) throw new Error(`DeFiLlama meta error ${metaRes.status}`);
      const currentTvl = await tvlRes.json() as number;
      const meta = await metaRes.json() as Record<string, unknown>;
      return {
        slug,
        name: meta.name,
        tvl: currentTvl,
        change1d: meta.change_1d,
        change7d: meta.change_7d,
        chains: (meta.chains as string[])?.slice(0, 3),
        category: meta.category,
      };
    }

    case 'get_recent_transactions': {
      const address = input.address as string;
      const res = await fetch(`${base}/api/helius?address=${address}&limit=5`);
      if (!res.ok) throw new Error(`Helius proxy error ${res.status}`);
      const txs = await res.json() as Record<string, unknown>[];
      // Return only key fields to stay within token limits
      return (Array.isArray(txs) ? txs : []).slice(0, 5).map((tx) => ({
        signature: tx.signature,
        type: tx.type,
        timestamp: tx.timestamp,
        fee: tx.fee,
        source: tx.source,
      }));
    }

    case 'get_token_price': {
      const address = input.address as string;
      const res = await fetch(`${base}/api/birdeye?address=${address}`);
      if (!res.ok) throw new Error(`Birdeye proxy error ${res.status}`);
      return res.json();
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
