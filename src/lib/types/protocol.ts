export interface SolanaProtocol {
  id: string;
  name: string;
  slug: string;
  symbol: string;
  tvl: number;
  change_1h: number | null;
  change_1d: number | null;
  change_7d: number | null;
  mcap: number | null;
  category: string;
  chains: string[];
  logo: string | null;
  url: string | null;
  description: string | null;
}

export interface ParsedTransaction {
  signature: string;
  timestamp: number;
  type: string;
  fee: number;
  source: string;
  description: string;
  accountData: { account: string; nativeBalanceChange: number }[];
}

export interface TokenPrice {
  address: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number | null;
  liquidity: number | null;
}