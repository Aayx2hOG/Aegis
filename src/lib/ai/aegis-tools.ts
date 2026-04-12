// Tool schemas — OpenAI / Groq format
import { getTokenPrice } from '@/lib/api/birdeye';
import { getRecentTransactions, getTokenMetadata } from '@/lib/api/helius';
import { getProtocolSlugCandidates, normalizeProtocolSlug } from '@/lib/protocol/slug-resolver';

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function getCoinGeckoMarket(geckoId: string) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    geckoId
  )}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`CoinGecko market error ${res.status}`);
  const data = (await res.json()) as Record<string, Record<string, unknown>>;
  const entry = data[geckoId];
  if (!entry) return null;
  return {
    source: 'coingecko',
    price: asNumber(entry.usd),
    priceChange24h: asNumber(entry.usd_24h_change),
    volume24h: asNumber(entry.usd_24h_vol),
    marketCap: asNumber(entry.usd_market_cap),
  };
}

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
      name: 'get_protocol_snapshot',
      description:
        'Fetch a protocol snapshot from DeFiLlama and derive token mint-level market and activity context for Solana protocols.',
      parameters: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'DeFiLlama protocol slug, e.g. "raydium", "orca", "jito"',
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

async function fetchFirstAvailableProtocolBySlug(rawSlug: string): Promise<{ slug: string; meta: Record<string, unknown> }> {
  const candidates = getProtocolSlugCandidates(rawSlug);

  for (const candidate of candidates) {
    const res = await fetchWithTimeout(`https://api.llama.fi/protocol/${candidate}`);
    if (!res.ok) continue;
    const meta = (await res.json()) as Record<string, unknown>;
    return { slug: candidate, meta };
  }

  throw new Error(`DeFiLlama protocol not found for slug: ${rawSlug}`);
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  try {
    switch (name) {
      case 'get_protocol_snapshot': {
        const inputSlug = normalizeProtocolSlug(String(input.slug ?? ''));
        const { slug, meta } = await fetchFirstAvailableProtocolBySlug(inputSlug);
        const addressField = String(meta.address ?? '');
        const mint = addressField.startsWith('solana:') ? addressField.replace('solana:', '') : null;

        let tokenPrice: unknown = null;
        let recentTransactions: unknown = null;
        let tokenMetadata: unknown = null;
        let marketFallback: unknown = null;
        let txFallback: unknown = null;

        if (mint) {
          const [priceResult, jupiterResult, txResult, metadataResult] = await Promise.allSettled([
            getTokenPrice(mint),
            fetchWithTimeout(`https://api.jup.ag/price/v2?ids=${mint}`),
            getRecentTransactions(mint, 5),
            getTokenMetadata(mint),
          ]);

          tokenPrice = priceResult.status === 'fulfilled' ? priceResult.value : { error: String(priceResult.reason) };

          if (priceResult.status === 'rejected' && jupiterResult.status === 'fulfilled') {
            try {
              const jupData = (await jupiterResult.value.json()) as {
                data?: Record<string, { price?: number; extraInfo?: unknown }>;
              };
              const jup = jupData.data?.[mint];
              if (jup?.price != null) {
                marketFallback = {
                  source: 'jupiter',
                  price: jup.price,
                  priceChange24h: null,
                  volume24h: null,
                  marketCap: null,
                  extraInfo: jup.extraInfo,
                };
              }
            } catch {
              // keep fallback null
            }
          }

          recentTransactions =
            txResult.status === 'fulfilled'
              ? txResult.value.slice(0, 5).map((tx) => ({
                signature: tx.signature,
                type: tx.type,
                timestamp: tx.timestamp,
                fee: tx.fee,
                source: tx.source,
              }))
              : { error: String(txResult.reason) };
          tokenMetadata = metadataResult.status === 'fulfilled' ? metadataResult.value : { error: String(metadataResult.reason) };
        }

        const geckoId = String(meta.gecko_id ?? '').trim();
        if (geckoId) {
          const gecko = await Promise.allSettled([getCoinGeckoMarket(geckoId)]);
          if (gecko[0].status === 'fulfilled' && gecko[0].value) {
            const geckoData = gecko[0].value;
            if (!marketFallback) {
              marketFallback = geckoData;
            }
            if (!mint) {
              tokenPrice = {
                address: null,
                symbol: meta.symbol,
                price: geckoData.price,
                priceChange24h: geckoData.priceChange24h,
                volume24h: geckoData.volume24h,
                marketCap: geckoData.marketCap,
                liquidity: null,
                source: 'coingecko',
              };
            }
          }
        }

        const chainTvls = (meta.chainTvls as Record<string, unknown> | undefined) ?? {};
        const solanaSeries = (chainTvls.Solana as { tvl?: Array<{ date: number; totalLiquidityUSD: number }> } | undefined)?.tvl ?? [];
        if (solanaSeries.length >= 2) {
          const latest = solanaSeries[solanaSeries.length - 1];
          const previous = solanaSeries[solanaSeries.length - 2];
          const delta = latest.totalLiquidityUSD - previous.totalLiquidityUSD;
          txFallback = {
            source: 'defillama-tvl-trend',
            latestDate: latest.date,
            latestTvl: latest.totalLiquidityUSD,
            previousTvl: previous.totalLiquidityUSD,
            delta1d: delta,
            delta1dPct: previous.totalLiquidityUSD ? (delta / previous.totalLiquidityUSD) * 100 : null,
          };
        }

        return {
          slug,
          name: meta.name,
          symbol: meta.symbol,
          description: meta.description,
          twitter: meta.twitter,
          url: meta.url,
          logo: meta.logo,
          address: meta.address,
          mint,
          geckoId: meta.gecko_id,
          tokenPrice,
          marketFallback,
          recentTransactions,
          txFallback,
          tokenMetadata,
        };
      }

      case 'get_protocol_tvl': {
        const inputSlug = normalizeProtocolSlug(String(input.slug ?? ''));
        const { slug, meta } = await fetchFirstAvailableProtocolBySlug(inputSlug);
        const [tvlRes, metaRes] = await Promise.all([
          fetchWithTimeout(`https://api.llama.fi/tvl/${slug}`),
          fetchWithTimeout(`https://api.llama.fi/protocol/${slug}`),
        ]);
        if (!tvlRes.ok) throw new Error(`DeFiLlama TVL error ${tvlRes.status}`);
        if (!metaRes.ok) throw new Error(`DeFiLlama meta error ${metaRes.status}`);
        const currentTvl = (await tvlRes.json()) as number;
        const resolvedMeta = (await metaRes.json()) as Record<string, unknown>;
        return {
          slug,
          name: resolvedMeta.name ?? meta.name,
          tvl: currentTvl,
          change1d: resolvedMeta.change_1d ?? meta.change_1d,
          change7d: resolvedMeta.change_7d ?? meta.change_7d,
          chains: ((resolvedMeta.chains as string[]) ?? (meta.chains as string[]))?.slice(0, 3),
          category: resolvedMeta.category ?? meta.category,
        };
      }

      case 'get_recent_transactions': {
        const address = input.address as string;
        const txs = await getRecentTransactions(address, 5);
        return txs.slice(0, 5).map((tx) => ({
          signature: tx.signature,
          type: tx.type,
          timestamp: tx.timestamp,
          fee: tx.fee,
          source: tx.source,
        }));
      }

      case 'get_token_price': {
        const address = input.address as string;
        return getTokenPrice(address);
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
        return getTokenMetadata(mint);
      }

      case 'get_protocol_metadata': {
        const slug = normalizeProtocolSlug(String(input.slug ?? ''));
        const res = await fetchWithTimeout(`https://api.llama.fi/protocol/${slug}`);
        if (!res.ok) {
          const resolved = await fetchFirstAvailableProtocolBySlug(slug);
          return {
            name: resolved.meta.name,
            description: resolved.meta.description,
            url: resolved.meta.url,
            twitter: resolved.meta.twitter,
            logo: resolved.meta.logo,
            symbol: resolved.meta.symbol,
          };
        }
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
