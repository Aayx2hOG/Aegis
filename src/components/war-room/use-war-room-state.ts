'use client'

import { useEffect, useMemo, useState } from 'react'
import type { WalletContextState } from '@solana/wallet-adapter-react'
import { useSearchParams } from 'next/navigation'
import { ChainType } from '@/lib/chain/types'
import {
  CHAIN_BY_NATIVE_SYMBOL,
  DEFAULT_MULTICHAIN_POSITIONS,
  MULTICHAIN_SCENARIOS,
  NATIVE_ASSETS_BY_CHAIN,
  type PortfolioInputSource,
} from '@/lib/config/war-room-multichain'
import type {
  ChainPortfolioPosition,
  MultiChainPortfolio,
  ChainScenarioConfig,
  ComparativeSimulationResult,
} from '@/lib/types'
import { fetchAndBuildPositions } from '@/lib/war-room/portfolio-import'
import { useWatchlist } from '@/lib/hooks/use-watchlist'
import { useChainProtocols } from '@/lib/hooks/use-defillama'
import { formatPrice } from '@/lib/war-room/format'
import { EXCLUDED_HOLDING_CATEGORIES, RELEVANT_HOLDING_CATEGORIES } from '@/lib/war-room/holding-categories'

type LocalMitigationAction = {
  action: 'move' | 'liquidate' | 'increase' | 'arbitrage' | 'hedge'
  fromChain?: ChainType | string
  toChain?: ChainType | string
  assetSymbol: string
  protocol?: string
  amount: number
}

export function useWarRoomState(wallet: WalletContextState) {
  const searchParams = useSearchParams()

  const { watchlist } = useWatchlist()
  const [isImportingWatchlist, setIsImportingWatchlist] = useState(false)

  const [multichainPositions, setMultichainPositions] = useState<ChainPortfolioPosition[]>([])
  const [portfolioInputSource, setPortfolioInputSource] = useState<PortfolioInputSource>('empty')
  const [selectedMultichainScenarioIdx, setSelectedMultichainScenarioIdx] = useState(0)

  const [useCustomScenario, setUseCustomScenario] = useState(false)
  const [selectedCustomSeverity, setSelectedCustomSeverity] = useState<'Mild' | 'Moderate' | 'Severe' | null>(null)
  const [customScenario, setCustomScenario] = useState<ChainScenarioConfig>({
    marketShockPct: 20,
    liquidityDropPct: 30,
    protocolExploitSeverity: 10,
    oracleDelayMinutes: 0,
    bridgeOutageDurationMinutes: 0,
    chainsAffected: [
      ChainType.Solana,
      ChainType.Ethereum,
      ChainType.Arbitrum,
      ChainType.Base,
      ChainType.Optimism,
      ChainType.Polygon,
      ChainType.Cosmos,
    ],
  })

  const [multichainResult, setMultichainResult] = useState<ComparativeSimulationResult | null>(null)
  const [multichainLoading, setMultichainLoading] = useState(false)
  const [multichainError, setMultichainError] = useState<string | null>(null)
  const [multichainImportStatus, setMultichainImportStatus] = useState<string | null>(null)
  const [expandedHoldingRows, setExpandedHoldingRows] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    const protocolParam = searchParams.get('protocol')
    if (!protocolParam) return
    const protocolSlug = protocolParam

    let active = true
    async function loadParamProtocol() {
      setMultichainImportStatus(`Resolving contract telemetry for ${protocolSlug.toUpperCase()}...`)
      try {
        const positions = await fetchAndBuildPositions(protocolSlug)
        if (!active) return

        if (positions.length === 0) {
          setMultichainImportStatus(
            `Protocol ${protocolSlug.toUpperCase()} fetched, but it is not deployed on any Aegis-supported networks.`,
          )
          return
        }

        const price = positions[0].usdValue
        setMultichainPositions(positions)
        setPortfolioInputSource('protocol')
        setMultichainImportStatus(
          `Loaded a ${protocolSlug.toUpperCase()} scenario template across ${positions.length} network(s). Unit price: $${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}. Enter your actual balances before treating this as your portfolio.`,
        )
      } catch (err) {
        if (!active) return
        console.error('Failed to load protocol from URL parameter:', err)
        setMultichainImportStatus(`Failed to resolve telemetry for ${protocolSlug}: ${String(err)}`)
      }
    }

    void loadParamProtocol()
    return () => {
      active = false
    }
  }, [searchParams])

  async function handleImportWatchlist() {
    if (!watchlist || watchlist.length === 0) {
      setMultichainImportStatus('Watchlist is empty. Go to Research to add protocols.')
      return
    }

    setIsImportingWatchlist(true)
    setMultichainImportStatus(`Importing ${watchlist.length} protocols from watchlist...`)

    let importedCount = 0
    let failedCount = 0
    const allNewPositions: ChainPortfolioPosition[] = []

    for (const slug of watchlist) {
      setMultichainImportStatus(`Resolving telemetry for watchlisted protocol ${slug.toUpperCase()}...`)
      try {
        const positions = await fetchAndBuildPositions(slug)
        if (positions.length > 0) {
          allNewPositions.push(...positions)
          importedCount++
        } else {
          failedCount++
        }
      } catch (err) {
        console.error(`Failed to resolve watchlist protocol ${slug}:`, err)
        failedCount++
      }
    }

    if (allNewPositions.length > 0) {
      setMultichainPositions((current) => {
        const existing = [...current]
        allNewPositions.forEach((newPos) => {
          const duplicateIndex = existing.findIndex(
            (p) =>
              p.chain === newPos.chain &&
              p.symbol.toUpperCase() === newPos.symbol.toUpperCase() &&
              p.protocol.toLowerCase() === newPos.protocol.toLowerCase(),
          )
          if (duplicateIndex >= 0) {
            existing[duplicateIndex] = newPos
          } else {
            existing.push(newPos)
          }
        })
        return existing
      })
      setPortfolioInputSource('watchlist')
      setMultichainResult(null)
      setMultichainImportStatus(
        `Watchlist import complete. Imported ${importedCount} protocols (${allNewPositions.length} scenario positions total). Enter your actual balances before treating this as your portfolio.${failedCount > 0 ? ` Failed: ${failedCount}.` : ''}`,
      )
    } else {
      setMultichainImportStatus(`Watchlist import failed. Could not resolve any watchlisted protocols.`)
    }
    setIsImportingWatchlist(false)
  }

  function applyLocalMitigation(action: LocalMitigationAction) {
    let changed = false
    setMultichainPositions((current) => {
      return current.map((pos) => {
        const isMatch = pos.symbol.toLowerCase() === action.assetSymbol.toLowerCase() && pos.chain === action.fromChain
        if (isMatch) {
          changed = true
          if (action.action === 'liquidate') {
            const reductionRatio = Math.min(1, action.amount / Math.max(pos.balance, 1))
            return {
              ...pos,
              balance: Math.max(0, pos.balance - action.amount),
              usdValue: Math.max(0, pos.usdValue * (1 - reductionRatio)),
            }
          }
          if (action.action === 'move') {
            return {
              ...pos,
              chain: (action.toChain as ChainType) || pos.chain,
              protocol: action.protocol || pos.protocol,
              volatility: Math.max(5, pos.volatility - 15),
              liquidityScore: Math.min(100, pos.liquidityScore + 10),
            }
          }
          if (action.action === 'increase' || action.action === 'hedge') {
            return {
              ...pos,
              volatility: Math.max(5, pos.volatility - 10),
              liquidityScore: Math.min(100, pos.liquidityScore + 8),
            }
          }
        }
        return pos
      })
    })
    setMultichainResult(null)
    if (action.action === 'arbitrage') {
      setMultichainImportStatus(
        `Arbitrage opportunity noted for ${action.assetSymbol}. No portfolio balance changed because this simulator does not execute trades.`,
      )
    } else {
      setMultichainImportStatus(
        changed
          ? `Applied local ${action.action} adjustment for ${action.assetSymbol}. Re-run the simulation to compare risk.`
          : `No matching ${action.assetSymbol} position found on ${action.fromChain ?? 'the selected source chain'}.`,
      )
    }
  }

  const [newPosForm, setNewPosForm] = useState<{
    chain: ChainType
    kind: ChainPortfolioPosition['kind']
    symbol: string
    protocol: string
    usdValue: number
    balance: number
    volatility: number
    liquidityScore: number
  }>({
    chain: ChainType.Solana,
    kind: 'token',
    symbol: NATIVE_ASSETS_BY_CHAIN[ChainType.Solana].symbol,
    protocol: '',
    usdValue: 0,
    balance: 0,
    volatility: 50,
    liquidityScore: 80,
  })
  const [newPosUnitPrice, setNewPosUnitPrice] = useState(NATIVE_ASSETS_BY_CHAIN[ChainType.Solana].priceUsd)
  const [newPosPriceStatus, setNewPosPriceStatus] = useState(
    'Select a protocol to resolve live pricing, or enter USD value manually.',
  )
  const { data: customChainProtocols = [], isLoading: customProtocolsLoading } = useChainProtocols(newPosForm.chain)

  const nativeSymbolOptions = useMemo(() => Object.keys(CHAIN_BY_NATIVE_SYMBOL), [])
  const customProtocolOptions = useMemo(
    () =>
      customChainProtocols
        .map((protocol) => ({
          slug: protocol.slug,
          label: protocol.name || protocol.slug,
          category: protocol.category ?? 'Protocol',
          tvl: protocol.tvl ?? 0,
        }))
        .filter((protocol) => protocol.slug)
        .filter((protocol) => {
          const category = protocol.category.trim()
          if (EXCLUDED_HOLDING_CATEGORIES.has(category)) return false
          return RELEVANT_HOLDING_CATEGORIES.has(category) || category === 'Protocol' || category === 'Uncategorized'
        })
        .sort((left, right) => right.tvl - left.tvl),
    [customChainProtocols],
  )
  const selectedProtocolOption = useMemo(
    () => customProtocolOptions.find((protocol) => protocol.slug === newPosForm.protocol),
    [customProtocolOptions, newPosForm.protocol],
  )
  const activeScenario = useMemo(
    () => (useCustomScenario ? customScenario : MULTICHAIN_SCENARIOS[selectedMultichainScenarioIdx]),
    [customScenario, selectedMultichainScenarioIdx, useCustomScenario],
  )
  const portfolioInsights = useMemo(() => {
    const totalValue = multichainPositions.reduce((acc, position) => acc + position.usdValue, 0)
    const chainTotals = multichainPositions.reduce<Partial<Record<ChainType, number>>>((acc, position) => {
      acc[position.chain] = (acc[position.chain] ?? 0) + position.usdValue
      return acc
    }, {})
    const topChain = Object.entries(chainTotals).sort(([, left], [, right]) => right - left)[0]
    const largestPosition = [...multichainPositions].sort((left, right) => right.usdValue - left.usdValue)[0]
    const concentrationPct = totalValue > 0 && largestPosition ? (largestPosition.usdValue / totalValue) * 100 : 0
    const scenarioSeverity = Math.round(
      (activeScenario.marketShockPct +
        activeScenario.liquidityDropPct +
        activeScenario.protocolExploitSeverity +
        Math.min(activeScenario.oracleDelayMinutes, 120) / 1.2 +
        Math.min(activeScenario.bridgeOutageDurationMinutes ?? 0, 1440) / 14.4) /
        5,
    )

    return {
      totalValue,
      chainCount: Object.keys(chainTotals).length,
      protocolCount: new Set(multichainPositions.map((position) => position.protocol)).size,
      topChain: topChain ? (topChain[0] as ChainType) : null,
      topChainValue: topChain?.[1] ?? 0,
      largestPosition,
      concentrationPct,
      scenarioSeverity,
    }
  }, [activeScenario, multichainPositions])
  const groupedHoldings = useMemo(() => {
    const groups = new Map<
      ChainType,
      {
        chain: ChainType
        totalValue: number
        positions: Array<ChainPortfolioPosition & { originalIndex: number }>
      }
    >()

    multichainPositions.forEach((position, originalIndex) => {
      const group = groups.get(position.chain) ?? { chain: position.chain, totalValue: 0, positions: [] }
      group.totalValue += position.usdValue
      group.positions.push({ ...position, originalIndex })
      groups.set(position.chain, group)
    })

    return Array.from(groups.values()).sort((left, right) => right.totalValue - left.totalValue)
  }, [multichainPositions])

  function updateCustomScenario(values: Partial<ChainScenarioConfig>, source: 'preset' | 'manual' = 'manual') {
    if (source === 'manual') setSelectedCustomSeverity(null)
    setCustomScenario((current) => ({ ...current, ...values }))
  }

  useEffect(() => {
    const nativeAsset = NATIVE_ASSETS_BY_CHAIN[newPosForm.chain]
    if (newPosForm.symbol !== nativeAsset.symbol) {
      setNewPosForm((current) => ({ ...current, symbol: nativeAsset.symbol }))
    }
    setNewPosUnitPrice(nativeAsset.priceUsd)
    setNewPosPriceStatus(
      `No default ${nativeAsset.symbol} price is assumed. Select a protocol to resolve live pricing, or enter USD value manually.`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPosForm.chain])

  useEffect(() => {
    if (customProtocolOptions.length === 0) return
    const currentStillAvailable = customProtocolOptions.some((protocol) => protocol.slug === newPosForm.protocol)
    if (!currentStillAvailable) {
      setNewPosForm((current) => ({ ...current, protocol: customProtocolOptions[0].slug }))
    }
  }, [customProtocolOptions, newPosForm.protocol])

  useEffect(() => {
    setNewPosForm((current) => ({
      ...current,
      usdValue: Math.round(current.balance * newPosUnitPrice * 100) / 100,
    }))
  }, [newPosUnitPrice])

  useEffect(() => {
    if (!newPosForm.protocol) return

    let active = true
    async function resolveSelectedProtocolPrice() {
      const nativeAsset = NATIVE_ASSETS_BY_CHAIN[newPosForm.chain]
      setNewPosPriceStatus(`Resolving ${newPosForm.protocol} price for ${newPosForm.chain}...`)

      try {
        const positions = await fetchAndBuildPositions(newPosForm.protocol)
        if (!active) return
        const chainPosition = positions.find((position) => position.chain === newPosForm.chain)
        const unitPrice =
          chainPosition && chainPosition.balance > 0 ? chainPosition.usdValue / chainPosition.balance : 0

        setNewPosUnitPrice(unitPrice)
        setNewPosForm((current) => ({
          ...current,
          kind: chainPosition?.kind ?? current.kind,
          volatility: chainPosition?.volatility ?? current.volatility,
          liquidityScore: chainPosition?.liquidityScore ?? current.liquidityScore,
          usdValue: unitPrice > 0 ? Math.round(current.balance * unitPrice * 100) / 100 : current.usdValue,
        }))
        setNewPosPriceStatus(
          chainPosition
            ? `${selectedProtocolOption?.label ?? newPosForm.protocol} unit price resolved at ${formatPrice(unitPrice)}.`
            : `No chain-specific live price found for ${nativeAsset.symbol}. Enter USD value manually.`,
        )
      } catch (err) {
        if (!active) return
        setNewPosUnitPrice(0)
        setNewPosPriceStatus(`Price lookup failed for ${nativeAsset.symbol}. Enter USD value manually.`)
        console.error('Failed to resolve selected protocol price:', err)
      }
    }

    void resolveSelectedProtocolPrice()
    return () => {
      active = false
    }
  }, [newPosForm.chain, newPosForm.protocol, selectedProtocolOption?.label])

  function updateMultichainPositionField(index: number, field: keyof ChainPortfolioPosition, value: number) {
    setMultichainPositions((current) => current.map((pos, idx) => (idx === index ? { ...pos, [field]: value } : pos)))
    setMultichainResult(null)
  }

  function updateMultichainPositionBalance(index: number, value: number) {
    setMultichainPositions((current) =>
      current.map((pos, idx) => {
        if (idx !== index) return pos
        const unitPrice = pos.balance > 0 ? pos.usdValue / pos.balance : 0
        return {
          ...pos,
          balance: value,
          usdValue: unitPrice > 0 ? Math.round(value * unitPrice * 100) / 100 : pos.usdValue,
        }
      }),
    )
    setMultichainResult(null)
  }

  function removeMultichainPosition(index: number) {
    setMultichainPositions((current) => current.filter((_, idx) => idx !== index))
    setExpandedHoldingRows((current) => {
      const next = new Set<number>()
      current.forEach((rowIndex) => {
        if (rowIndex < index) next.add(rowIndex)
        if (rowIndex > index) next.add(rowIndex - 1)
      })
      return next
    })
    setMultichainResult(null)
  }

  function toggleHoldingAdvanced(index: number) {
    setExpandedHoldingRows((current) => {
      const next = new Set(current)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function addMultichainPosition() {
    if (!newPosForm.symbol.trim() || !newPosForm.protocol.trim() || newPosForm.balance <= 0) {
      setMultichainImportStatus('Select a symbol, choose a protocol, and enter a balance greater than 0.')
      return
    }

    const derivedUsdValue = Math.round(newPosForm.balance * newPosUnitPrice * 100) / 100
    const newPos: ChainPortfolioPosition = {
      chain: newPosForm.chain,
      kind: newPosForm.kind,
      symbol: newPosForm.symbol.trim().toUpperCase(),
      protocol: newPosForm.protocol.trim().toLowerCase(),
      usdValue: derivedUsdValue,
      balance: newPosForm.balance,
      volatility: newPosForm.volatility,
      liquidityScore: newPosForm.liquidityScore,
    }

    setMultichainPositions((current) => [...current, newPos])
    setPortfolioInputSource('manual')
    setMultichainResult(null)
    setMultichainImportStatus(`Added ${newPos.symbol} on ${newPos.chain}.`)
    setNewPosForm({
      chain: ChainType.Solana,
      kind: 'token',
      symbol: NATIVE_ASSETS_BY_CHAIN[ChainType.Solana].symbol,
      protocol: '',
      usdValue: 0,
      balance: 0,
      volatility: 50,
      liquidityScore: 80,
    })
  }

  async function runMultichainSimulation() {
    setMultichainLoading(true)
    setMultichainError(null)

    const activeScenario = useCustomScenario ? customScenario : MULTICHAIN_SCENARIOS[selectedMultichainScenarioIdx]
    const portfolioPayload: MultiChainPortfolio = {
      walletAddress: wallet.publicKey?.toString() || 'guest-multichain-wallet',
      positions: multichainPositions,
      totalUsdValue: multichainPositions.reduce((acc, p) => acc + p.usdValue, 0),
      chains: Array.from(new Set(multichainPositions.map((p) => p.chain))),
      lastUpdated: new Date(),
    }

    try {
      const res = await fetch('/api/war-room/simulate-comparative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio: portfolioPayload, scenario: activeScenario }),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const data: ComparativeSimulationResult = await res.json()
      setMultichainResult(data)
    } catch (err) {
      setMultichainError(String(err))
    } finally {
      setMultichainLoading(false)
    }
  }

  function loadDemoPortfolio() {
    setMultichainPositions(DEFAULT_MULTICHAIN_POSITIONS)
    setPortfolioInputSource('demo')
    setMultichainResult(null)
    setMultichainImportStatus('Loaded demo portfolio. These are sample simulation inputs, not wallet holdings.')
  }

  return {
    watchlist,
    isImportingWatchlist,
    multichainPositions,
    portfolioInputSource,
    selectedMultichainScenarioIdx,
    setSelectedMultichainScenarioIdx,
    useCustomScenario,
    setUseCustomScenario,
    selectedCustomSeverity,
    setSelectedCustomSeverity,
    customScenario,
    multichainResult,
    multichainLoading,
    multichainError,
    multichainImportStatus,
    expandedHoldingRows,
    newPosForm,
    setNewPosForm,
    newPosUnitPrice,
    newPosPriceStatus,
    customProtocolsLoading,
    nativeSymbolOptions,
    customProtocolOptions,
    portfolioInsights,
    groupedHoldings,
    handleImportWatchlist,
    applyLocalMitigation,
    updateCustomScenario,
    updateMultichainPositionField,
    updateMultichainPositionBalance,
    removeMultichainPosition,
    toggleHoldingAdvanced,
    addMultichainPosition,
    runMultichainSimulation,
    loadDemoPortfolio,
  }
}
