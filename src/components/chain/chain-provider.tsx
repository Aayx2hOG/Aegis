'use client';

import { createContext, ReactNode, useContext } from 'react';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { Chain, ChainType, ChainEnvironment } from '@/lib/chain/types';

// Default chains configuration
export const defaultChains: Chain[] = [
    {
        type: ChainType.Solana,
        environment: ChainEnvironment.Devnet,
        name: 'solana-devnet',
        displayName: 'Solana Devnet',
        rpcEndpoint: 'https://api.devnet.solana.com',
        explorerUrl: 'https://explorer.solana.com',
        nativeToken: { symbol: 'SOL', decimals: 9, priceUsd: 150 },
    },
    {
        type: ChainType.Solana,
        environment: ChainEnvironment.Mainnet,
        name: 'solana-mainnet',
        displayName: 'Solana Mainnet',
        rpcEndpoint: 'https://api.mainnet-beta.solana.com',
        explorerUrl: 'https://explorer.solana.com',
        nativeToken: { symbol: 'SOL', decimals: 9, priceUsd: 150 },
    },
    {
        type: ChainType.Ethereum,
        environment: ChainEnvironment.Mainnet,
        name: 'ethereum-mainnet',
        displayName: 'Ethereum Mainnet',
        rpcEndpoint: process.env.NEXT_PUBLIC_ETHEREUM_RPC || 'https://eth.drpc.org',
        explorerUrl: 'https://etherscan.io',
        nativeToken: { symbol: 'ETH', decimals: 18, priceUsd: 3500 },
    },
    {
        type: ChainType.Arbitrum,
        environment: ChainEnvironment.Mainnet,
        name: 'arbitrum-mainnet',
        displayName: 'Arbitrum',
        rpcEndpoint: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
        explorerUrl: 'https://arbiscan.io',
        nativeToken: { symbol: 'ETH', decimals: 18, priceUsd: 3500 },
    },
    {
        type: ChainType.Optimism,
        environment: ChainEnvironment.Mainnet,
        name: 'optimism-mainnet',
        displayName: 'Optimism',
        rpcEndpoint: process.env.NEXT_PUBLIC_OPTIMISM_RPC || 'https://mainnet.optimism.io',
        explorerUrl: 'https://optimistic.etherscan.io',
        nativeToken: { symbol: 'ETH', decimals: 18, priceUsd: 3500 },
    },
];

const activeChainAtom = atomWithStorage<Chain>('multichain-active', defaultChains[0]);
const chainsAtom = atomWithStorage<Chain[]>('multichain-chains', defaultChains);
const activeChainConnectionsAtom = atomWithStorage<ChainType[]>('multichain-active-connections', [ChainType.Solana]);

export interface ChainProviderContext {
    activeChain: Chain;
    allChains: Chain[];
    activeChainConnections: ChainType[];

    setActiveChain: (chain: Chain) => void;
    toggleChainConnection: (chainType: ChainType) => void;
    addChain: (chain: Chain) => void;
    removeChain: (chainName: string) => void;

    getChainsByType: (type: ChainType) => Chain[];
    getExplorerUrl: (path: string) => string;
}

const Context = createContext<ChainProviderContext>({} as ChainProviderContext);

export function MultiChainProvider({ children }: { children: ReactNode }) {
    const activeChain = useAtomValue(activeChainAtom);
    const chains = useAtomValue(chainsAtom);
    const activeConnections = useAtomValue(activeChainConnectionsAtom);

    const setActiveChain = useSetAtom(activeChainAtom);
    const setChains = useSetAtom(chainsAtom);
    const setActiveConnections = useSetAtom(activeChainConnectionsAtom);

    const value: ChainProviderContext = {
        activeChain,
        allChains: chains.sort((a, b) => {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.environment.localeCompare(b.environment);
        }),
        activeChainConnections: activeConnections,

        setActiveChain: (chain) => setActiveChain(chain),

        toggleChainConnection: (chainType) => {
            setActiveConnections((prev) =>
                prev.includes(chainType)
                    ? prev.filter((c) => c !== chainType)
                    : [...prev, chainType]
            );
        },

        addChain: (chain) => {
            const exists = chains.some((c) => c.name === chain.name);
            if (!exists) {
                setChains([...chains, chain]);
            }
        },

        removeChain: (chainName) => {
            setChains(chains.filter((c) => c.name !== chainName));
        },

        getChainsByType: (type) => chains.filter((c) => c.type === type),

        getExplorerUrl: (path) => `${activeChain.explorerUrl}/${path}`,
    };

    return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useMultiChain() {
    return useContext(Context);
}

export function useChain(chainType: ChainType, environment?: ChainEnvironment) {
    const { allChains } = useMultiChain();
    return allChains.find(
        (c) => c.type === chainType && (!environment || c.environment === environment)
    );
}
