// Tool schemas — OpenAI / Groq format
import { getTokenPrice } from '@/lib/api/birdeye';
import { getRecentTransactions, getTokenMetadata } from '@/lib/api/helius';
import { getProtocolSlugCandidates, normalizeProtocolSlug } from '@/lib/protocol/slug-resolver';

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickFinite(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = asNumber(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function pickPositive(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = asNumber(value);
    if (parsed != null && parsed > 0) return parsed;
  }
  return null;
}

type TvlPoint = { date?: number; totalLiquidityUSD?: number };

function deriveTvlChanges(meta: Record<string, unknown>): { change1d: number | null; change7d: number | null; source: string } {
  const series = ((meta.chainTvls as Record<string, unknown> | undefined)?.Solana as { tvl?: TvlPoint[] } | undefined)?.tvl;
  const fallback = Array.isArray(meta.tvl) ? (meta.tvl as TvlPoint[]) : undefined;
  const points = (Array.isArray(series) && series.length > 0 ? series : fallback) ?? [];

  if (points.length < 2) {
    return { change1d: null, change7d: null, source: 'none' };
  }

  const latest = asNumber(points[points.length - 1]?.totalLiquidityUSD);
  const prev1d = asNumber(points[points.length - 2]?.totalLiquidityUSD);
  const prev7d = points.length >= 8 ? asNumber(points[points.length - 8]?.totalLiquidityUSD) : null;

  const pct = (current: number | null, previous: number | null) => {
    if (current == null || previous == null || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  return {
    change1d: pct(latest, prev1d),
    change7d: pct(latest, prev7d),
    source: Array.isArray(series) && series.length > 0 ? 'chainTvls.Solana.tvl' : 'tvl',
  };
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

async function getCoinGeckoMarketByContract(mint: string) {
  const url = `https://api.coingecko.com/api/v3/coins/solana/contract/${encodeURIComponent(mint)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`CoinGecko contract market error ${res.status}`);
  const data = (await res.json()) as {
    market_data?: {
      current_price?: { usd?: unknown };
      price_change_percentage_24h?: unknown;
      total_volume?: { usd?: unknown };
      market_cap?: { usd?: unknown };
    };
  };

  const marketData = data.market_data;
  if (!marketData) return null;

  return {
    source: 'coingecko-contract',
    price: asNumber(marketData.current_price?.usd),
    priceChange24h: asNumber(marketData.price_change_percentage_24h),
    volume24h: asNumber(marketData.total_volume?.usd),
    marketCap: asNumber(marketData.market_cap?.usd),
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
          const [priceResult, jupiterResult, txResult, metadataResult, geckoContractResult] = await Promise.allSettled([
            getTokenPrice(mint),
            fetchWithTimeout(`https://api.jup.ag/price/v2?ids=${mint}`),
            getRecentTransactions(mint, 5),
            getTokenMetadata(mint),
            getCoinGeckoMarketByContract(mint),
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

          if (geckoContractResult.status === 'fulfilled' && geckoContractResult.value) {
            marketFallback = geckoContractResult.value;
          }
        }

        const geckoId = String(meta.gecko_id ?? '').trim();
        if (geckoId) {
          const gecko = await Promise.allSettled([getCoinGeckoMarket(geckoId)]);
          if (gecko[0].status === 'fulfilled' && gecko[0].value) {
            const geckoData = gecko[0].value;
            const contractMarket = marketFallback && typeof marketFallback === 'object' && !Array.isArray(marketFallback)
              ? (marketFallback as Record<string, unknown>)
              : {};

            marketFallback = {
              source: contractMarket.source ? `${String(contractMarket.source)}+coingecko` : 'coingecko',
              price: pickPositive(contractMarket.price, geckoData.price),
              priceChange24h: pickFinite(contractMarket.priceChange24h, geckoData.priceChange24h),
              volume24h: pickPositive(contractMarket.volume24h, geckoData.volume24h),
              marketCap: pickPositive(contractMarket.marketCap, geckoData.marketCap),
            };

            if (tokenPrice && typeof tokenPrice === 'object' && !Array.isArray(tokenPrice)) {
              const priceRecord = tokenPrice as Record<string, unknown>;
              const fallbackMarket = marketFallback as Record<string, unknown>;
              tokenPrice = {
                ...priceRecord,
                price: pickPositive(priceRecord.price, fallbackMarket.price),
                priceChange24h: pickFinite(priceRecord.priceChange24h, fallbackMarket.priceChange24h),
                volume24h: pickPositive(priceRecord.volume24h, fallbackMarket.volume24h),
                marketCap: pickPositive(priceRecord.marketCap, meta.mcap, fallbackMarket.marketCap),
                source:
                  priceRecord.source === 'coingecko' || !priceRecord.source
                    ? 'coingecko'
                    : `${String(priceRecord.source)}+market-fallback`,
              };
            }
            if (!mint) {
              tokenPrice = {
                address: null,
                symbol: meta.symbol,
                price: pickPositive(geckoData.price) ?? 0,
                priceChange24h: pickFinite(geckoData.priceChange24h) ?? 0,
                volume24h: pickPositive(geckoData.volume24h),
                marketCap: pickPositive(geckoData.marketCap, meta.mcap),
                liquidity: null,
                source: 'coingecko',
              };
            }
          }
        }

        if (tokenPrice && typeof tokenPrice === 'object' && !Array.isArray(tokenPrice)) {
          const priceRecord = tokenPrice as Record<string, unknown>;
          const fallbackMarket =
            marketFallback && typeof marketFallback === 'object' && !Array.isArray(marketFallback)
              ? (marketFallback as Record<string, unknown>)
              : {};

          tokenPrice = {
            ...priceRecord,
            price: pickPositive(priceRecord.price, fallbackMarket.price) ?? 0,
            priceChange24h: pickFinite(priceRecord.priceChange24h, fallbackMarket.priceChange24h) ?? 0,
            volume24h: pickPositive(priceRecord.volume24h, fallbackMarket.volume24h),
            marketCap: pickPositive(priceRecord.marketCap, meta.mcap, fallbackMarket.marketCap),
          };
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
        const derived = deriveTvlChanges(resolvedMeta);
        const change1d = asNumber(resolvedMeta.change_1d) ?? asNumber(meta.change_1d) ?? derived.change1d;
        const change7d = asNumber(resolvedMeta.change_7d) ?? asNumber(meta.change_7d) ?? derived.change7d;

        return {
          slug,
          name: resolvedMeta.name ?? meta.name,
          tvl: currentTvl,
          change1d,
          change7d,
          changeSource:
            asNumber(resolvedMeta.change_1d) != null || asNumber(meta.change_1d) != null
              ? 'defillama.change_1d'
              : derived.source,
          change7dSource:
            asNumber(resolvedMeta.change_7d) != null || asNumber(meta.change_7d) != null
              ? 'defillama.change_7d'
              : derived.source,
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
