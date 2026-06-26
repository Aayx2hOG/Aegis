'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { ChainType } from '@/lib/chain/types'
import { CHAIN_BY_NATIVE_SYMBOL, NATIVE_ASSETS_BY_CHAIN } from '@/lib/config/war-room-multichain'
import type { ChainPortfolioPosition } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WarRoomOverview } from '@/components/war-room/war-room-overview'
import { WarRoomSimulationResults } from '@/components/war-room/war-room-simulation-results'
import { WarRoomScenarioPanel } from '@/components/war-room/war-room-scenario-panel'
import { useAtom } from 'jotai'
import { beginnerModeAtom } from '@/lib/store/research-store'
import { DeFiTooltip } from '@/components/ui/defi-helper'
import { formatCurrency, formatPrice } from '@/lib/war-room/format'
import { useWarRoomState } from '@/components/war-room/use-war-room-state'

export function WarRoomContent() {
  const wallet = useWallet()
  const [simpleMode, setSimpleMode] = useAtom(beginnerModeAtom)
  const {
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
  } = useWarRoomState(wallet)

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
                  onClick={loadDemoPortfolio}
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
