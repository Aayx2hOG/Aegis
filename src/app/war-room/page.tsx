'use client'

import { Suspense, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { ChainType } from '@/lib/chain/types'
import { UI_DISCLAIMER } from '@/shared/config/war-room-config'
import type {
    ChainPortfolioPosition,
    MultiChainPortfolio,
    ChainScenarioConfig,
    ComparativeSimulationResult,
} from '@/shared/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

const DEFAULT_MULTICHAIN_POSITIONS: ChainPortfolioPosition[] = [
    {
        chain: ChainType.Solana,
        kind: 'token',
        symbol: 'SOL',
        protocol: 'wallet',
        balance: 1,
        usdValue: 150,
        volatility: 72,
        liquidityScore: 94,
    },
    {
        chain: ChainType.Solana,
        kind: 'yield',
        symbol: 'JITOSOL',
        protocol: 'jito',
        balance: 1,
        usdValue: 165,
        volatility: 58,
        liquidityScore: 79,
    },
    {
        chain: ChainType.Ethereum,
        kind: 'token',
        symbol: 'ETH',
        protocol: 'wallet',
        balance: 1,
        usdValue: 3500,
        volatility: 64,
        liquidityScore: 95,
    },
    {
        chain: ChainType.Ethereum,
        kind: 'yield',
        symbol: 'rETH',
        protocol: 'rocketpool',
        balance: 1,
        usdValue: 3700,
        volatility: 55,
        liquidityScore: 82,
    },
    {
        chain: ChainType.Arbitrum,
        kind: 'lp',
        symbol: 'ETH-USDC LP',
        protocol: 'uniswap',
        balance: 1,
        usdValue: 2000,
        volatility: 45,
        liquidityScore: 75,
    },
    {
        chain: ChainType.Base,
        kind: 'lending',
        symbol: 'USDC',
        protocol: 'aerodrome',
        balance: 1000,
        usdValue: 1000,
        volatility: 5,
        liquidityScore: 90,
        collateralFactor: 0.85,
    },
    {
        chain: ChainType.Optimism,
        kind: 'token',
        symbol: 'OP',
        protocol: 'wallet',
        balance: 100,
        usdValue: 250,
        volatility: 85,
        liquidityScore: 70,
    }
]

const MULTICHAIN_SCENARIOS: ChainScenarioConfig[] = [
    {
        marketShockPct: 35,
        liquidityDropPct: 55,
        protocolExploitSeverity: 15,
        oracleDelayMinutes: 5,
        bridgeOutageDurationMinutes: 120,
        chainsAffected: [ChainType.Solana, ChainType.Ethereum, ChainType.Arbitrum, ChainType.Base, ChainType.Optimism, ChainType.Polygon, ChainType.Cosmos],
    },
    {
        marketShockPct: 15,
        liquidityDropPct: 40,
        protocolExploitSeverity: 45,
        oracleDelayMinutes: 10,
        bridgeOutageDurationMinutes: 360,
        chainsAffected: [ChainType.Solana, ChainType.Arbitrum, ChainType.Optimism, ChainType.Base],
    },
    {
        marketShockPct: 20,
        liquidityDropPct: 50,
        protocolExploitSeverity: 25,
        oracleDelayMinutes: 15,
        bridgeOutageDurationMinutes: 180,
        chainsAffected: [ChainType.Arbitrum, ChainType.Optimism, ChainType.Base, ChainType.Polygon],
    }
]

const MULTICHAIN_SCENARIO_INFO = [
    {
        title: 'Systemic Liquidity Crisis',
        description: 'Global panic leads to market collapse, heavy liquidity flight, and bridge disruptions.',
        beginnerLabel: 'Global Liquidity Panic',
        beginnerSummary: 'A market-wide panic where liquidity disappears, and cross-chain transfers are blocked.',
    },
    {
        title: 'Cross-Chain Bridge Outage',
        description: 'Vulnerability detected in standard cross-chain messaging bridge. Bridge operations paused.',
        beginnerLabel: 'Bridge Outage / Trapped Assets',
        beginnerSummary: 'Cross-chain bridges are disabled, trapping your assets on their current networks.',
    },
    {
        title: 'EVM L2 Sequencer Downtime',
        description: 'Centralized sequencer for key EVM layer-2 rollups crashes, suspending tx verification.',
        beginnerLabel: 'Network Freeze / Blocked Trades',
        beginnerSummary: 'Major Layer-2 networks freeze, preventing you from executing any trades or liquidations.',
    }
]

export default function WarRoomPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
                    <span className="loading loading-spinner loading-lg text-primary" />
                </div>
            }
        >
            <WarRoomContent />
        </Suspense>
    )
}

function WarRoomContent() {
    const wallet = useWallet()
    const [simpleMode, setSimpleMode] = useState(false)

    // Multichain states
    const [multichainPositions, setMultichainPositions] = useState<ChainPortfolioPosition[]>(DEFAULT_MULTICHAIN_POSITIONS)
    const [selectedMultichainScenarioIdx, setSelectedMultichainScenarioIdx] = useState(0)
    const [multichainResult, setMultichainResult] = useState<ComparativeSimulationResult | null>(null)
    const [multichainLoading, setMultichainLoading] = useState(false)
    const [multichainError, setMultichainError] = useState<string | null>(null)
    const [multichainImportStatus, setMultichainImportStatus] = useState<string | null>(null)

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
        symbol: '',
        protocol: '',
        usdValue: 0,
        balance: 0,
        volatility: 50,
        liquidityScore: 80,
    })

    function updateMultichainPositionField(index: number, field: keyof ChainPortfolioPosition, value: number) {
        setMultichainPositions((current) =>
            current.map((pos, idx) => (idx === index ? { ...pos, [field]: value } : pos))
        )
        setMultichainResult(null)
    }

    function removeMultichainPosition(index: number) {
        setMultichainPositions((current) => current.filter((_, idx) => idx !== index))
        setMultichainResult(null)
    }

    function addMultichainPosition() {
        if (!newPosForm.symbol.trim() || !newPosForm.protocol.trim() || newPosForm.usdValue <= 0) {
            setMultichainImportStatus('Holding details (Symbol, Protocol, USD Value) must be provided.')
            return
        }

        const newPos: ChainPortfolioPosition = {
            chain: newPosForm.chain,
            kind: newPosForm.kind,
            symbol: newPosForm.symbol.trim().toUpperCase(),
            protocol: newPosForm.protocol.trim().toLowerCase(),
            usdValue: newPosForm.usdValue,
            balance: newPosForm.usdValue / 10,
            volatility: newPosForm.volatility,
            liquidityScore: newPosForm.liquidityScore,
        }

        setMultichainPositions((current) => [...current, newPos])
        setMultichainResult(null)
        setMultichainImportStatus(`Added ${newPos.symbol} on ${newPos.chain}.`)
        setNewPosForm({
            chain: ChainType.Solana,
            kind: 'token',
            symbol: '',
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

        const scenarioPreset = MULTICHAIN_SCENARIOS[selectedMultichainScenarioIdx]
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
                body: JSON.stringify({ portfolio: portfolioPayload, scenario: scenarioPreset }),
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
        <div className="mx-auto max-w-6xl space-y-8 py-6">
            <header className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Badge variant="accent" className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-semibold">
                        Aegis War Room
                    </Badge>
                </div>
                <div className="space-y-2">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                        Stress Test Your <span className="text-cyan-200">Cross-Chain Portfolio</span>
                    </h1>
                    <p className="text-zinc-400 text-sm max-w-3xl leading-relaxed">
                        Configure your assets across multiple chains, pick a systemic market shock, and analyze risk posture, rebalancing paths, and arbitrage opportunities.
                    </p>
                    <div className="rounded-md bg-yellow-900/10 border border-yellow-800/20 p-3 text-xs text-yellow-200 mt-2">
                        {UI_DISCLAIMER}
                    </div>
                </div>
            </header>

                <div className="space-y-8 animate-in fade-in duration-500">
                    <section className="rounded-2xl bg-zinc-900/45 p-5 backdrop-blur-md">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">How It Works</h2>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl bg-zinc-900/65 p-3">
                                <p className="text-xs text-zinc-400">Step 1</p>
                                <p className="mt-1 text-sm font-semibold">Manage multi-chain portfolio</p>
                                <p className="mt-1 text-xs text-zinc-400">Configure assets across Solana, Ethereum, Base, and other networks.</p>
                            </div>
                            <div className="rounded-xl bg-zinc-900/65 p-3">
                                <p className="text-xs text-zinc-400">Step 2</p>
                                <p className="mt-1 text-sm font-semibold">Run systemic scenarios</p>
                                <p className="mt-1 text-xs text-zinc-400">Simulate bridge downtime, L2 sequencer outages, or global panic shocks.</p>
                            </div>
                            <div className="rounded-xl bg-zinc-900/65 p-3">
                                <p className="text-xs text-zinc-400">Step 3</p>
                                <p className="mt-1 text-sm font-semibold">Hedge and route arbitrage</p>
                                <p className="mt-1 text-xs text-zinc-400">Apply cross-chain rebalancing steps and capture price spreads.</p>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-3 rounded-2xl bg-zinc-900/45 p-5 backdrop-blur-md space-y-4">
                            <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2">
                                <h2 className="font-bold text-lg">Cross-Chain Portfolio Holdings</h2>
                                <span className="text-xs text-zinc-400 font-semibold text-cyan-300">
                                    Total USD Value: {formatCurrency(multichainPositions.reduce((acc, p) => acc + p.usdValue, 0))}
                                </span>
                            </div>

                            {multichainPositions.length === 0 ? (
                                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20">
                                    <p className="text-xs font-semibold text-zinc-300">No holdings configured</p>
                                    <p className="text-[11px] text-zinc-500 mt-1">
                                        Click &quot;Reset to Demo Portfolio&quot; below to populate with standard assets.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                                    {multichainPositions.map((pos, idx) => (
                                        <div key={`${pos.chain}-${pos.symbol}-${idx}`} className="grid grid-cols-1 gap-3 rounded-xl bg-zinc-900/65 p-3 sm:grid-cols-12 items-center">
                                            <div className="sm:col-span-4">
                                                <p className="font-semibold text-sm capitalize">{pos.symbol}</p>
                                                <p className="text-[10px] text-zinc-400 uppercase tracking-wide">
                                                    {pos.chain} • {pos.protocol} • {pos.kind}
                                                </p>
                                            </div>
                                            <div className="sm:col-span-3">
                                                <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-0.5">USD Value</label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={pos.usdValue}
                                                    onChange={(e) => updateMultichainPositionField(idx, 'usdValue', Number(e.target.value))}
                                                    className="h-8 text-xs text-white"
                                                />
                                                <span className="text-[9px] text-zinc-400 mt-1 block font-mono truncate">
                                                    {formatCurrency(pos.usdValue)} ({new Intl.NumberFormat('en-US', { notation: 'compact', style: 'currency', currency: 'USD' }).format(pos.usdValue)})
                                                </span>
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-0.5">Vol %</label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={150}
                                                    value={pos.volatility}
                                                    onChange={(e) => updateMultichainPositionField(idx, 'volatility', Number(e.target.value))}
                                                    className="h-8 text-xs text-white"
                                                />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-0.5">Liq Score</label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={pos.liquidityScore}
                                                    onChange={(e) => updateMultichainPositionField(idx, 'liquidityScore', Number(e.target.value))}
                                                    className="h-8 text-xs text-white"
                                                />
                                            </div>
                                            <div className="sm:col-span-1 text-right">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeMultichainPosition(idx)}
                                                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-7 w-7 p-0 rounded-full"
                                                >
                                                    ✕
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="rounded-xl border border-white/5 bg-zinc-950/40 p-4 space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">Add Custom Holding</h3>
                                <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
                                    <div>
                                        <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1">Chain</label>
                                        <select
                                            value={newPosForm.chain}
                                            onChange={(e) => setNewPosForm({ ...newPosForm, chain: e.target.value as ChainType })}
                                            className="flex h-9 w-full rounded-md border border-white/5 bg-transparent dark:bg-input/30 px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-cyan-350/60 focus:ring-2 focus:ring-cyan-350/20 disabled:cursor-not-allowed disabled:opacity-50 text-white"
                                        >
                                            {Object.values(ChainType).map((c) => (
                                                <option key={c} value={c} className="bg-zinc-950 text-white">{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1">Symbol</label>
                                        <Input
                                            type="text"
                                            placeholder="SOL, ETH"
                                            value={newPosForm.symbol}
                                            onChange={(e) => setNewPosForm({ ...newPosForm, symbol: e.target.value.toUpperCase() })}
                                            className="h-9 text-xs uppercase"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1">Protocol</label>
                                        <Input
                                            type="text"
                                            placeholder="jito, aave"
                                            value={newPosForm.protocol}
                                            onChange={(e) => setNewPosForm({ ...newPosForm, protocol: e.target.value.toLowerCase() })}
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1">Kind</label>
                                        <select
                                            value={newPosForm.kind}
                                            onChange={(e) => setNewPosForm({ ...newPosForm, kind: e.target.value as ChainPortfolioPosition['kind'] })}
                                            className="flex h-9 w-full rounded-md border border-white/5 bg-transparent dark:bg-input/30 px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-cyan-350/60 focus:ring-2 focus:ring-cyan-350/20 disabled:cursor-not-allowed disabled:opacity-50 text-white"
                                        >
                                            <option value="token" className="bg-zinc-950 text-white">token</option>
                                            <option value="lp" className="bg-zinc-950 text-white">lp</option>
                                            <option value="lending" className="bg-zinc-950 text-white">lending</option>
                                            <option value="yield" className="bg-zinc-950 text-white">yield</option>
                                            <option value="other" className="bg-zinc-950 text-white">other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1">USD Value</label>
                                        <Input
                                            type="number"
                                            min={0}
                                            placeholder="1000"
                                            value={newPosForm.usdValue || ''}
                                            onChange={(e) => setNewPosForm({ ...newPosForm, usdValue: Number(e.target.value) })}
                                            className="h-9 text-xs"
                                        />
                                        {newPosForm.usdValue > 0 && (
                                            <span className="text-[10px] text-zinc-400 mt-1 block font-mono">
                                                {formatCurrency(newPosForm.usdValue)} ({new Intl.NumberFormat('en-US', { notation: 'compact', style: 'currency', currency: 'USD' }).format(newPosForm.usdValue)})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setMultichainPositions(DEFAULT_MULTICHAIN_POSITIONS)
                                            setMultichainResult(null)
                                            setMultichainImportStatus('Reset portfolio to demo layout.')
                                        }}
                                        className="text-zinc-300 border-white/5 bg-zinc-900/40 hover:bg-zinc-800"
                                    >
                                        Reset to Demo Portfolio
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={addMultichainPosition}
                                        className="bg-cyan-300 hover:bg-cyan-200 text-zinc-950 font-bold"
                                    >
                                        Add Position
                                    </Button>
                                </div>
                            </div>
                            {multichainImportStatus && (
                                <p className="rounded-lg bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300">{multichainImportStatus}</p>
                            )}
                        </div>

                        <div className="lg:col-span-2 rounded-2xl bg-zinc-900/45 p-5 backdrop-blur-md space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="font-bold text-lg">Choose Cross-Chain Scenario</h2>
                                <button
                                    type="button"
                                    onClick={() => setSimpleMode(!simpleMode)}
                                    className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide border transition ${simpleMode
                                        ? 'bg-cyan-500/15 border-cyan-400/35 text-cyan-300'
                                        : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:border-zinc-600'
                                        }`}
                                >
                                    {simpleMode ? 'Simple Lingo: ON' : 'Simple Lingo: OFF'}
                                </button>
                            </div>
                            <div className="space-y-2">
                                {MULTICHAIN_SCENARIOS.map((sc, idx) => {
                                    const info = MULTICHAIN_SCENARIO_INFO[idx]
                                    return (
                                        <button
                                            key={info.title}
                                            type="button"
                                            onClick={() => setSelectedMultichainScenarioIdx(idx)}
                                            className={`w-full rounded-lg px-3 py-3 text-left transition border ${idx === selectedMultichainScenarioIdx
                                                ? 'bg-cyan-400/15 border-cyan-400/40 text-cyan-100'
                                                : 'bg-zinc-900/70 border-zinc-800/40 text-zinc-300 hover:bg-zinc-800/80'
                                                }`}
                                        >
                                            <p className="text-sm font-semibold">{simpleMode ? info.beginnerLabel : info.title}</p>
                                            <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                                                {simpleMode ? info.beginnerSummary : info.description}
                                            </p>
                                            {!simpleMode && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    <span className="rounded bg-zinc-950/80 px-1.5 py-0.5 text-[9px] text-zinc-400 font-mono">Market Shock: -{sc.marketShockPct}%</span>
                                                    <span className="rounded bg-zinc-950/80 px-1.5 py-0.5 text-[9px] text-zinc-400 font-mono">Liquidity: -{sc.liquidityDropPct}%</span>
                                                    {sc.bridgeOutageDurationMinutes && sc.bridgeOutageDurationMinutes > 0 ? (
                                                        <span className="rounded bg-rose-500/10 text-rose-300 px-1.5 py-0.5 text-[9px] font-mono">Bridge Outage: {sc.bridgeOutageDurationMinutes}m</span>
                                                    ) : null}
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>

                            <Button
                                onClick={runMultichainSimulation}
                                disabled={multichainLoading || multichainPositions.length === 0}
                                className="w-full h-11 bg-cyan-300 hover:bg-cyan-200 text-zinc-950 font-black uppercase tracking-wider text-xs shadow-lg shadow-cyan-500/10 cursor-pointer"
                            >
                                {multichainLoading ? 'Running Simulation...' : 'Run Comparative Simulation'}
                            </Button>
                            {multichainError && <p className="text-red-400 text-sm">{multichainError}</p>}
                        </div>
                    </section>

                    {multichainResult && (
                        <section className="space-y-6 animate-in fade-in duration-500">
                            <div className="rounded-2xl bg-cyan-300/10 p-4 ring-1 ring-cyan-200/20">
                                <p className="text-sm text-cyan-100 leading-relaxed">
                                    Simulation finished with an aggregate portfolio risk of <span className="font-bold text-white">{multichainResult.aggregateRisk}/100</span> ({getRiskBand(multichainResult.aggregateRisk).label}). Max estimated portfolio drawdown is <span className="font-semibold text-rose-300">-{multichainResult.portfolioImpact.maxDrawdown.toFixed(1)}%</span>. Most vulnerable deployment chain is <span className="font-semibold text-white uppercase">{multichainResult.mostVulnerableChain}</span>, while <span className="font-semibold text-white uppercase">{multichainResult.leastVulnerableChain}</span> remains the safest haven.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <MetricCard
                                    label="Portfolio Total Value"
                                    value={formatCurrency(multichainResult.portfolioImpact.totalUsdValue)}
                                    helper="Aggregate value of your multichain positions."
                                />
                                <MetricCard
                                    label="Projected Value After Shock"
                                    value={formatCurrency(multichainResult.portfolioImpact.projectedValue)}
                                    helper="Estimated portfolio value after systemic impact."
                                />
                                <MetricCard
                                    label="Value At Risk (VaR)"
                                    value={formatCurrency(multichainResult.portfolioImpact.totalUsdValue - multichainResult.portfolioImpact.projectedValue)}
                                    helper="Estimated monetary loss under this stress event."
                                    accent="text-rose-300"
                                />
                                <MetricCard
                                    label="Max Drawdown"
                                    value={`-${multichainResult.portfolioImpact.maxDrawdown.toFixed(1)}%`}
                                    helper="Maximum modeled portfolio decline percentage."
                                    accent="text-rose-300"
                                />
                            </div>

                            <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-6 space-y-6">
                                <div className="border-b border-zinc-800/60 pb-4">
                                    <h2 className="text-xl font-bold text-white">Inter-Chain Security Heatmap</h2>
                                    <p className="text-xs text-zinc-400 mt-1">Deployment risk breakdown per chain based on the scenario impact factors.</p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {multichainResult.chainRisks.map((cr) => {
                                        const rb = getRiskBand(cr.aggregateRisk)
                                        const colorClass = rb.color

                                        return (
                                            <div key={cr.chain} className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 space-y-4">
                                                <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2">
                                                    <h3 className="font-bold text-sm uppercase tracking-wide text-zinc-100">{cr.chain}</h3>
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded bg-zinc-900/80 ${colorClass}`}>
                                                        Risk: {cr.aggregateRisk.toFixed(0)} ({rb.label})
                                                    </span>
                                                </div>
                                                <div className="space-y-2.5">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                                            <span>Market Risk</span>
                                                            <span className="font-semibold text-zinc-200">{cr.marketRisk}%</span>
                                                        </div>
                                                        <div className="h-1 rounded-full bg-zinc-900 overflow-hidden">
                                                            <div className="h-full bg-cyan-400" style={{ width: `${cr.marketRisk}%` }} />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                                            <span>Liquidity Risk</span>
                                                            <span className="font-semibold text-zinc-200">{cr.liquidityRisk}%</span>
                                                        </div>
                                                        <div className="h-1 rounded-full bg-zinc-900 overflow-hidden">
                                                            <div className="h-full bg-blue-400" style={{ width: `${cr.liquidityRisk}%` }} />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                                            <span>Concentration Risk</span>
                                                            <span className="font-semibold text-zinc-200">{cr.concentrationRisk}%</span>
                                                        </div>
                                                        <div className="h-1 rounded-full bg-zinc-900 overflow-hidden">
                                                            <div className="h-full bg-indigo-400" style={{ width: `${cr.concentrationRisk}%` }} />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                                            <span>Liquidation Risk</span>
                                                            <span className="font-semibold text-zinc-200">{cr.liquidationRisk}%</span>
                                                        </div>
                                                        <div className="h-1 rounded-full bg-zinc-900 overflow-hidden">
                                                            <div className="h-full bg-purple-400" style={{ width: `${cr.liquidationRisk}%` }} />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                                            <span>Smart Contract Risk</span>
                                                            <span className="font-semibold text-zinc-200">{cr.smartContractRisk}%</span>
                                                        </div>
                                                        <div className="h-1 rounded-full bg-zinc-900 overflow-hidden">
                                                            <div className="h-full bg-violet-400" style={{ width: `${cr.smartContractRisk}%` }} />
                                                        </div>
                                                    </div>
                                                    {cr.bridgeRisk !== undefined && cr.bridgeRisk > 0 && (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between text-[10px] text-rose-300">
                                                                <span>Bridge Exposure Risk</span>
                                                                <span className="font-semibold text-rose-200">{cr.bridgeRisk}%</span>
                                                            </div>
                                                            <div className="h-1 rounded-full bg-zinc-900 overflow-hidden">
                                                                <div className="h-full bg-rose-400" style={{ width: `${cr.bridgeRisk}%` }} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                <div className="lg:col-span-3 rounded-2xl bg-zinc-900/60 p-5 space-y-4">
                                    <h3 className="font-bold text-lg text-white border-b border-zinc-800/40 pb-2">Hedge & Rebalancing Recommendations</h3>
                                    {multichainResult.rebalancingRecommendations.length === 0 ? (
                                        <div className="text-center py-6 text-zinc-400 text-xs">
                                            No urgent rebalancing required. Risk exposure is stable under the current scenario.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {multichainResult.rebalancingRecommendations.map((rec, idx) => (
                                                <div key={idx} className="rounded-xl p-4 bg-zinc-950/60 border border-zinc-800/40 space-y-2">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase ${rec.action === 'move' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : rec.action === 'liquidate' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                                                                {rec.action}
                                                            </span>
                                                            <p className="font-bold text-sm text-cyan-200">{rec.assetSymbol} • {rec.protocol}</p>
                                                        </div>
                                                        <span className="text-[10px] text-zinc-400 font-mono">
                                                            Risk Reduction: <span className="font-bold text-emerald-300">-{rec.expectedRiskReduction} pts</span>
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-zinc-300 leading-normal">{rec.rationale}</p>
                                                    <div className="flex flex-wrap gap-4 text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/40">
                                                        {rec.fromChain && (
                                                            <span>From Chain: <span className="font-semibold text-zinc-300 uppercase">{rec.fromChain}</span></span>
                                                        )}
                                                        {rec.toChain && (
                                                            <span>To Chain: <span className="font-semibold text-zinc-300 uppercase">{rec.toChain}</span></span>
                                                        )}
                                                        <span>Amt: <span className="font-semibold text-zinc-300">{rec.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="lg:col-span-2 rounded-2xl bg-zinc-900/60 p-5 space-y-4">
                                    <h3 className="font-bold text-lg text-white border-b border-zinc-800/40 pb-2">Cross-Chain Arbitrage Alerts</h3>
                                    {multichainResult.crossChainArbitrageOpportunities.length === 0 ? (
                                        <div className="text-center py-6 text-zinc-400 text-xs">
                                            No significant price discrepancies detected. Liquidity bridges are in equilibrium.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {multichainResult.crossChainArbitrageOpportunities.map((opp, idx) => (
                                                <div key={idx} className="rounded-xl p-4 bg-zinc-950/60 border border-zinc-800/40 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <p className="font-bold text-sm text-cyan-200">{opp.assetSymbol} Arbitrage</p>
                                                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${opp.riskLevel === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : opp.riskLevel === 'medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                                                            Risk: {opp.riskLevel}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-zinc-300 leading-normal">{opp.rationale}</p>
                                                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-zinc-800/40 text-zinc-400">
                                                        <span>Route: <span className="font-semibold uppercase text-zinc-300">{opp.fromChain} ➜ {opp.toChain}</span></span>
                                                        <span>Profit: <span className="font-bold text-emerald-300">+{opp.profitMargin}%</span></span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </div>
    )
}

function MetricCard({
    label,
    value,
    helper,
    accent,
}: {
    label: string
    value: string
    helper: string
    accent?: string
}) {
    return (
        <div className="rounded-xl bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
            <p className={`text-2xl font-black mt-2 ${accent ?? 'text-zinc-100'}`}>{value}</p>
            <p className="mt-2 text-xs text-zinc-400">{helper}</p>
        </div>
    )
}

function getRiskBand(score: number): { label: 'Low' | 'Medium' | 'High'; color: string } {
    if (score < 34) return { label: 'Low', color: 'text-emerald-300' }
    if (score < 67) return { label: 'Medium', color: 'text-amber-300' }
    return { label: 'High', color: 'text-rose-300' }
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value)
}
