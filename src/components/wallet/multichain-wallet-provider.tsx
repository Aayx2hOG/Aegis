'use client';

import { createContext, ReactNode, useContext, useState, useCallback } from 'react';
import { ChainType, MultiChainWallet, WalletConnection } from '@/lib/chain/types';

export interface MultiChainWalletContextType {
    wallets: MultiChainWallet[];
    activeWallet: MultiChainWallet | null;

    connectWallet: (chainType: ChainType, address: string, displayName?: string) => void;
    disconnectWallet: (chainType: ChainType) => void;
    addWallet: (label: string) => MultiChainWallet;
    removeWallet: (walletId: string) => void;
    setActiveWallet: (walletId: string) => void;

    getWalletByChain: (chainType: ChainType) => WalletConnection | undefined;
    getConnectedChains: () => ChainType[];
}

const Context = createContext<MultiChainWalletContextType>({} as MultiChainWalletContextType);

export function MultiChainWalletProvider({ children }: { children: ReactNode }) {
    const [wallets, setWallets] = useState<MultiChainWallet[]>([]);
    const [activeWalletId, setActiveWalletId] = useState<string | null>(null);

    const activeWallet = wallets.find((w) => w.id === activeWalletId) || null;

    const connectWallet = useCallback(
        (chainType: ChainType, address: string, displayName?: string) => {
            if (!activeWallet) {
                console.error('No active wallet');
                return;
            }

            setWallets((prev) =>
                prev.map((wallet) => {
                    if (wallet.id !== activeWallet.id) return wallet;

                    const existingConnection = wallet.connections.find((c) => c.chainType === chainType);
                    if (existingConnection) {
                        existingConnection.address = address;
                        existingConnection.connected = true;
                        existingConnection.displayName = displayName;
                        return wallet;
                    }

                    return {
                        ...wallet,
                        connections: [
                            ...wallet.connections,
                            {
                                chainType,
                                address,
                                displayName,
                                connected: true,
                            },
                        ],
                        lastUsed: new Date(),
                    };
                })
            );
        },
        [activeWallet]
    );

    const disconnectWallet = useCallback(
        (chainType: ChainType) => {
            if (!activeWallet) return;

            setWallets((prev) =>
                prev.map((wallet) => {
                    if (wallet.id !== activeWallet.id) return wallet;

                    return {
                        ...wallet,
                        connections: wallet.connections.filter((c) => c.chainType !== chainType),
                    };
                })
            );
        },
        [activeWallet]
    );

    const addWallet = useCallback((label: string): MultiChainWallet => {
        const newWallet: MultiChainWallet = {
            id: `wallet-${Date.now()}`,
            label,
            connections: [],
            createdAt: new Date(),
        };

        setWallets((prev) => [...prev, newWallet]);
        setActiveWalletId(newWallet.id);

        return newWallet;
    }, []);

    const removeWallet = useCallback((walletId: string) => {
        setWallets((prev) => prev.filter((w) => w.id !== walletId));
        if (activeWalletId === walletId) {
            setActiveWalletId(null);
        }
    }, [activeWalletId]);

    const setActiveWallet = useCallback((walletId: string) => {
        if (wallets.find((w) => w.id === walletId)) {
            setActiveWalletId(walletId);
        }
    }, [wallets]);

    const getWalletByChain = useCallback(
        (chainType: ChainType) => {
            return activeWallet?.connections.find((c) => c.chainType === chainType);
        },
        [activeWallet]
    );

    const getConnectedChains = useCallback(() => {
        return activeWallet?.connections.map((c) => c.chainType) || [];
    }, [activeWallet]);

    const value: MultiChainWalletContextType = {
        wallets,
        activeWallet,
        connectWallet,
        disconnectWallet,
        addWallet,
        removeWallet,
        setActiveWallet,
        getWalletByChain,
        getConnectedChains,
    };

    return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useMultiChainWallet() {
    return useContext(Context);
}

export function useWalletByChain(chainType: ChainType) {
    const { getWalletByChain } = useMultiChainWallet();
    return getWalletByChain(chainType);
}
