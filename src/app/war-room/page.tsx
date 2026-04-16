'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { PortfolioPosition, RiskBreakdown, ScenarioConfig, SimulationResult } from '@/lib/types/war-room'

type ScenarioPreset = ScenarioConfig & {
    beginnerLabel: string
    beginnerSummary: string
}

const SCENARIOS: ScenarioPreset[] = [
    {
        type: 'market-crash',
        title: 'Sudden SOL Price Drop',
        beginnerLabel: 'Market drop day',
        beginnerSummary: 'SOL falls quickly and selling gets harder for a short period.',
        marketShockPct: 32,
        stablecoinDepegPct: 0,
        liquidityDropPct: 45,
        oracleDelayMinutes: 3,
        protocolExploitSeverity: 12,
    },
    {
        type: 'stablecoin-depeg',
        title: 'Stablecoin Loses Its Peg',
        beginnerLabel: 'Stablecoin stress day',
        beginnerSummary: 'A major stablecoin moves away from $1 and confidence drops.',
        marketShockPct: 16,
        stablecoinDepegPct: 14,
        liquidityDropPct: 28,
        oracleDelayMinutes: 8,
        protocolExploitSeverity: 10,
    },
    {
        type: 'smart-contract-incident',
        title: 'Protocol Incident Scare',
        beginnerLabel: 'Protocol incident day',
        beginnerSummary: 'Exploit rumors spread and people rush to exit risky pools.',
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

function formatPercent(value: number): string {
    return `${value.toFixed(1)}%`
}

function getVolatilityLabel(volatility: number): 'Low' | 'Medium' | 'High' {
    if (volatility < 35) return 'Low'
    if (volatility < 70) return 'Medium'
    return 'High'
}

function getRiskBand(score: number): { label: 'Low' | 'Medium' | 'High'; color: string } {
    if (score < 34) return { label: 'Low', color: 'text-emerald-300' }
    if (score < 67) return { label: 'Medium', color: 'text-amber-300' }
    return { label: 'High', color: 'text-rose-300' }
}

function getTopRiskDrivers(risk: RiskBreakdown, limit = 3): Array<{ key: string; value: number }> {
    const pairs = [
        { key: 'Market swings', value: risk.marketRisk },
        { key: 'Low liquidity', value: risk.liquidityRisk },
        { key: 'Single protocol concentration', value: risk.concentrationRisk },
        { key: 'Forced close risk', value: risk.liquidationRisk },
        { key: 'Smart contract risk', value: risk.smartContractRisk },
    ]

    return pairs.sort((a, b) => b.value - a.value).slice(0, limit)
}

function getUrgencyTag(riskReduction: number): 'High Priority' | 'Medium Priority' | 'Good To Have' {
    if (riskReduction >= 20) return 'High Priority'
    if (riskReduction >= 10) return 'Medium Priority'
    return 'Good To Have'
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
    const [beginnerMode, setBeginnerMode] = useState(true)

    const totalValue = useMemo(() => positions.reduce((acc, p) => acc + p.usdValue, 0), [positions])
    const selectedScenario = SCENARIOS[selectedScenarioIdx]
    const topDrivers = useMemo(
        () => (result ? getTopRiskDrivers(result.riskBreakdown) : []),
        [result]
    )

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
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight">See How Your Portfolio Handles a Bad Market Day</h1>
                    <p className="text-zinc-300 max-w-3xl">
                        Pick a stress event, run a simulation, and get clear next steps to reduce potential losses.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                        {focusedProtocol && (
                            <div className="inline-flex items-center gap-2 rounded-lg bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-100">
                                Focused Protocol: {focusedProtocol}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setBeginnerMode((current) => !current)}
                            className="inline-flex items-center gap-2 rounded-lg border border-cyan-200/30 bg-cyan-100/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-100"
                        >
                            Beginner Mode: {beginnerMode ? 'On' : 'Off'}
                        </button>
                    </div>
                </header>

                <section className="rounded-2xl bg-zinc-900/45 p-5 backdrop-blur-md">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">How It Works</h2>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl bg-zinc-900/65 p-3">
                            <p className="text-xs text-zinc-400">Step 1</p>
                            <p className="mt-1 text-sm font-semibold">Review your holdings</p>
                            <p className="mt-1 text-xs text-zinc-400">Adjust the USD amount to match your current exposure.</p>
                        </div>
                        <div className="rounded-xl bg-zinc-900/65 p-3">
                            <p className="text-xs text-zinc-400">Step 2</p>
                            <p className="mt-1 text-sm font-semibold">Choose a stress event</p>
                            <p className="mt-1 text-xs text-zinc-400">Select one scenario to test how your positions may react.</p>
                        </div>
                        <div className="rounded-xl bg-zinc-900/65 p-3">
                            <p className="text-xs text-zinc-400">Step 3</p>
                            <p className="mt-1 text-sm font-semibold">Follow suggested actions</p>
                            <p className="mt-1 text-xs text-zinc-400">Use ranked actions to lower risk before real volatility appears.</p>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 rounded-2xl bg-zinc-900/45 p-5 backdrop-blur-md space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-lg">Your Current Holdings</h2>
                            <span className="text-xs text-zinc-400">Total: {formatCurrency(totalValue)}</span>
                        </div>

                        <div className="space-y-3">
                            {positions.map((position) => (
                                <div key={position.id} className="grid grid-cols-1 items-center gap-2 rounded-xl bg-zinc-900/65 p-3 md:grid-cols-7">
                                    <div className="md:col-span-3">
                                        <p className="font-semibold text-sm">{position.label}</p>
                                        <p className="text-xs text-zinc-400 uppercase tracking-wide">{position.protocol} • {position.kind}</p>
                                    </div>
                                    <div className="md:col-span-2 text-xs text-zinc-400">
                                        {beginnerMode
                                            ? `Price swings: ${getVolatilityLabel(position.volatility)}`
                                            : `Volatility ${position.volatility}%`}
                                    </div>
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
                        <h2 className="font-bold text-lg">Choose a Stress Event</h2>

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
                                    <p className="text-sm font-semibold">
                                        {beginnerMode ? scenario.beginnerLabel : scenario.title}
                                    </p>
                                    <p className="text-xs text-zinc-400 mt-1">
                                        {beginnerMode
                                            ? scenario.beginnerSummary
                                            : `Market -${scenario.marketShockPct}% • Liquidity -${scenario.liquidityDropPct}%`}
                                    </p>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={runSimulation}
                            disabled={loading}
                            className="w-full rounded-xl bg-cyan-300 py-3 font-black tracking-wide text-zinc-950 transition hover:bg-cyan-200 disabled:opacity-60"
                        >
                            {loading ? 'Running Simulation...' : 'Show My Risk Outcome'}
                        </button>

                        {error && <p className="text-red-400 text-sm">{error}</p>}
                    </div>
                </section>

                {result && (
                    <section className="space-y-6 animate-in fade-in duration-500">
                        <div className="rounded-2xl bg-cyan-300/10 p-4 ring-1 ring-cyan-200/20">
                            <p className="text-sm text-cyan-100">
                                In this scenario, your portfolio may drop about{' '}
                                <span className="font-semibold">{formatPercent(result.summary.projectedDrawdownPct)}</span>
                                {' '}({formatCurrency(result.summary.valueAtRiskUsd)}). The biggest pressure comes from{' '}
                                <span className="font-semibold">{topDrivers[0]?.key ?? 'overall market risk'}</span>.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <MetricCard
                                label="Current Portfolio Value"
                                value={formatCurrency(result.summary.portfolioValueUsd)}
                                helper="Your current modeled portfolio value."
                            />
                            <MetricCard
                                label="Estimated Value After Event"
                                value={formatCurrency(result.summary.projectedValueUsd)}
                                helper="Approximate value if this scenario happens."
                            />
                            <MetricCard
                                label="Estimated Possible Loss"
                                value={formatCurrency(result.summary.valueAtRiskUsd)}
                                helper="Potential portfolio value decrease in this simulation."
                                accent="text-rose-300"
                            />
                            <MetricCard
                                label="Estimated Drop"
                                value={formatPercent(result.summary.projectedDrawdownPct)}
                                helper="Percentage drop from current portfolio value."
                                accent="text-rose-300"
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                            <div className="lg:col-span-2 rounded-2xl bg-zinc-900/60 p-5 space-y-3">
                                <h3 className="font-bold">Risk Change Summary</h3>
                                <p className="text-sm text-zinc-300">
                                    Before event:{' '}
                                    <span className="font-semibold">
                                        {result.summary.riskScoreBefore} ({getRiskBand(result.summary.riskScoreBefore).label})
                                    </span>
                                </p>
                                <p className="text-sm text-zinc-300">
                                    After event:{' '}
                                    <span className={`font-semibold ${getRiskBand(result.summary.riskScoreAfterShock).color}`}>
                                        {result.summary.riskScoreAfterShock} ({getRiskBand(result.summary.riskScoreAfterShock).label})
                                    </span>
                                </p>
                                <p className="text-sm text-zinc-300">
                                    Chance of forced position close:{' '}
                                    <span className="font-semibold text-rose-300">{formatPercent(result.summary.liquidationProbabilityPct)}</span>
                                </p>

                                {beginnerMode ? (
                                    <div className="pt-2 space-y-2 text-xs text-zinc-300">
                                        <p className="font-semibold text-zinc-200">Top risk drivers</p>
                                        {topDrivers.map((driver) => (
                                            <p key={driver.key}>
                                                {driver.key}: <span className={getRiskBand(driver.value).color}>{driver.value}</span>
                                            </p>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="pt-2 space-y-2 text-xs text-zinc-400">
                                        <p>Market risk: {result.riskBreakdown.marketRisk}</p>
                                        <p>Liquidity risk: {result.riskBreakdown.liquidityRisk}</p>
                                        <p>Concentration risk: {result.riskBreakdown.concentrationRisk}</p>
                                        <p>Liquidation risk: {result.riskBreakdown.liquidationRisk}</p>
                                        <p>Smart contract risk: {result.riskBreakdown.smartContractRisk}</p>
                                    </div>
                                )}
                            </div>

                            <div className="lg:col-span-3 rounded-2xl bg-zinc-900/60 p-5">
                                <h3 className="font-bold mb-4">Recommended Next Steps</h3>
                                <div className="space-y-3">
                                    {result.topActions.map((action) => (
                                        <div key={action.id} className="rounded-xl p-4 bg-zinc-900/70">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="font-semibold text-cyan-200">{action.title}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded-full bg-zinc-800 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
                                                        {getUrgencyTag(action.impact.riskReduction)}
                                                    </span>
                                                    <p className="text-xs text-zinc-400">Model confidence {(action.impact.confidence * 100).toFixed(0)}%</p>
                                                </div>
                                            </div>
                                            <p className="text-sm text-zinc-300 mt-2">{action.rationale}</p>
                                            <p className="text-xs text-zinc-400 mt-3">
                                                Expected risk reduction: {action.impact.riskReduction} points • Estimated cost: {formatCurrency(action.impact.estimatedCostUsd)}
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
