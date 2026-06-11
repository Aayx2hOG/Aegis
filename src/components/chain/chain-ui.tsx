'use client'

import { ChevronDown, Layers3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ChainType } from '@/lib/chain/types'
import { useMultiChain } from './chain-provider'

const CHAIN_LABELS: Record<ChainType, string> = {
  [ChainType.Solana]: 'Solana',
  [ChainType.Ethereum]: 'Ethereum',
  [ChainType.Polygon]: 'Polygon',
  [ChainType.Arbitrum]: 'Arbitrum',
  [ChainType.Optimism]: 'Optimism',
  [ChainType.Cosmos]: 'Cosmos',
  [ChainType.Base]: 'Base',
}

export function ChainUiSelect() {
  const { activeChain, allChains, setActiveChain } = useMultiChain()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-zinc-900/70 text-zinc-200 hover:bg-zinc-800">
          <Layers3 className="h-4 w-4" />
          <span>{activeChain.displayName}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {allChains.map((chain) => (
          <DropdownMenuItem key={chain.name} onClick={() => setActiveChain(chain)}>
            <span>{chain.displayName}</span>
            <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              {CHAIN_LABELS[chain.type]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
