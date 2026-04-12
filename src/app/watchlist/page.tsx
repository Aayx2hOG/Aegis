'use client';

import { useMemo } from 'react';
import { useWatchlist } from '@/hooks/use-watchlist';
import { useSolanaProtocols } from '@/hooks/use-defillama';
import Link from 'next/link';
import { ExternalLink, Star, Trash2, ArrowLeft, ShieldAlert, AlertTriangle, Activity } from 'lucide-react';
import type { SolanaProtocol } from '@/lib/types/protocol';
import { resolveProtocolFromList } from '@/lib/protocol/slug-resolver';

function formatUsd(value: number | null | undefined): string {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);
}

function formatPct(value: number | null | undefined): string {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

function riskState(protocol?: SolanaProtocol): { label: string; tone: string; isRisk: boolean } {
    if (!protocol) {
        return { label: 'No Market Data', tone: 'bg-zinc-800 text-zinc-300', isRisk: false };
    }

    const d1 = protocol.change_1d ?? 0;
    const d7 = protocol.change_7d ?? 0;

    if (d1 <= -10 || d7 <= -20) {
        return { label: 'Critical', tone: 'bg-red-500/20 text-red-200', isRisk: true };
    }
    if (d1 <= -5 || d7 <= -12) {
        return { label: 'Watch', tone: 'bg-amber-500/20 text-amber-200', isRisk: true };
    }
    return { label: 'Stable', tone: 'bg-emerald-500/20 text-emerald-200', isRisk: false };
}

export default function WatchlistPage() {
    const { watchlist, isLoading, isConnected, remove, needsInit, initialize, isInitializing } = useWatchlist();
    const { data: protocols = [], isLoading: marketLoading } = useSolanaProtocols();

    const watchedWithMarket = useMemo(
        () => watchlist.map((slug) => ({ slug, market: resolveProtocolFromList(slug, protocols) })),
        [watchlist, protocols]
    );

    const riskyCount = useMemo(
        () => watchedWithMarket.filter(({ market }) => riskState(market).isRisk).length,
        [watchedWithMarket]
    );

    return (
        <div className="min-h-screen text-zinc-100 selection:bg-cyan-400/20 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.2),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[8%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />
                <div className="absolute top-[18%] -right-[8%] h-[32%] w-[32%] rounded-full bg-blue-500/10 blur-[100px]" />
            </div>

            <div className="relative mx-auto max-w-5xl space-y-10 px-4 py-10 md:space-y-12 md:px-6 md:py-14">
                <header className="flex flex-col justify-between gap-6 overflow-hidden md:flex-row md:items-end">
                    <div className="space-y-4">
                        <Link
                            href="/research"
                            className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:text-cyan-200"
                        >
                            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                            Back to Research
                        </Link>
                        <h1 className="text-5xl font-black tracking-tight text-white">
                            My <span className="text-cyan-200">Watchlist</span>
                        </h1>
                        <p className="max-w-lg text-zinc-300">
                            Tracked Solana protocols and saved research briefs. On-chain verified.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {isConnected && needsInit && (
                            <button
                                onClick={() => initialize()}
                                disabled={isInitializing}
                                className="flex items-center gap-2 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-black text-zinc-950 shadow-lg shadow-cyan-400/20 transition-all hover:bg-cyan-200"
                            >
                                {isInitializing ? <span className="loading loading-spinner loading-xs" /> : 'Initialize Watchlist'}
                            </button>
                        )}
                        <div className="rounded-lg bg-zinc-900/70 px-4 py-2 text-[10px] font-black uppercase tracking-tighter text-zinc-400">
                            {watchlist.length} / 20 Protocols
                        </div>
                    </div>
                </header>

                {!isConnected ? (
                    <div className="glass-card flex flex-col items-center justify-center space-y-6 rounded-3xl bg-zinc-900/35 p-20 text-center backdrop-blur-xl">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800/50">
                            <Star className="h-10 w-10 text-zinc-600" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-white">Wallet Not Connected</h3>
                            <p className="mx-auto max-w-xs text-zinc-400">Connect your Solana wallet to access your on-chain watchlist.</p>
                        </div>
                    </div>
                ) : isLoading ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-48 animate-pulse rounded-2xl bg-zinc-900/35" />
                        ))}
                    </div>
                ) : watchlist.length === 0 ? (
                    <div className="glass-card flex flex-col items-center justify-center space-y-6 rounded-3xl bg-zinc-900/35 p-20 text-center backdrop-blur-xl">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800/50 text-zinc-600">★</div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-white">Watchlist Empty</h3>
                            <p className="mx-auto max-w-xs text-zinc-400">Start by adding protocols from the research page.</p>
                            <Link href="/research" className="mt-4 inline-block font-bold text-cyan-200 hover:underline">
                                Go to Research &rarr;
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        <section className="rounded-2xl bg-zinc-900/45 p-5 backdrop-blur-xl">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Market Risk Monitor</p>
                                    <h2 className="text-xl font-black text-white">Watchlist Health Snapshot</h2>
                                    <p className="text-sm text-zinc-300">
                                        {marketLoading
                                            ? 'Refreshing live protocol metrics...'
                                            : `${riskyCount} protocol${riskyCount === 1 ? '' : 's'} currently require attention based on 24h/7d momentum.`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-zinc-950/70 px-3 py-2 text-xs font-semibold text-zinc-300">
                                    <Activity className="h-4 w-4 text-cyan-200" />
                                    {marketLoading ? 'Updating' : 'Live from DeFiLlama'}
                                </div>
                            </div>

                            {!marketLoading && riskyCount > 0 && (
                                <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                    <AlertTriangle className="h-4 w-4" />
                                    {riskyCount} watchlist protocol{riskyCount === 1 ? '' : 's'} crossed caution thresholds. Review and war-game scenarios.
                                </div>
                            )}
                        </section>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {watchedWithMarket.map(({ slug, market }) => (
                                <ProtocolCard key={slug} slug={slug} market={market} onRemove={() => remove(slug)} />
                            ))}
                        </div>
                    </>
                )}
            </div>

            <style jsx global>{`
        .glass-card {
          backdrop-filter: blur(20px);
        }
      `}</style>
        </div>
    );
}

function ProtocolCard({ slug, market, onRemove }: { slug: string; market?: SolanaProtocol; onRemove: () => void }) {
    const status = riskState(market);

    return (
        <div className="group glass-card relative flex min-h-56 flex-col justify-between overflow-hidden rounded-2xl bg-zinc-900/45 p-6 transition-all hover:bg-zinc-900/65">
            <div className="absolute -right-10 -top-10 h-24 w-24 bg-cyan-300/10 blur-3xl transition-colors group-hover:bg-cyan-300/20" />

            <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Protocol</div>
                <h3 className="overflow-hidden text-ellipsis text-2xl font-black capitalize text-white">{slug}</h3>
                <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${status.tone}`}>
                    {status.label}
                </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-zinc-950/60 p-3 text-xs">
                <div>
                    <p className="text-zinc-500">TVL</p>
                    <p className="font-semibold text-zinc-100">{formatUsd(market?.tvl)}</p>
                </div>
                <div>
                    <p className="text-zinc-500">24h</p>
                    <p className={`font-semibold ${(market?.change_1d ?? 0) < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                        {formatPct(market?.change_1d)}
                    </p>
                </div>
                <div>
                    <p className="text-zinc-500">7d</p>
                    <p className={`font-semibold ${(market?.change_7d ?? 0) < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                        {formatPct(market?.change_7d)}
                    </p>
                </div>
                <div>
                    <p className="text-zinc-500">Category</p>
                    <p className="truncate font-semibold text-zinc-100">{market?.category ?? 'Unknown'}</p>
                </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
                <Link
                    href={`/research?q=${slug}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-200 transition-all hover:bg-zinc-700"
                >
                    Research <ExternalLink className="h-3 w-3" />
                </Link>
                <Link
                    href={`/war-room?protocol=${slug}`}
                    className="flex items-center justify-center gap-1 rounded-lg bg-cyan-300/20 px-3 py-2 text-xs font-bold text-cyan-100 transition-all hover:bg-cyan-300/30"
                    title="Run war-room simulation for this protocol"
                >
                    War <ShieldAlert className="h-3 w-3" />
                </Link>
                <button
                    onClick={onRemove}
                    className="rounded-lg bg-zinc-900/80 p-2 text-zinc-600 transition-all hover:bg-zinc-800 hover:text-red-400"
                    title="Remove from watchlist"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
