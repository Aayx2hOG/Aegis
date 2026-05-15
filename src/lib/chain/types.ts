// Chain-agnostic types for multichain support

export enum ChainType {
    Solana = 'solana',
    Ethereum = 'ethereum',
    Polygon = 'polygon',
    Arbitrum = 'arbitrum',
    Optimism = 'optimism',
    Cosmos = 'cosmos',
    Base = 'base',
}

export enum ChainEnvironment {
    Mainnet = 'mainnet',
    Testnet = 'testnet',
    Devnet = 'devnet',
    Local = 'local',
}

export interface Chain {
    type: ChainType;
    environment: ChainEnvironment;
    name: string;
    displayName: string;
    rpcEndpoint: string;
    explorerUrl: string;
    iconUrl?: string;
    active?: boolean;
    nativeToken: {
        symbol: string;
        decimals: number;
        priceUsd?: number;
    };
}

export interface WalletConnection {
    chainType: ChainType;
    address: string;
    displayName?: string;
    balance?: {
        native: number;
        usd: number;
    };
    connected: boolean;
}

export interface MultiChainWallet {
    id: string;
    label: string;
    connections: WalletConnection[];
    createdAt: Date;
    lastUsed?: Date;
}

export interface ChainProtocol {
    slug: string;
    name: string;
    chains: ChainType[];
    addresses: Partial<Record<ChainType, string>>; // contract/program address per chain
    kind: 'dex' | 'lending' | 'yield' | 'bridge' | 'other';
}

export interface CrossChainProtocolExposure {
    protocol: ChainProtocol;
    positions: Array<{
        chain: ChainType;
        balance: number;
        usdValue: number;
        tokenSymbol: string;
    }>;
    totalUsdValue: number;
    riskByChain: Record<ChainType, number>;
}
