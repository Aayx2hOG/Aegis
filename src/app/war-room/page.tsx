'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { PortfolioPosition, ScenarioConfig, SimulationResult } from '@/lib/types/war-room'

const SCENARIOS: ScenarioConfig[] = [
    {
        type: 'market-crash',
        title: 'SOL Flash Crash + Liquidity Gap',
        marketShockPct: 32,
        stablecoinDepegPct: 0,
        liquidityDropPct: 45,
        oracleDelayMinutes: 3,
        protocolExploitSeverity: 12,
    },
    {
        type: 'stablecoin-depeg',
        title: 'Stablecoin Depeg Spiral',
        marketShockPct: 16,
        stablecoinDepegPct: 14,
        liquidityDropPct: 28,
        oracleDelayMinutes: 8,
        protocolExploitSeverity: 10,
    },
    {
        type: 'smart-contract-incident',
        title: 'Major Protocol Exploit Rumor',
        marketShockPct: 24,
        stablecoinDepegPct: 3,
        liquidityDropPct: 38,
        oracleDelayMinutes: 5,
        protocolExploitSeverity: 34,
    },
]

const DEMO_POSITIONS: PortfolioPosition[] = [
    {
        id: '1',
        label: 'SOL Collateral Vault',
        symbol: 'SOL',
        protocol: 'kamino',
        kind: 'lending',
        usdValue: 380000,
        collateralFactor: 0.72,
        volatility: 77,
        liquidityScore: 82,
    },
    {
        id: '2',
        label: 'JitoSOL Yield Position',
        symbol: 'JITOSOL',
        protocol: 'jito',
        kind: 'staking',
        usdValue: 240000,
        volatility: 63,
        liquidityScore: 70,
    },
    {
        id: '3',
        label: 'ORCA/SOL LP',
        symbol: 'ORCA-SOL LP',
        protocol: 'orca',
        kind: 'lp',
        usdValue: 165000,
        volatility: 86,
        liquidityScore: 58,
    },
    {
        id: '4',
        label: 'USDC Strategy Reserve',
        symbol: 'USDC',
        protocol: 'marginfi',
        kind: 'token',
        usdValue: 215000,
        volatility: 6,
        liquidityScore: 95,
    },
]

function buildPositionsForProtocol(protocol?: string): PortfolioPosition[] {
    const normalized = (protocol ?? '').trim().toLowerCase()
    if (!normalized) return DEMO_POSITIONS

    const existingIdx = DEMO_POSITIONS.findIndex((position) => position.protocol.toLowerCase() === normalized)
    if (existingIdx >= 0) {
        const selected = {
            ...DEMO_POSITIONS[existingIdx],
            usdValue: Math.round(DEMO_POSITIONS[existingIdx].usdValue * 1.1),
        }
        const rest = DEMO_POSITIONS.filter((_, idx) => idx !== existingIdx)
        return [selected, ...rest]
    }

    const syntheticPosition: PortfolioPosition = {
        id: 'focused-protocol',
        label: `${normalized.toUpperCase()} Tactical Position`,
        symbol: normalized.toUpperCase(),
        protocol: normalized,
        kind: 'token',
        usdValue: 190000,
        volatility: 72,
        liquidityScore: 66,
    }

    const base = [...DEMO_POSITIONS]
    base.sort((a, b) => a.usdValue - b.usdValue)
    base[0] = syntheticPosition
    return base
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value)
}

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
    const searchParams = useSearchParams()
    const focusedProtocol = searchParams.get('protocol')?.trim().toLowerCase()

    const [positions, setPositions] = useState<PortfolioPosition[]>(() =>
        buildPositionsForProtocol(focusedProtocol)
    )
    const [selectedScenarioIdx, setSelectedScenarioIdx] = useState(0)
    const [result, setResult] = useState<SimulationResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const totalValue = useMemo(() => positions.reduce((acc, p) => acc + p.usdValue, 0), [positions])
    const selectedScenario = SCENARIOS[selectedScenarioIdx]

    async function runSimulation() {
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/war-room/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positions, scenario: selectedScenario }),
            })

            if (!res.ok) {
                throw new Error(await res.text())
            }

            const data: SimulationResult = await res.json()
            setResult(data)
        } catch (err) {
            setError(String(err))
        } finally {
            setLoading(false)
        }
    }

    function updatePositionValue(id: string, usdValue: number) {
        setPositions((current) =>
            current.map((position) =>
                position.id === id ? { ...position, usdValue: Number.isNaN(usdValue) ? 0 : Math.max(0, usdValue) } : position
            )
        )
    }

    return (
        <div className="min-h-screen text-zinc-100 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.2),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
            <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 md:px-6 md:py-14">
                <header className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Aegis War Room</p>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight">Protocol Digital Twin + Crisis Simulator</h1>
                    <p className="text-zinc-300 max-w-3xl">
                        Simulate portfolio stress scenarios, measure liquidation risk in seconds, and produce action playbooks before market chaos hits.
                    </p>
                    {focusedProtocol && (
                        <div className="inline-flex items-center gap-2 rounded-lg bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-100">
                            Focused Protocol: {focusedProtocol}
                        </div>
                    )}
                </header>

                <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 rounded-2xl bg-zinc-900/45 p-5 backdrop-blur-md space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-lg">Treasury Exposure Map</h2>
                            <span className="text-xs text-zinc-400">Total: {formatCurrency(totalValue)}</span>
                        </div>

                        <div className="space-y-3">
                            {positions.map((position) => (
                                <div key={position.id} className="grid grid-cols-1 items-center gap-2 rounded-xl bg-zinc-900/65 p-3 md:grid-cols-7">
                                    <div className="md:col-span-3">
                                        <p className="font-semibold text-sm">{position.label}</p>
                                        <p className="text-xs text-zinc-400 uppercase tracking-wide">{position.protocol} • {position.kind}</p>
                                    </div>
                                    <div className="md:col-span-2 text-xs text-zinc-400">Volatility {position.volatility}%</div>
                                    <div className="md:col-span-2">
                                        <input
                                            type="number"
                                            min={0}
                                            step={1000}
                                            value={position.usdValue}
                                            onChange={(e) => updatePositionValue(position.id, Number(e.target.value))}
                                            className="w-full rounded-md bg-zinc-950 px-2 py-1.5 text-sm font-medium ring-1 ring-zinc-800/60"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-2 rounded-2xl bg-zinc-900/45 p-5 backdrop-blur-md space-y-4">
                        <h2 className="font-bold text-lg">Shock Scenario</h2>

                        <div className="space-y-2">
                            {SCENARIOS.map((scenario, idx) => (
                                <button
                                    key={scenario.title}
                                    onClick={() => setSelectedScenarioIdx(idx)}
                                    className={`w-full rounded-lg px-3 py-2 text-left transition ${idx === selectedScenarioIdx
                                        ? 'bg-cyan-400/15 text-cyan-100'
                                        : 'bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800/80'
                                        }`}
                                >
                                    <p className="text-sm font-semibold">{scenario.title}</p>
                                    <p className="text-xs text-zinc-400 mt-1">Market -{scenario.marketShockPct}% • Liquidity -{scenario.liquidityDropPct}%</p>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={runSimulation}
                            disabled={loading}
                            className="w-full rounded-xl bg-cyan-300 py-3 font-black tracking-wide text-zinc-950 transition hover:bg-cyan-200 disabled:opacity-60"
                        >
                            {loading ? 'Simulating Crisis...' : 'Run War-Game Simulation'}
                        </button>

                        {error && <p className="text-red-400 text-sm">{error}</p>}
                    </div>
                </section>

                {result && (
                    <section className="space-y-6 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <MetricCard label="Portfolio Value" value={formatCurrency(result.summary.portfolioValueUsd)} />
                            <MetricCard label="Projected Value" value={formatCurrency(result.summary.projectedValueUsd)} />
                            <MetricCard label="Value at Risk" value={formatCurrency(result.summary.valueAtRiskUsd)} accent="text-rose-300" />
                            <MetricCard label="Drawdown" value={`${result.summary.projectedDrawdownPct}%`} accent="text-rose-300" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                            <div className="lg:col-span-2 rounded-2xl bg-zinc-900/60 p-5 space-y-3">
                                <h3 className="font-bold">Risk Delta</h3>
                                <p className="text-sm text-zinc-300">Before shock: <span className="font-semibold">{result.summary.riskScoreBefore}</span></p>
                                <p className="text-sm text-zinc-300">After shock: <span className="font-semibold text-amber-300">{result.summary.riskScoreAfterShock}</span></p>
                                <p className="text-sm text-zinc-300">Liquidation probability: <span className="font-semibold text-rose-300">{result.summary.liquidationProbabilityPct}%</span></p>

                                <div className="pt-2 space-y-2 text-xs text-zinc-400">
                                    <p>Market risk: {result.riskBreakdown.marketRisk}</p>
                                    <p>Liquidity risk: {result.riskBreakdown.liquidityRisk}</p>
                                    <p>Concentration risk: {result.riskBreakdown.concentrationRisk}</p>
                                    <p>Liquidation risk: {result.riskBreakdown.liquidationRisk}</p>
                                    <p>Smart contract risk: {result.riskBreakdown.smartContractRisk}</p>
                                </div>
                            </div>

                            <div className="lg:col-span-3 rounded-2xl bg-zinc-900/60 p-5">
                                <h3 className="font-bold mb-4">AI Action Playbook (Ranked)</h3>
                                <div className="space-y-3">
                                    {result.topActions.map((action) => (
                                        <div key={action.id} className="rounded-xl p-4 bg-zinc-900/70">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="font-semibold text-cyan-200">{action.title}</p>
                                                <p className="text-xs text-zinc-400">Confidence {(action.impact.confidence * 100).toFixed(0)}%</p>
                                            </div>
                                            <p className="text-sm text-zinc-300 mt-2">{action.rationale}</p>
                                            <p className="text-xs text-zinc-400 mt-3">
                                                Estimated risk reduction: {action.impact.riskReduction} points • Estimated cost: {formatCurrency(action.impact.estimatedCostUsd)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div className="rounded-xl bg-zinc-950/70 p-4">
            <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
            <p className={`text-2xl font-black mt-2 ${accent ?? 'text-zinc-100'}`}>{value}</p>
        </div>
    )
}
