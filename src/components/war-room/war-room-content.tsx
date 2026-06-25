'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WarRoomOverview } from '@/components/war-room/war-room-overview'
import { WarRoomSimulationResults } from '@/components/war-room/war-room-simulation-results'
import { WarRoomScenarioPanel } from '@/components/war-room/war-room-scenario-panel'
import { fetchAndBuildPositions } from '@/lib/war-room/portfolio-import'
import { useWatchlist } from '@/lib/hooks/use-watchlist'
import { useChainProtocols } from '@/lib/hooks/use-defillama'
import { useAtom } from 'jotai'
import { beginnerModeAtom } from '@/lib/store/research-store'
import { DeFiTooltip } from '@/components/ui/defi-helper'
import { formatCurrency, formatPrice } from '@/lib/war-room/format'
import { EXCLUDED_HOLDING_CATEGORIES, RELEVANT_HOLDING_CATEGORIES } from '@/lib/war-room/holding-categories'

type LocalMitigationAction = {
  action: 'move' | 'liquidate' | 'increase' | 'arbitrage' | 'hedge'
  fromChain?: ChainType | string
  toChain?: ChainType | string
  assetSymbol: string
  protocol?: string
  amount: number
}

export function WarRoomContent() {
  const wallet = useWallet()
  const [simpleMode, setSimpleMode] = useAtom(beginnerModeAtom)
  const searchParams = useSearchParams()

  // Watchlist
  const { watchlist } = useWatchlist()
  const [isImportingWatchlist, setIsImportingWatchlist] = useState(false)

  // Multichain states
  const [multichainPositions, setMultichainPositions] = useState<ChainPortfolioPosition[]>([])
  const [portfolioInputSource, setPortfolioInputSource] = useState<PortfolioInputSource>('empty')
  const [selectedMultichainScenarioIdx, setSelectedMultichainScenarioIdx] = useState(0)

  // Custom Scenario state
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

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-6 px-2 cyber-grid">
      <div className="space-y-8 animate-in fade-in duration-500 text-left">
        <WarRoomOverview
          simpleMode={simpleMode}
          connectedWalletAddress={wallet.publicKey?.toBase58() ?? null}
          portfolioInputSource={portfolioInputSource}
          portfolioInsights={portfolioInsights}
          useCustomScenario={useCustomScenario}
          selectedScenarioIndex={selectedMultichainScenarioIdx}
        />

        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel: Portfolio Holdings mixing board */}
          <div className="lg:col-span-3 rounded-xl bg-zinc-950/50 border border-cyan-500/10 p-5 backdrop-blur-md space-y-5 corner-decor shadow-2xl">
            <div className="flex flex-wrap items-center justify-between border-b border-cyan-500/10 pb-3 gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-orbitron font-black text-sm uppercase tracking-wider text-white">
                  Portfolio holdings
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isImportingWatchlist}
                  onClick={handleImportWatchlist}
                  className="h-6 text-[9px] font-mono text-cyan-400 border-cyan-500/20 bg-cyan-950/20 hover:bg-cyan-500/15 rounded-xs px-2 py-0.5 gap-1"
                >
                  {isImportingWatchlist ? 'Importing...' : `Import Watchlist (${watchlist.length})`}
                </Button>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-400">
                Total value: {formatCurrency(multichainPositions.reduce((acc, p) => acc + p.usdValue, 0))}
              </span>
            </div>
            <p className="rounded-xs border border-zinc-850 bg-zinc-950/50 px-3 py-2 text-[10px] font-mono leading-relaxed text-zinc-400">
              Source: {portfolioInputSource === 'empty' ? 'no holdings loaded' : portfolioInputSource}. Values here are
              simulation inputs. They are not imported wallet balances unless you enter them yourself.
            </p>

            {multichainPositions.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xs border border-dashed border-zinc-800 bg-zinc-950/20 font-mono text-zinc-550">
                <p className="text-xs font-semibold">No holdings added yet.</p>
                <p className="text-[10px] mt-1">
                  Add your real balances manually, import watchlist scenario rows, or load the demo portfolio for
                  exploration.
                </p>
              </div>
            ) : (
              <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1 text-xs">
                {groupedHoldings.map((group) => (
                  <div key={group.chain} className="rounded-lg border border-zinc-900 bg-zinc-950/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 px-3.5 py-2.5">
                      <div>
                        <p className="text-sm font-semibold capitalize text-white">{group.chain}</p>
                        <p className="text-[10px] text-zinc-500">
                          {group.positions.length} holding{group.positions.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <p className="font-mono text-xs font-bold text-cyan-300">{formatCurrency(group.totalValue)}</p>
                    </div>

                    <div className="divide-y divide-zinc-900">
                      {group.positions.map((pos) => {
                        const isAdvancedOpen = expandedHoldingRows.has(pos.originalIndex)

                        return (
                          <div key={`${pos.chain}-${pos.symbol}-${pos.originalIndex}`} className="p-3.5">
                            <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-12">
                              <div className="md:col-span-4 text-left">
                                <p className="text-sm font-semibold text-white">{pos.symbol}</p>
                                <p className="mt-1 text-[10px] uppercase tracking-wider text-cyan-500">
                                  {pos.protocol} • {pos.kind}
                                </p>
                              </div>
                              <div className="md:col-span-2 text-left">
                                <label className="mb-1 block text-[10px] font-medium text-zinc-500">Balance</label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={pos.balance}
                                  onChange={(e) =>
                                    updateMultichainPositionBalance(pos.originalIndex, Number(e.target.value))
                                  }
                                  className="h-8 border-zinc-900 bg-zinc-950 px-2 text-xs text-white"
                                />
                              </div>
                              <div className="md:col-span-2 text-left">
                                <label className="mb-1 block text-[10px] font-medium text-zinc-500">USD value</label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={pos.usdValue}
                                  onChange={(e) =>
                                    updateMultichainPositionField(pos.originalIndex, 'usdValue', Number(e.target.value))
                                  }
                                  className="h-8 border-zinc-900 bg-zinc-950 px-2 text-xs text-white"
                                />
                              </div>
                              <div className="flex items-center justify-end gap-2 md:col-span-4">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleHoldingAdvanced(pos.originalIndex)}
                                  className="h-8 rounded-xs border-zinc-800 bg-zinc-950 px-3 text-[10px] font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                >
                                  {isAdvancedOpen ? 'Hide Advanced' : 'Advanced'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMultichainPosition(pos.originalIndex)}
                                  className="h-8 w-8 rounded-xs p-0 text-rose-400 hover:bg-rose-500/10 hover:text-white"
                                >
                                  x
                                </Button>
                              </div>
                            </div>

                            {isAdvancedOpen && (
                              <div className="mt-3 grid gap-4 rounded-md border border-zinc-900 bg-zinc-950/60 p-3 sm:grid-cols-2">
                                <div className="text-left">
                                  <label className="mb-2 block text-[10px] font-medium text-zinc-500">
                                    {simpleMode ? (
                                      <DeFiTooltip term="Volatility">Volatility</DeFiTooltip>
                                    ) : (
                                      'Volatility'
                                    )}
                                  </label>
                                  <input
                                    type="range"
                                    min={0}
                                    max={150}
                                    value={pos.volatility}
                                    onChange={(e) =>
                                      updateMultichainPositionField(
                                        pos.originalIndex,
                                        'volatility',
                                        Number(e.target.value),
                                      )
                                    }
                                    className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-cyan-500"
                                  />
                                  <span className="mt-1 block text-[10px] font-bold text-cyan-400">
                                    {pos.volatility}% volatility
                                  </span>
                                </div>
                                <div className="text-left">
                                  <label className="mb-2 block text-[10px] font-medium text-zinc-500">
                                    {simpleMode ? (
                                      <DeFiTooltip term="Liquidity Score">Liquidity</DeFiTooltip>
                                    ) : (
                                      'Liquidity'
                                    )}
                                  </label>
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={pos.liquidityScore}
                                    onChange={(e) =>
                                      updateMultichainPositionField(
                                        pos.originalIndex,
                                        'liquidityScore',
                                        Number(e.target.value),
                                      )
                                    }
                                    className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-cyan-500"
                                  />
                                  <span className="mt-1 block text-[10px] font-bold text-cyan-400">
                                    {pos.liquidityScore} liquidity score
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xs border border-zinc-850 bg-zinc-950/20 p-4 space-y-4">
              <h3 className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400">Add a holding</h3>
              <div className="grid gap-3 grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-6 text-left text-xs font-mono">
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">Chain</label>
                  <select
                    value={newPosForm.chain}
                    onChange={(e) => {
                      const chain = e.target.value as ChainType
                      setNewPosForm({
                        ...newPosForm,
                        chain,
                        symbol: NATIVE_ASSETS_BY_CHAIN[chain].symbol,
                        protocol: '',
                      })
                    }}
                    className="flex h-9 w-full rounded-xs border border-zinc-850 bg-zinc-950 px-3 py-1 text-xs shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono"
                  >
                    {Object.values(ChainType).map((c) => (
                      <option key={c} value={c} className="bg-zinc-950 text-white font-mono">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">Symbol</label>
                  <select
                    value={newPosForm.symbol}
                    onChange={(e) => {
                      const symbol = e.target.value
                      const preferredChain = CHAIN_BY_NATIVE_SYMBOL[symbol]?.[0] ?? newPosForm.chain
                      setNewPosForm({
                        ...newPosForm,
                        symbol,
                        chain: preferredChain,
                        protocol: '',
                      })
                    }}
                    className="flex h-9 w-full rounded-xs border border-zinc-850 bg-zinc-950 px-3 py-1 text-xs shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono"
                  >
                    {nativeSymbolOptions.map((symbol) => (
                      <option key={symbol} value={symbol} className="bg-zinc-950 text-white font-mono">
                        {symbol}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">Protocol</label>
                  <select
                    value={newPosForm.protocol}
                    onChange={(e) => setNewPosForm({ ...newPosForm, protocol: e.target.value })}
                    disabled={customProtocolsLoading || customProtocolOptions.length === 0}
                    className="flex h-9 w-full rounded-xs border border-zinc-850 bg-zinc-950 px-3 py-1 text-xs shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono disabled:opacity-60"
                  >
                    <option value="" className="bg-zinc-950 text-zinc-400">
                      {customProtocolsLoading
                        ? 'Loading...'
                        : customProtocolOptions.length === 0
                          ? 'No protocols'
                          : 'Select protocol'}
                    </option>
                    {customProtocolOptions.slice(0, 250).map((protocol) => (
                      <option key={protocol.slug} value={protocol.slug} className="bg-zinc-950 text-white font-mono">
                        {protocol.label} ({protocol.category})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">Kind</label>
                  <select
                    value={newPosForm.kind}
                    onChange={(e) =>
                      setNewPosForm({ ...newPosForm, kind: e.target.value as ChainPortfolioPosition['kind'] })
                    }
                    className="flex h-9 w-full rounded-xs border border-zinc-850 bg-zinc-950 px-3 py-1 text-xs shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono"
                  >
                    <option value="token" className="bg-zinc-950 text-white">
                      token
                    </option>
                    <option value="lp" className="bg-zinc-950 text-white">
                      lp
                    </option>
                    <option value="lending" className="bg-zinc-950 text-white">
                      lending
                    </option>
                    <option value="yield" className="bg-zinc-950 text-white">
                      yield
                    </option>
                    <option value="other" className="bg-zinc-950 text-white">
                      other
                    </option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">Balance</label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="100"
                    value={newPosForm.balance || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setNewPosForm({
                        ...newPosForm,
                        balance: val,
                        usdValue:
                          newPosUnitPrice > 0 ? Math.round(val * newPosUnitPrice * 100) / 100 : newPosForm.usdValue,
                      })
                    }}
                    className="h-9 text-xs bg-zinc-950 border-zinc-850 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[8px] uppercase tracking-wider text-zinc-500 block mb-1">USD Value</label>
                  <Input
                    type="number"
                    min={0}
                    value={newPosForm.usdValue || ''}
                    onChange={(e) => setNewPosForm({ ...newPosForm, usdValue: Number(e.target.value) })}
                    className="h-9 text-xs bg-zinc-950 border-zinc-850 font-mono text-cyan-300"
                  />
                </div>
              </div>
              <div className="grid gap-3 rounded-xs border border-cyan-500/10 bg-cyan-950/5 p-3 text-[10px] text-zinc-400 sm:grid-cols-3">
                <div>
                  <p className="font-mono uppercase tracking-wider text-zinc-550">Protocol source</p>
                  <p className="mt-1 font-semibold text-zinc-200">
                    {customProtocolsLoading
                      ? 'Loading chain catalog...'
                      : `${customProtocolOptions.length.toLocaleString()} ${newPosForm.chain} protocols available`}
                  </p>
                </div>
                <div>
                  <p className="font-mono uppercase tracking-wider text-zinc-550">Estimated unit price</p>
                  <p className="mt-1 font-semibold text-cyan-300">{formatPrice(newPosUnitPrice)}</p>
                </div>
                <div>
                  <p className="font-mono uppercase tracking-wider text-zinc-550">Pricing note</p>
                  <p className="mt-1 leading-relaxed text-zinc-300">{newPosPriceStatus}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMultichainPositions(DEFAULT_MULTICHAIN_POSITIONS)
                    setPortfolioInputSource('demo')
                    setMultichainResult(null)
                    setMultichainImportStatus(
                      'Loaded demo portfolio. These are sample simulation inputs, not wallet holdings.',
                    )
                  }}
                  className="text-zinc-400 border-zinc-850 bg-zinc-950 hover:bg-zinc-900 font-mono rounded-xs text-xs w-full sm:w-auto"
                >
                  Load Demo Portfolio
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={addMultichainPosition}
                  className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-bold uppercase tracking-wider rounded-xs shadow-[0_0_8px_rgba(6,182,212,0.2)] w-full sm:w-auto"
                >
                  Add Position
                </Button>
              </div>
            </div>
            {multichainImportStatus && (
              <p className="rounded-xs bg-cyan-950/5 border border-cyan-500/10 px-3.5 py-2 text-[10px] font-mono text-cyan-400">
                {multichainImportStatus}
              </p>
            )}
          </div>

          <WarRoomScenarioPanel
            simpleMode={simpleMode}
            onSimpleModeChange={setSimpleMode}
            useCustomScenario={useCustomScenario}
            onUseCustomScenarioChange={setUseCustomScenario}
            selectedScenarioIndex={selectedMultichainScenarioIdx}
            onSelectedScenarioIndexChange={setSelectedMultichainScenarioIdx}
            customScenario={customScenario}
            selectedCustomSeverity={selectedCustomSeverity}
            onSelectedCustomSeverityChange={setSelectedCustomSeverity}
            onCustomScenarioChange={updateCustomScenario}
            loading={multichainLoading}
            positions={multichainPositions}
            error={multichainError}
            onRunSimulation={runMultichainSimulation}
          />
        </section>

        {multichainResult && (
          <WarRoomSimulationResults result={multichainResult} onApplyMitigation={applyLocalMitigation} />
        )}
      </div>
    </div>
  )
}
