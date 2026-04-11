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
  {
    type: 'function' as const,
    function: {
      name: 'get_jupiter_price',
      description:
        'Fetch current price and confidence for a Solana token via Jupiter Price API v2.',
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
  {
    type: 'function' as const,
    function: {
      name: 'get_token_metadata',
      description:
        'Fetch metadata (symbol, name, supply, decimals) for a Solana token via Helius DAS.',
      parameters: {
        type: 'object',
        properties: {
          mint: {
            type: 'string',
            description: 'Token mint address',
          },
        },
        required: ['mint'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_protocol_metadata',
      description:
        'Fetch detailed protocol metadata (description, website, twitter, logo) from DeFiLlama.',
      parameters: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'DeFiLlama protocol slug',
          },
        },
        required: ['slug'],
      },
    },
  },
];

// Tool executor (server-side only)

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    switch (name) {
      case 'get_protocol_tvl': {
        const slug = input.slug as string;
        const [tvlRes, metaRes] = await Promise.all([
          fetchWithTimeout(`https://api.llama.fi/tvl/${slug}`),
          fetchWithTimeout(`https://api.llama.fi/protocol/${slug}`),
        ]);
        if (!tvlRes.ok) throw new Error(`DeFiLlama TVL error ${tvlRes.status}`);
        if (!metaRes.ok) throw new Error(`DeFiLlama meta error ${metaRes.status}`);
        const currentTvl = (await tvlRes.json()) as number;
        const meta = (await metaRes.json()) as Record<string, unknown>;
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
        const res = await fetchWithTimeout(`${base}/api/helius?address=${address}&limit=5`);
        if (!res.ok) throw new Error(`Helius proxy error ${res.status}`);
        const txs = (await res.json()) as Record<string, unknown>[];
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
        const res = await fetchWithTimeout(`${base}/api/birdeye?address=${address}`);
        if (!res.ok) throw new Error(`Birdeye proxy error ${res.status}`);
        return res.json();
      }

      case 'get_jupiter_price': {
        const address = input.address as string;
        const res = await fetchWithTimeout(`https://api.jup.ag/price/v2?ids=${address}`);
        if (!res.ok) throw new Error(`Jupiter price error ${res.status}`);
        const data = (await res.json()) as Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = (data.data as Record<string, any>)?.[address];
        return result
          ? {
              price: result.price,
              extraInfo: result.extraInfo,
              address,
            }
          : { error: 'Price not found' };
      }

      case 'get_token_metadata': {
        const mint = input.mint as string;
        const res = await fetchWithTimeout(`${base}/api/helius/metadata?mint=${mint}`);
        if (!res.ok) throw new Error(`Helius metadata proxy error ${res.status}`);
        return res.json();
      }

      case 'get_protocol_metadata': {
        const slug = input.slug as string;
        const res = await fetchWithTimeout(`https://api.llama.fi/protocol/${slug}`);
        if (!res.ok) throw new Error(`DeFiLlama meta error ${res.status}`);
        const meta = (await res.json()) as Record<string, unknown>;
        return {
          name: meta.name,
          description: meta.description,
          url: meta.url,
          twitter: meta.twitter,
          logo: meta.logo,
          symbol: meta.symbol,
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: unknown) {
    console.error(`Tool Execution Error [${name}]:`, err);
    if (err instanceof Error && err.name === 'AbortError') {
      return { error: `Timeout: ${name} took too long to respond.` };
    }
    return { error: String(err) };
  }
}
