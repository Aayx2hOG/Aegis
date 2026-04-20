'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { WalletButton } from '@/components/solana/solana-provider'
import type { PortfolioPosition, RiskBreakdown, ScenarioConfig, SimulationResult } from '@/lib/types/war-room'

type ScenarioPreset = ScenarioConfig & {
    beginnerLabel: string
    beginnerSummary: string
}

type PortfolioTemplate = {
    id: string
    title: string
    summary: string
    positions: PortfolioPosition[]
}

type TokenProfile = {
    symbol: string
    label: string
    protocol: string
    kind: PortfolioPosition['kind']
    volatility: number
    liquidityScore: number
    fallbackPriceUsd: number
}

const SOL_PRICE_ID = 'So11111111111111111111111111111111111111112'

const TOKEN_PROFILES: Record<string, TokenProfile> = {
    [SOL_PRICE_ID]: {
        symbol: 'SOL',
        label: 'SOL Wallet Balance',
        protocol: 'wallet',
        kind: 'token',
        volatility: 72,
        liquidityScore: 94,
        fallbackPriceUsd: 150,
    },
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
        symbol: 'USDC',
        label: 'USDC Wallet Balance',
        protocol: 'wallet',
        kind: 'token',
        volatility: 6,
        liquidityScore: 97,
        fallbackPriceUsd: 1,
    },
    Es9vMFrzaCERmJfrF4H2FYr9zQeMgsQUK91t5r7iB5n: {
        symbol: 'USDT',
        label: 'USDT Wallet Balance',
        protocol: 'wallet',
        kind: 'token',
        volatility: 7,
        liquidityScore: 96,
        fallbackPriceUsd: 1,
    },
    J1toso1uCZLxP8Y2c6spp6k8m8wFf7fY8h2w9y5xV1f: {
        symbol: 'JITOSOL',
        label: 'JitoSOL Wallet Balance',
        protocol: 'jito',
        kind: 'staking',
        volatility: 58,
        liquidityScore: 79,
        fallbackPriceUsd: 165,
    },
    mSoLzYCxHdYgdzU4h7m3NcxuA8mVvLxqFQY6Sg8YwzY: {
        symbol: 'MSOL',
        label: 'mSOL Wallet Balance',
        protocol: 'marinade',
        kind: 'staking',
        volatility: 57,
        liquidityScore: 78,
        fallbackPriceUsd: 162,
    },
    bSo13r4TkiE4dY1UQ4wEs7KMq6ZqUQ6f5cTQY7hBwPj: {
        symbol: 'BSOL',
        label: 'bSOL Wallet Balance',
        protocol: 'blaze',
        kind: 'staking',
        volatility: 57,
        liquidityScore: 76,
        fallbackPriceUsd: 160,
    },
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

const PORTFOLIO_TEMPLATES: PortfolioTemplate[] = [
    {
        id: 'balanced-starter',
        title: 'Balanced Starter',
        summary: 'Lower-volatility setup for someone learning DeFi basics.',
        positions: [
            {
                id: 'tmpl-1',
                label: 'SOL Core Position',
                symbol: 'SOL',
                protocol: 'wallet',
                kind: 'token',
                usdValue: 7000,
                collateralFactor: 0,
                volatility: 64,
                liquidityScore: 92,
            },
            {
                id: 'tmpl-2',
                label: 'USDC Safety Bucket',
                symbol: 'USDC',
                protocol: 'wallet',
                kind: 'token',
                usdValue: 4500,
                collateralFactor: 0,
                volatility: 5,
                liquidityScore: 97,
            },
            {
                id: 'tmpl-3',
                label: 'LST Yield Position',
                symbol: 'JITOSOL',
                protocol: 'jito',
                kind: 'staking',
                usdValue: 3500,
                collateralFactor: 0.45,
                volatility: 52,
                liquidityScore: 74,
            },
        ],
    },
    {
        id: 'yield-seeker',
        title: 'Yield Seeker',
        summary: 'Income-focused mix with moderate protocol and liquidity risk.',
        positions: [
            {
                id: 'tmpl-4',
                label: 'JitoSOL Yield Position',
                symbol: 'JITOSOL',
                protocol: 'jito',
                kind: 'staking',
                usdValue: 9000,
                collateralFactor: 0.55,
                volatility: 63,
                liquidityScore: 70,
            },
            {
                id: 'tmpl-5',
                label: 'USDC Lending Position',
                symbol: 'USDC',
                protocol: 'kamino',
                kind: 'lending',
                usdValue: 8000,
                collateralFactor: 0.62,
                volatility: 8,
                liquidityScore: 90,
            },
            {
                id: 'tmpl-6',
                label: 'ORCA/SOL LP',
                symbol: 'ORCA-SOL LP',
                protocol: 'orca',
                kind: 'lp',
                usdValue: 5000,
                collateralFactor: 0.4,
                volatility: 86,
                liquidityScore: 58,
            },
        ],
    },
    {
        id: 'high-beta',
        title: 'High Beta',
        summary: 'Return-chasing portfolio with larger drawdown potential.',
        positions: [
            {
                id: 'tmpl-7',
                label: 'SOL Leverage Collateral',
                symbol: 'SOL',
                protocol: 'kamino',
                kind: 'lending',
                usdValue: 13000,
                collateralFactor: 0.78,
                volatility: 79,
                liquidityScore: 84,
            },
            {
                id: 'tmpl-8',
                label: 'Meme Basket',
                symbol: 'MEME',
                protocol: 'wallet',
                kind: 'token',
                usdValue: 6000,
                collateralFactor: 0,
                volatility: 94,
                liquidityScore: 46,
            },
            {
                id: 'tmpl-9',
                label: 'ORCA/SOL LP',
                symbol: 'ORCA-SOL LP',
                protocol: 'orca',
                kind: 'lp',
                usdValue: 7000,
                collateralFactor: 0.42,
                volatility: 88,
                liquidityScore: 54,
            },
        ],
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

function shortenMint(mint: string): string {
    return `${mint.slice(0, 4)}...${mint.slice(-4)}`
}

async function fetchTokenPrices(ids: string[]): Promise<Record<string, number>> {
    if (!ids.length) return {}

    try {
        const url = `https://price.jup.ag/v6/price?ids=${encodeURIComponent(ids.join(','))}`
        const res = await fetch(url)
        if (!res.ok) return {}

        const body = (await res.json()) as { data?: Record<string, { price?: number }> }
        const prices: Record<string, number> = {}

        Object.entries(body.data ?? {}).forEach(([id, payload]) => {
            const value = payload?.price
            if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
                prices[id] = value
            }
        })

        return prices
    } catch {
        return {}
    }
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
    const wallet = useWallet()
    const { connection } = useConnection()
    const focusedProtocol = searchParams.get('protocol')?.trim().toLowerCase()

    const [positions, setPositions] = useState<PortfolioPosition[]>(() =>
        buildPositionsForProtocol(focusedProtocol)
    )
    const [selectedScenarioIdx, setSelectedScenarioIdx] = useState(0)
    const [result, setResult] = useState<SimulationResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [beginnerMode, setBeginnerMode] = useState(true)
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
    const [importingWallet, setImportingWallet] = useState(false)
    const [importStatus, setImportStatus] = useState<string | null>(null)

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

    function applyTemplate(templateId: string) {
        const template = PORTFOLIO_TEMPLATES.find((item) => item.id === templateId)
        if (!template) return
        setPositions(template.positions)
        setSelectedTemplateId(template.id)
        setResult(null)
        setError(null)
        setImportStatus(`Loaded template: ${template.title}`)
    }

    async function importFromWallet() {
        if (!wallet.publicKey) {
            setError('Connect your wallet first, then click Import Wallet Balances.')
            return
        }

        setImportingWallet(true)
        setError(null)
        setImportStatus(null)

        try {
            const [solBalanceLamports, tokenAccounts, token2022Accounts] = await Promise.all([
                connection.getBalance(wallet.publicKey, 'confirmed'),
                connection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_PROGRAM_ID }),
                connection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_2022_PROGRAM_ID }),
            ])

            const parsedTokenAccounts = [...tokenAccounts.value, ...token2022Accounts.value]
            const positiveTokenRows = parsedTokenAccounts
                .map((account) => {
                    const parsed = account.account.data.parsed as {
                        info?: { mint?: string; tokenAmount?: { uiAmount?: number } }
                    }
                    const mint = parsed?.info?.mint
                    const uiAmount = parsed?.info?.tokenAmount?.uiAmount
                    if (!mint || typeof uiAmount !== 'number' || uiAmount <= 0) return null
                    return { mint, amount: uiAmount }
                })
                .filter((row): row is { mint: string; amount: number } => Boolean(row))

            const priceIds = Array.from(new Set([SOL_PRICE_ID, ...positiveTokenRows.map((row) => row.mint)]))
            const prices = await fetchTokenPrices(priceIds)

            const importedPositions: PortfolioPosition[] = []

            const solAmount = solBalanceLamports / LAMPORTS_PER_SOL
            const solProfile = TOKEN_PROFILES[SOL_PRICE_ID]
            const solPrice = prices[SOL_PRICE_ID] ?? solProfile.fallbackPriceUsd
            const solValue = solAmount * solPrice
            if (solValue >= 20) {
                importedPositions.push({
                    id: 'wallet-sol',
                    label: solProfile.label,
                    symbol: solProfile.symbol,
                    protocol: solProfile.protocol,
                    kind: solProfile.kind,
                    usdValue: Math.round(solValue),
                    collateralFactor: 0,
                    volatility: solProfile.volatility,
                    liquidityScore: solProfile.liquidityScore,
                })
            }

            positiveTokenRows.forEach((row) => {
                const profile = TOKEN_PROFILES[row.mint]
                const fallbackPrice = profile?.fallbackPriceUsd ?? 0
                const price = prices[row.mint] ?? fallbackPrice
                const usdValue = row.amount * price
                if (!Number.isFinite(usdValue) || usdValue < 20) return

                const isStable = profile?.symbol === 'USDC' || profile?.symbol === 'USDT'
                importedPositions.push({
                    id: `wallet-${row.mint}`,
                    label: profile?.label ?? `Token ${shortenMint(row.mint)}`,
                    symbol: profile?.symbol ?? shortenMint(row.mint),
                    protocol: profile?.protocol ?? 'wallet',
                    kind: profile?.kind ?? 'token',
                    usdValue: Math.round(usdValue),
                    collateralFactor: 0,
                    volatility: profile?.volatility ?? (isStable ? 8 : 75),
                    liquidityScore: profile?.liquidityScore ?? (isStable ? 94 : 62),
                })
            })

            importedPositions.sort((a, b) => b.usdValue - a.usdValue)

            if (!importedPositions.length) {
                applyTemplate('balanced-starter')
                setImportStatus('No sizable balances detected, so we loaded the Balanced Starter template as fallback.')
                return
            }

            const topPositions = importedPositions.slice(0, 8)
            setPositions(topPositions)
            setSelectedTemplateId(null)
            setResult(null)
            setImportStatus(`Imported ${topPositions.length} positions from wallet balances.`)
        } catch {
            applyTemplate('balanced-starter')
            setError('Wallet import failed, so we loaded a starter template. You can still run scenarios immediately.')
        } finally {
            setImportingWallet(false)
        }
    }

    return (
        <div className="min-h-screen text-zinc-100 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.2),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
            <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 md:px-6 md:py-14">
                <header className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Aegis War Room</p>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight">Stress Test Your Solana Portfolio in 60 Seconds</h1>
                    <p className="text-zinc-300 max-w-3xl">
                        Connect a wallet or use a template, pick a market shock, and get plain-English actions to reduce downside risk.
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
                    <div className="mt-4 rounded-xl bg-zinc-900/65 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Quick glossary</p>
                        <p className="mt-2 text-xs text-zinc-400">
                            Drawdown = portfolio drop during stress. Liquidity = how easily you can exit. Forced close risk = probability of liquidation if collateral weakens.
                        </p>
                    </div>
                    <div className="mt-3 rounded-xl bg-cyan-300/10 p-3 ring-1 ring-cyan-200/20">
                        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">Wallet import</p>
                        <p className="mt-2 text-xs text-zinc-300">
                            Connect a wallet, then click Import Wallet Balances to auto-fill SOL + largest token positions. If nothing is detected, a starter template is loaded.
                        </p>
                    </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 rounded-2xl bg-zinc-900/45 p-5 backdrop-blur-md space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-lg">Your Current Holdings</h2>
                            <span className="text-xs text-zinc-400">Total: {formatCurrency(totalValue)}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <WalletButton />
                            <button
                                type="button"
                                onClick={importFromWallet}
                                disabled={!wallet.publicKey || importingWallet}
                                className="inline-flex items-center gap-2 rounded-lg border border-cyan-200/30 bg-cyan-100/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {importingWallet ? 'Importing...' : 'Import Wallet Balances'}
                            </button>
                            {!wallet.publicKey && (
                                <span className="text-xs text-zinc-400">Connect wallet to import live balances.</span>
                            )}
                        </div>

                        {importStatus && (
                            <p className="rounded-lg bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300">{importStatus}</p>
                        )}

                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-zinc-400">Quick-start templates</p>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                {PORTFOLIO_TEMPLATES.map((template) => (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => applyTemplate(template.id)}
                                        className={`rounded-lg border px-3 py-2 text-left transition ${selectedTemplateId === template.id
                                            ? 'border-cyan-200/60 bg-cyan-400/15 text-cyan-100'
                                            : 'border-zinc-700/70 bg-zinc-900/70 text-zinc-300 hover:border-zinc-500'
                                            }`}
                                    >
                                        <p className="text-sm font-semibold">{template.title}</p>
                                        <p className="mt-1 text-xs text-zinc-400">{template.summary}</p>
                                    </button>
                                ))}
                            </div>
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
                                label="Potential One-Day Loss"
                                value={formatCurrency(result.summary.valueAtRiskUsd)}
                                helper="How much value you could lose in this stress event."
                                accent="text-rose-300"
                            />
                            <MetricCard
                                label="Potential Drop"
                                value={formatPercent(result.summary.projectedDrawdownPct)}
                                helper="Portfolio decline percentage in this scenario."
                                accent="text-rose-300"
                            />
                        </div>

                        <div className="rounded-2xl bg-zinc-900/60 p-5">
                            <h3 className="font-bold">What this means in practice</h3>
                            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3 text-sm">
                                <div className="rounded-lg bg-zinc-900/70 p-3 text-zinc-300">
                                    If this happened tomorrow, modeled portfolio value may move to about{' '}
                                    <span className="font-semibold text-zinc-100">{formatCurrency(result.summary.projectedValueUsd)}</span>.
                                </div>
                                <div className="rounded-lg bg-zinc-900/70 p-3 text-zinc-300">
                                    Highest risk driver right now: <span className="font-semibold text-zinc-100">{topDrivers[0]?.key ?? 'overall market risk'}</span>.
                                </div>
                                <div className="rounded-lg bg-zinc-900/70 p-3 text-zinc-300">
                                    First priority is usually to reduce positions tied to <span className="font-semibold text-zinc-100">{topDrivers[0]?.key ?? 'the largest risk source'}</span>.
                                </div>
                            </div>
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
