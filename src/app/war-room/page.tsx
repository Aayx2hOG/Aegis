'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Shield, Activity, Info } from 'lucide-react'
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { WalletButton } from '@/components/solana/solana-provider'
import { useCluster } from '@/components/cluster/cluster-data-access'
import { useMultiChain } from '@/components/chain/chain-provider'
import { ChainEnvironment } from '@/lib/chain/types'
import { useSolanaProtocols } from '@/hooks/use-defillama'
import { normalizeProtocolSlug, resolveProtocolFromList } from '@/shared/protocol/slug-resolver'
import {
    POSITION_SCALE,
    POSITION_MIN_USD,
    POSITION_MAX_USD,
    VOL_BASE,
    VOL_INDEX_MULT,
    VOL_MIN,
    VOL_MAX,
    LIQUIDITY_BASE,
    LIQUIDITY_LOG_MULT,
    LIQUIDITY_INDEX_PENALTY,
    LIQUIDITY_MIN,
    LIQUIDITY_MAX,
    COLLATERAL_BASE,
    COLLATERAL_TVL_CAP,
    COLLATERAL_TVL_MAX_ADJUST,
    COLLATERAL_INDEX_PENALTY,
    COLLATERAL_MIN,
    COLLATERAL_MAX,
    UI_DISCLAIMER,
} from '@/shared/config/war-room-config'
import { createSampleBasket } from '@/shared/war-room-sample'
import type { PortfolioPosition, RiskBreakdown, ScenarioConfig, SimulationResult } from '@/shared/types'
import type { SolanaProtocol } from '@/shared/types'

type ScenarioPreset = ScenarioConfig & {
    beginnerLabel: string
    beginnerSummary: string
}

// templates removed for simplicity

type TokenProfile = {
    symbol: string
    label: string
    protocol: string
    kind: PortfolioPosition['kind']
    volatility: number
    liquidityScore: number
    fallbackPriceUsd: number
}

type ComparativeChain = {
    name: string
    label: string
    baseRisk: number
    marketSensitivity: number
    liquiditySensitivity: number
    exploitSensitivity: number
    bridgeSensitivity: number
    posture: 'best' | 'balanced' | 'cautious'
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

const COMPARATIVE_CHAINS: ComparativeChain[] = [
    {
        name: 'solana',
        label: 'Solana',
        baseRisk: 42,
        marketSensitivity: 0.42,
        liquiditySensitivity: 0.34,
        exploitSensitivity: 0.26,
        bridgeSensitivity: 0.12,
        posture: 'balanced',
    },
    {
        name: 'ethereum',
        label: 'Ethereum',
        baseRisk: 34,
        marketSensitivity: 0.34,
        liquiditySensitivity: 0.18,
        exploitSensitivity: 0.18,
        bridgeSensitivity: 0.08,
        posture: 'best',
    },
    {
        name: 'arbitrum',
        label: 'Arbitrum',
        baseRisk: 38,
        marketSensitivity: 0.36,
        liquiditySensitivity: 0.24,
        exploitSensitivity: 0.22,
        bridgeSensitivity: 0.22,
        posture: 'balanced',
    },
    {
        name: 'base',
        label: 'Base',
        baseRisk: 31,
        marketSensitivity: 0.3,
        liquiditySensitivity: 0.2,
        exploitSensitivity: 0.2,
        bridgeSensitivity: 0.14,
        posture: 'best',
    },
]

function selectLiveProtocolBasket(protocols: SolanaProtocol[], focusedProtocol?: string, limit = 4): SolanaProtocol[] {
    const normalizedFocus = normalizeProtocolSlug(focusedProtocol ?? '')
    const sorted = [...protocols].sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
    const focus = normalizedFocus ? resolveProtocolFromList(normalizedFocus, sorted) : undefined
    const remaining = sorted.filter((protocol) => protocol.slug !== focus?.slug)

    return [focus, ...remaining].filter((protocol): protocol is SolanaProtocol => Boolean(protocol)).slice(0, limit)
}

function getProtocolSymbol(protocol: SolanaProtocol): string {
    const symbol = protocol.name
        .split(/[-\s/]+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join('')

    return (symbol || protocol.slug.slice(0, 6)).toUpperCase()
}

function derivePositionUsdValue(protocol: SolanaProtocol, index: number): number {
    const tvl = protocol.tvl ?? 0
    const scale = POSITION_SCALE[index] ?? POSITION_SCALE[POSITION_SCALE.length - 1]
    return Math.max(POSITION_MIN_USD, Math.min(POSITION_MAX_USD, Math.round(tvl * scale)))
}

function deriveVolatility(protocol: SolanaProtocol, index: number): number {
    const change = Math.abs(protocol.change_1d ?? 0) * 1.5 + Math.abs(protocol.change_7d ?? 0) * 0.5
    return Math.round(clamp(VOL_BASE + change + index * VOL_INDEX_MULT, VOL_MIN, VOL_MAX))
}

function deriveLiquidityScore(protocol: SolanaProtocol, index: number): number {
    const tvl = Math.max(1, protocol.tvl ?? 1)
    const score = LIQUIDITY_BASE + Math.log10(tvl) * LIQUIDITY_LOG_MULT - index * LIQUIDITY_INDEX_PENALTY
    return Math.round(clamp(score, LIQUIDITY_MIN, LIQUIDITY_MAX))
}

function deriveCollateralFactor(protocol: SolanaProtocol, index: number): number {
    const tvl = protocol.tvl ?? 0
    const score = COLLATERAL_BASE + Math.min(tvl / COLLATERAL_TVL_CAP, COLLATERAL_TVL_MAX_ADJUST) - index * COLLATERAL_INDEX_PENALTY
    return Number(clamp(score, COLLATERAL_MIN, COLLATERAL_MAX).toFixed(2))
}

function buildPositionFromProtocol(protocol: SolanaProtocol, index: number): PortfolioPosition {
    return {
        id: protocol.slug,
        label: index === 0 ? `${protocol.name} Anchor` : protocol.name,
        symbol: getProtocolSymbol(protocol),
        protocol: protocol.slug,
        kind: 'token',
        usdValue: derivePositionUsdValue(protocol, index),
        collateralFactor: index === 0 ? deriveCollateralFactor(protocol, index) : 0,
        volatility: deriveVolatility(protocol, index),
        liquidityScore: deriveLiquidityScore(protocol, index),
    }
}



function buildPositionsForProtocol(protocols: SolanaProtocol[], focusedProtocol?: string): PortfolioPosition[] {
    const basket = selectLiveProtocolBasket(protocols, focusedProtocol, 4)
    return basket.map((protocol, index) => buildPositionFromProtocol(protocol, index))
}

// portfolio templates removed for simplicity

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function getPostureLabel(score: number): string {
    if (score >= 70) return 'Cautious'
    if (score >= 48) return 'Balanced'
    return 'Best'
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

function isTestNetworkContext(network?: string, endpoint?: string): boolean {
    const normalizedNetwork = (network ?? '').toLowerCase()
    const normalizedEndpoint = (endpoint ?? '').toLowerCase()

    if (normalizedNetwork.includes('devnet') || normalizedNetwork.includes('testnet')) return true
    if (normalizedEndpoint.includes('devnet') || normalizedEndpoint.includes('testnet')) return true
    if (normalizedEndpoint.includes('localhost') || normalizedEndpoint.includes('127.0.0.1')) return true

    return false
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
    const { cluster } = useCluster()
    const { activeChain } = useMultiChain()
    const focusedProtocol = searchParams.get('protocol')?.trim().toLowerCase()
    const { data: solanaProtocols = [] } = useSolanaProtocols()

    const [positions, setPositions] = useState<PortfolioPosition[]>([])
    const [selectedScenarioIdx, setSelectedScenarioIdx] = useState(0)
    const [result, setResult] = useState<SimulationResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [importingWallet, setImportingWallet] = useState(false)
    const [importStatus, setImportStatus] = useState<string | null>(null)
    const [portfolioSource, setPortfolioSource] = useState<'live' | 'wallet' | 'custom'>('live')
    const [selectedChainName, setSelectedChainName] = useState<string | null>(null)

    const livePositions = useMemo(
        () => buildPositionsForProtocol(solanaProtocols, focusedProtocol),
        [focusedProtocol, solanaProtocols]
    )
    // templates removed for simplicity

    const totalValue = useMemo(() => positions.reduce((acc, p) => acc + p.usdValue, 0), [positions])
    const selectedScenario = SCENARIOS[selectedScenarioIdx]
    const topDrivers = useMemo(
        () => (result ? getTopRiskDrivers(result.riskBreakdown) : []),
        [result]
    )
    const isTestNetworkWallet = useMemo(() => {
        if (activeChain.name === 'solana-mainnet' || activeChain.environment === ChainEnvironment.Mainnet) {
            return false
        }
        if (activeChain.type === 'solana') {
            return isTestNetworkContext(cluster.network, cluster.endpoint)
        }
        return true
    }, [activeChain, cluster])

    useEffect(() => {
        if (portfolioSource !== 'live' || livePositions.length === 0) return
        setPositions(livePositions)
        setResult(null)
    }, [livePositions, portfolioSource])

    const comparativeChains = useMemo(() => {
        return COMPARATIVE_CHAINS.map((chain) => {
            const chainFocusBoost = focusedProtocol ? (chain.name === 'solana' ? 8 : chain.name === 'ethereum' ? 2 : 4) : 0
            const spreadPenalty = selectedScenario.type === 'smart-contract-incident' ? chain.exploitSensitivity * 18 : 0
            const bridgePenalty = chain.bridgeSensitivity * (selectedScenario.liquidityDropPct * 0.35 + selectedScenario.protocolExploitSeverity * 0.2)
            const score = clamp(
                chain.baseRisk +
                selectedScenario.marketShockPct * chain.marketSensitivity +
                selectedScenario.liquidityDropPct * chain.liquiditySensitivity +
                selectedScenario.protocolExploitSeverity * chain.exploitSensitivity +
                bridgePenalty +
                chainFocusBoost +
                spreadPenalty,
                0,
                100
            )

            return {
                ...chain,
                score,
                postureLabel: getPostureLabel(score),
                recommendation:
                    score >= 70
                        ? 'Keep position size light and hedge duration.'
                        : score >= 48
                            ? 'Monitor closely and prefer stable collateral.'
                            : 'This chain is a viable deployment venue.'
            }
        }).sort((a, b) => a.score - b.score)
    }, [focusedProtocol, selectedScenario])

    const activeSelectedChainName = selectedChainName ?? comparativeChains[0]?.name ?? 'solana'

    const selectedChain = useMemo(() => {
        return comparativeChains.find(c => c.name === activeSelectedChainName)
    }, [comparativeChains, activeSelectedChainName])

    const selectedChainBreakdown = useMemo(() => {
        if (!selectedChain) return null
        const chainFocusBoost = focusedProtocol ? (selectedChain.name === 'solana' ? 8 : selectedChain.name === 'ethereum' ? 2 : 4) : 0
        const marketPenalty = selectedScenario.marketShockPct * selectedChain.marketSensitivity
        const liquidityPenalty = selectedScenario.liquidityDropPct * selectedChain.liquiditySensitivity
        const exploitPenalty = selectedScenario.protocolExploitSeverity * selectedChain.exploitSensitivity
        const spreadPenalty = selectedScenario.type === 'smart-contract-incident' ? selectedChain.exploitSensitivity * 18 : 0
        const bridgePenalty = selectedChain.bridgeSensitivity * (selectedScenario.liquidityDropPct * 0.35 + selectedScenario.protocolExploitSeverity * 0.2)
        
        return {
            baseRisk: selectedChain.baseRisk,
            marketPenalty: Math.round(marketPenalty * 10) / 10,
            liquidityPenalty: Math.round(liquidityPenalty * 10) / 10,
            exploitPenalty: Math.round((exploitPenalty + spreadPenalty) * 10) / 10,
            bridgePenalty: Math.round(bridgePenalty * 10) / 10,
            focusPenalty: chainFocusBoost
        }
    }, [selectedChain, focusedProtocol, selectedScenario])

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
        setPortfolioSource('custom')
        setPositions((current) =>
            current.map((position) =>
                position.id === id ? { ...position, usdValue: Number.isNaN(usdValue) ? 0 : Math.max(0, usdValue) } : position
            )
        )
    }

    // applyTemplate removed

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
                setPositions([])
                setPortfolioSource('custom')
                setImportStatus('No sizable balances detected. Connect a wallet or load a live market basket.')
                return
            }

            const topPositions = importedPositions.slice(0, 8)
            setPositions(topPositions)
            setResult(null)
            setPortfolioSource('wallet')
            setImportStatus(`Imported ${topPositions.length} positions from wallet balances.`)
        } catch {
            setPositions([])
            setPortfolioSource('custom')
            setError('Wallet import failed. Connect wallet or load a live market basket.')
        } finally {
            setImportingWallet(false)
        }
    }

    return (
        <div className="min-h-screen text-zinc-100 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.2),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
            {/* Background Decor */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[8%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />
                <div className="absolute top-[18%] -right-[8%] h-[32%] w-[32%] rounded-full bg-blue-500/10 blur-[100px]" />
            </div>

            <div className="relative mx-auto max-w-6xl space-y-8 px-4 py-10 md:px-6 md:py-14">
                <header className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Aegis War Room</p>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight">Stress Test Your Solana Portfolio in 60 Seconds</h1>
                    <p className="text-zinc-300 max-w-3xl">
                        Connect a wallet or use a template, pick a market shock, and get plain-English actions to reduce downside risk.
                    </p>
                    <div className="rounded-md bg-yellow-900/10 border border-yellow-800/20 p-3 text-xs text-yellow-200">
                        {UI_DISCLAIMER}
                    </div>
                    {isTestNetworkWallet && (
                        <div className="rounded-md border border-amber-300/25 bg-amber-400/10 p-3 text-sm text-amber-100">
                            You are connected to a test network. USD values in this page are estimates from market data, not real dollars in your wallet.
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                        {focusedProtocol && (
                            <div className="inline-flex items-center gap-2 rounded-lg bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-100">
                                Focused Protocol: {focusedProtocol}
                            </div>
                        )}
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

                <section className="rounded-2xl bg-zinc-900/40 p-6 border border-zinc-800/80 backdrop-blur-md space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-cyan-400" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Comparative War-Room</p>
                            </div>
                            <h2 className="text-xl font-bold mt-1 text-white">Chain-by-Chain Deployment Security Analysis</h2>
                        </div>
                        <div className="rounded-full bg-zinc-950/70 border border-zinc-800/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                            {focusedProtocol ? `Focus Protocol: ${focusedProtocol}` : 'Global Portfolio view'}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {comparativeChains.map((chain) => {
                            const isSelected = chain.name === activeSelectedChainName;
                            const score = chain.score;
                            const label = chain.postureLabel;

                            const theme = label === 'Best' 
                                ? { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', bar: 'bg-emerald-400 shadow-[0_0_8px_#34d399]' }
                                : label === 'Balanced'
                                ? { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20', bar: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' }
                                : { text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/20', bar: 'bg-rose-400 shadow-[0_0_8px_#f87171]' };

                            return (
                                <div
                                    key={chain.name}
                                    onClick={() => setSelectedChainName(chain.name)}
                                    className={`relative overflow-hidden rounded-xl border p-4 backdrop-blur-sm transition-all duration-300 cursor-pointer select-none ${
                                        isSelected
                                            ? 'border-cyan-400/40 bg-cyan-950/15 shadow-md shadow-cyan-950/40 translate-y-[-2px] ring-1 ring-cyan-400/20'
                                            : 'border-zinc-800/60 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900/30'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-bold text-white capitalize">{chain.label}</p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">Deployment posture</p>
                                        </div>
                                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${theme.bg} ${theme.text} ${theme.border} border`}>
                                            {label}
                                        </span>
                                    </div>

                                    <div className="mt-4">
                                        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                                            <span>Risk Level</span>
                                            <span className="font-semibold text-zinc-200">{score.toFixed(0)}/100</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-zinc-800/60 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${theme.bar}`} style={{ width: `${score}%` }} />
                                        </div>
                                    </div>

                                    <p className="mt-3 text-[11px] text-zinc-400 leading-relaxed min-h-[32px]">{chain.recommendation}</p>
                                    
                                    {isSelected && (
                                        <div className="absolute right-0 bottom-0 w-2 h-2 bg-cyan-400 rounded-tl-md" />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {selectedChain && selectedChainBreakdown && (
                        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-5 space-y-4 animate-in fade-in duration-300">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/40 pb-3">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-cyan-400" />
                                    <h3 className="text-sm font-bold text-white capitalize">{selectedChain.label} Detailed Risk Factor Attribution</h3>
                                </div>
                                <span className="text-xs text-zinc-400">
                                    Total Risk Score: <span className="font-bold text-white">{selectedChain.score.toFixed(0)}</span>
                                </span>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                <div className="space-y-4 md:col-span-2">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <BreakdownBar 
                                            label="Base Infrastructure Risk" 
                                            value={selectedChainBreakdown.baseRisk} 
                                            max={100}
                                            tooltip="Inherent security, validator sets, and consensus maturity."
                                        />
                                        <BreakdownBar 
                                            label="Market Volatility Impact" 
                                            value={selectedChainBreakdown.marketPenalty} 
                                            max={42} 
                                            tooltip="Chain's historical price fluctuations coupled with current scenario price drops."
                                        />
                                        <BreakdownBar 
                                            label="Liquidity Shock Penalty" 
                                            value={selectedChainBreakdown.liquidityPenalty} 
                                            max={34} 
                                            tooltip="Risk of capital flight and slippage penalties on this network during liquidations."
                                        />
                                        <BreakdownBar 
                                            label="Exploit & Smart Contract Risk" 
                                            value={selectedChainBreakdown.exploitPenalty} 
                                            max={45} 
                                            tooltip="Susceptibility to smart contract issues, exploit history, or systemic vulnerability."
                                        />
                                        <BreakdownBar 
                                            label="Cross-Chain Bridge Vulnerability" 
                                            value={selectedChainBreakdown.bridgePenalty} 
                                            max={22} 
                                            tooltip="Dependence on cross-chain assets and exposure to bridge exploits/freezes."
                                        />
                                        <BreakdownBar 
                                            label="Focused Protocol Concentration" 
                                            value={selectedChainBreakdown.focusPenalty} 
                                            max={10} 
                                            tooltip="Additional risk weight based on your current asset exposure on this specific network."
                                        />
                                    </div>
                                </div>

                                <div className="rounded-lg bg-zinc-900/40 p-4 border border-zinc-800/40 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                                        <Info className="h-3.5 w-3.5" />
                                        <span>Aegis Deployment Playbook</span>
                                    </div>
                                    <p className="text-xs text-zinc-300 leading-relaxed">
                                        Under the <span className="font-semibold text-white">{selectedScenario.title}</span> scenario, {selectedChain.label} exhibits a risk factor of <span className="font-semibold text-white">{selectedChain.score.toFixed(0)}</span>.
                                    </p>
                                    <div className="text-[11px] text-zinc-400 space-y-2 pt-1 border-t border-zinc-800/60">
                                        {selectedChain.name === 'solana' && (
                                            <>
                                                <p className="font-semibold text-zinc-300">Solana Recommendations:</p>
                                                <p>• Highly responsive for fast exits and de-risking.</p>
                                                <p>• Watch out for network congestion during panic events.</p>
                                                <p>• Prefer LSTs (like JitoSOL) or direct SOL over exotic pools.</p>
                                            </>
                                        )}
                                        {selectedChain.name === 'ethereum' && (
                                            <>
                                                <p className="font-semibold text-zinc-300">Ethereum Recommendations:</p>
                                                <p>• Extremely secure settlement Layer 1; lowest exploit vulnerability.</p>
                                                <p>• High gas fees might lock smaller portfolios during selloffs.</p>
                                                <p>• Suitable for parking large stable balances.</p>
                                            </>
                                        )}
                                        {selectedChain.name === 'arbitrum' && (
                                            <>
                                                <p className="font-semibold text-zinc-300">Arbitrum Recommendations:</p>
                                                <p>• Highly optimized L2 rollup, low fees and high throughput.</p>
                                                <p>• Monitor bridge exit times and sequencer liveness.</p>
                                                <p>• Keep liquidity in main blue-chip pools.</p>
                                            </>
                                        )}
                                        {selectedChain.name === 'base' && (
                                            <>
                                                <p className="font-semibold text-zinc-300">Base Recommendations:</p>
                                                <p>• Excellent transaction speed and ecosystem expansion.</p>
                                                <p>• Ensure secondary exit paths are pre-configured.</p>
                                                <p>• Watch centralization indicators and sequencer status.</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 rounded-2xl bg-zinc-900/45 p-5 backdrop-blur-md space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-lg">Your Current Holdings</h2>
                            <div className="flex items-center gap-3">
                                {positions.length === 0 ? (
                                    <span className="text-xs text-zinc-400">Total: —</span>
                                ) : (
                                    <span className="text-xs text-zinc-400">{isTestNetworkWallet ? 'Estimated total*: ' : 'Total: '}{formatCurrency(totalValue)}</span>
                                )}
                                {portfolioSource === 'live' && (
                                    <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs font-semibold text-yellow-300">
                                        Sample data
                                    </span>
                                )}
                            </div>
                        </div>

                        {portfolioSource === 'live' && (
                            <div className="text-xs text-zinc-400 leading-normal bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/40 flex items-start gap-2">
                                <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                                <div>
                                    <strong>Simulated Live Basket:</strong> The total value is derived by scaling down the real-world TVL of top Solana protocols and capping each at <strong>$220,000</strong> to avoid displaying unrealistic balances. You can type in your own custom amounts below.
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                            <WalletButton />
                            <button
                                type="button"
                                aria-pressed={portfolioSource === 'wallet'}
                                onClick={importFromWallet}
                                disabled={!wallet.publicKey || importingWallet}
                                className={
                                    `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide ` +
                                    (portfolioSource === 'wallet'
                                        ? 'border border-cyan-200/30 bg-cyan-100/10 text-cyan-100'
                                        : 'border border-zinc-700/60 bg-zinc-900/70 text-zinc-300') +
                                    (!wallet.publicKey || importingWallet ? ' disabled:cursor-not-allowed disabled:opacity-50' : '')
                                }
                            >
                                {importingWallet ? 'Importing...' : 'Import Wallet Balances'}
                            </button>
                            <button
                                type="button"
                                aria-pressed={portfolioSource === 'live'}
                                onClick={() => {
                                    if (!livePositions || livePositions.length === 0) {
                                        setImportStatus('Live market data not available right now.')
                                        return
                                    }
                                    const sample = createSampleBasket(livePositions)
                                    setPositions(sample)
                                    setPortfolioSource('live')
                                    setImportStatus('Loaded live market basket (sample).')
                                }}
                                className={
                                    `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide ` +
                                    (portfolioSource === 'live'
                                        ? 'border border-cyan-200/30 bg-cyan-100/10 text-cyan-100'
                                        : 'border-zinc-700/60 bg-zinc-900/70 text-zinc-300 hover:border-zinc-500')
                                }
                            >
                                Load Live Market Basket
                            </button>
                            {!wallet.publicKey && (
                                <span className="text-xs text-zinc-400">Connect wallet to import live balances.</span>
                            )}
                        </div>

                        {importStatus && (
                            <p className="rounded-lg bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300">{importStatus}</p>
                        )}
                        {isTestNetworkWallet && (
                            <p className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                                * Estimated values are for learning and simulation only on test networks.
                            </p>
                        )}

                        {/* Templates removed for simplicity */}

                        {positions.length === 0 ? (
                            <div className="text-center py-8 px-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20">
                                <Info className="h-8 w-8 mx-auto text-zinc-400 mb-2" />
                                <p className="text-xs font-semibold text-zinc-300">No holdings loaded</p>
                                <p className="text-[11px] text-zinc-500 mt-1 max-w-xs mx-auto">
                                    Click "Load Live Market Basket" or connect a wallet and import your balances to get started.
                                </p>
                            </div>
                        ) : (
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
                        )}
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
                                    <p className="text-sm font-semibold">{scenario.title}</p>
                                    <p className="text-xs text-zinc-400 mt-1">Market -{scenario.marketShockPct}% • Liquidity -{scenario.liquidityDropPct}%</p>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={runSimulation}
                            disabled={loading || positions.length === 0 || totalValue === 0}
                            className="w-full rounded-xl bg-cyan-300 py-3 font-black tracking-wide text-zinc-950 transition hover:bg-cyan-200 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Running Simulation...' : (positions.length === 0 || totalValue === 0) ? 'Add Holdings to Simulate' : 'Show My Risk Outcome'}
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

                                <div className="pt-2 space-y-2 text-xs text-zinc-300">
                                    <p className="font-semibold text-zinc-200">Top risk drivers</p>
                                    {topDrivers.map((driver) => (
                                        <p key={driver.key}>
                                            {driver.key}: <span className={getRiskBand(driver.value).color}>{driver.value}</span>
                                        </p>
                                    ))}
                                </div>
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

function BreakdownBar({
    label,
    value,
    max,
    tooltip,
}: {
    label: string
    value: number
    max: number
    tooltip: string
}) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))
    return (
        <div className="rounded-lg bg-zinc-950/50 border border-zinc-900/60 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300">{label}</span>
                <span className="font-bold text-zinc-100">{value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-900/60 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full" style={{ width: `${percentage}%` }} />
            </div>
            <p className="text-[10px] text-zinc-500 leading-tight">{tooltip}</p>
        </div>
    )
}
