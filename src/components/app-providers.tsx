'use client'

import { ThemeProvider } from '@/components/theme-provider'
import { ReactQueryProvider } from './react-query-provider'
import { ClusterProvider } from '@/components/cluster/cluster-data-access'
import { SolanaProvider } from '@/components/solana/solana-provider'
import { MultiChainProvider } from '@/components/chain/chain-provider'
import { MultiChainWalletProvider } from '@/components/wallet/multichain-wallet-provider'
import React from 'react'

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ReactQueryProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <MultiChainProvider>
          <MultiChainWalletProvider>
            <ClusterProvider>
              <SolanaProvider>{children}</SolanaProvider>
            </ClusterProvider>
          </MultiChainWalletProvider>
        </MultiChainProvider>
      </ThemeProvider>
    </ReactQueryProvider>
  )
}
