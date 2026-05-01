'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWatchlist } from '@/hooks/use-watchlist';
import { useSolanaProtocols } from '@/hooks/use-defillama';
import { useWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';
import { ExternalLink, Trash2, ArrowLeft, ShieldAlert, AlertTriangle, Activity } from 'lucide-react';
import type { SolanaProtocol } from '@/shared/types/protocol';
import { resolveProtocolFromList } from '@/shared/protocol/slug-resolver';
import { toast } from 'sonner';

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

type AlertMetric = 'CHANGE_1D' | 'CHANGE_7D';
type AlertDirection = 'BELOW' | 'ABOVE';

interface ResearchHistoryItem {
    id: string;
    protocolSlug: string;
    briefMarkdown: string;
    createdAt: string;
}

interface AlertRuleItem {
    id: string;
    protocolSlug: string;
    metric: AlertMetric;
    threshold: number;
    direction: AlertDirection;
    enabled: boolean;
    createdAt: string;
}

interface AlertEventItem {
    id: string;
    protocolSlug: string;
    metric: AlertMetric;
    threshold: number;
    direction: AlertDirection;
    currentValue: number;
    triggeredAt: string;
}

const ALERT_METRIC_LABEL: Record<AlertMetric, string> = {
    CHANGE_1D: '24h change',
    CHANGE_7D: '7d change',
};

export default function WatchlistPage() {
    const { watchlist, isLoading, isConnected, remove } = useWatchlist();
    const { data: protocols = [], isLoading: marketLoading } = useSolanaProtocols();
    const wallet = useWallet();
    const walletAddress = wallet.publicKey?.toBase58();

    const [history, setHistory] = useState<ResearchHistoryItem[]>([]);
    const [rules, setRules] = useState<AlertRuleItem[]>([]);
    const [events, setEvents] = useState<AlertEventItem[]>([]);
    const [dbStatus, setDbStatus] = useState<string | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [alertsLoading, setAlertsLoading] = useState(false);
    const [creatingRule, setCreatingRule] = useState(false);
    const [evaluatingAlerts, setEvaluatingAlerts] = useState(false);
    const [selectedProtocol, setSelectedProtocol] = useState('');
    const [selectedMetric, setSelectedMetric] = useState<AlertMetric>('CHANGE_1D');
    const [selectedDirection, setSelectedDirection] = useState<AlertDirection>('BELOW');
    const [threshold, setThreshold] = useState(-5);

    useEffect(() => {
        if (!watchlist.length) {
            setSelectedProtocol('');
            return;
        }
        setSelectedProtocol((current) => (current && watchlist.includes(current) ? current : watchlist[0]));
    }, [watchlist]);

    useEffect(() => {
        if (!walletAddress) {
            setHistory([]);
            setRules([]);
            setEvents([]);
            setDbStatus(null);
            return;
        }

        const currentWalletAddress = walletAddress;

        let cancelled = false;

        async function loadHistory() {
            setHistoryLoading(true);
            try {
                const res = await fetch(`/api/research/history?walletAddress=${encodeURIComponent(currentWalletAddress)}&limit=6`);
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as { error?: string } | null;
                    if (!cancelled) setDbStatus(body?.error ?? 'Research history unavailable.');
                    return;
                }
                const body = (await res.json()) as { runs: ResearchHistoryItem[] };
                if (!cancelled) {
                    setHistory(body.runs ?? []);
                    setDbStatus(null);
                }
            } catch {
                if (!cancelled) setDbStatus('Research history unavailable.');
            } finally {
                if (!cancelled) setHistoryLoading(false);
            }
        }

        async function loadAlerts() {
            setAlertsLoading(true);
            try {
                const res = await fetch(`/api/alerts/rules?walletAddress=${encodeURIComponent(currentWalletAddress)}`);
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as { error?: string } | null;
                    if (!cancelled) setDbStatus(body?.error ?? 'Alerts unavailable.');
                    return;
                }
                const body = (await res.json()) as { rules: AlertRuleItem[]; recentEvents: AlertEventItem[] };
                if (!cancelled) {
                    setRules(body.rules ?? []);
                    setEvents(body.recentEvents ?? []);
                    setDbStatus(null);
                }
            } catch {
                if (!cancelled) setDbStatus('Alerts unavailable.');
            } finally {
                if (!cancelled) setAlertsLoading(false);
            }
        }

        loadHistory();
        loadAlerts();

        return () => {
            cancelled = true;
        };
    }, [walletAddress]);

    async function createAlertRule() {
        if (!walletAddress || !selectedProtocol) return;
        const currentWalletAddress = walletAddress;
        setCreatingRule(true);
        try {
            const res = await fetch('/api/alerts/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: currentWalletAddress,
                    protocolSlug: selectedProtocol,
                    metric: selectedMetric,
                    direction: selectedDirection,
                    threshold,
                }),
            });

            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null;
                throw new Error(body?.error ?? 'Failed to create alert rule.');
            }

            toast.success('Alert rule created.');
            const refreshed = await fetch(`/api/alerts/rules?walletAddress=${encodeURIComponent(currentWalletAddress)}`);
            if (refreshed.ok) {
                const body = (await refreshed.json()) as { rules: AlertRuleItem[]; recentEvents: AlertEventItem[] };
                setRules(body.rules ?? []);
                setEvents(body.recentEvents ?? []);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create alert rule.');
        } finally {
            setCreatingRule(false);
        }
    }

    async function evaluateAlertsNow() {
        if (!walletAddress) return;
        const currentWalletAddress = walletAddress;
        setEvaluatingAlerts(true);
        try {
            const res = await fetch('/api/alerts/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: currentWalletAddress }),
            });

            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null;
                throw new Error(body?.error ?? 'Failed to evaluate alerts.');
            }

            const summary = (await res.json()) as { triggered: number; totalRules: number };
            toast.success(`Alert scan complete: ${summary.triggered} trigger(s) across ${summary.totalRules} rules.`);

            const refreshed = await fetch(`/api/alerts/rules?walletAddress=${encodeURIComponent(currentWalletAddress)}`);
            if (refreshed.ok) {
                const body = (await refreshed.json()) as { rules: AlertRuleItem[]; recentEvents: AlertEventItem[] };
                setRules(body.rules ?? []);
                setEvents(body.recentEvents ?? []);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to evaluate alerts.');
        } finally {
            setEvaluatingAlerts(false);
        }
    }

    async function setRuleEnabled(ruleId: string, enabled: boolean) {
        try {
            const res = await fetch(`/api/alerts/rules/${ruleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled }),
            });
            if (!res.ok) throw new Error('Failed to update rule status.');
            setRules((prev) => prev.map((rule) => (rule.id === ruleId ? { ...rule, enabled } : rule)));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update rule status.');
        }
    }

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
                        <div className="rounded-lg bg-zinc-900/70 px-4 py-2 text-[10px] font-black uppercase tracking-tighter text-zinc-400">
                            {watchlist.length} / 20 Protocols
                        </div>
                    </div>
                </header>

                {!isConnected && (
                    <div className="rounded-xl bg-zinc-900/55 px-4 py-3 text-xs text-zinc-300">
                        Guest mode is active. Your watchlist is saved locally in this browser. Connect a wallet to enable synced research history and alert automation.
                    </div>
                )}

                {isLoading ? (
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

                        {dbStatus && (
                            <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                                {dbStatus}
                            </div>
                        )}

                        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            {walletAddress ? (
                                <>
                                    <div className="rounded-2xl bg-zinc-900/45 p-5 backdrop-blur-xl">
                                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Alert Automation</p>
                                                <h2 className="text-xl font-black text-white">Rules & Triggers</h2>
                                            </div>
                                            <button
                                                onClick={evaluateAlertsNow}
                                                disabled={evaluatingAlerts || !walletAddress || rules.length === 0}
                                                className="rounded-lg bg-cyan-300/20 px-3 py-2 text-xs font-bold text-cyan-100 transition-all hover:bg-cyan-300/30 disabled:opacity-50"
                                            >
                                                {evaluatingAlerts ? 'Evaluating...' : 'Evaluate Now'}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <select
                                                value={selectedProtocol}
                                                onChange={(e) => setSelectedProtocol(e.target.value)}
                                                className="rounded-lg bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 outline-none ring-1 ring-zinc-800"
                                            >
                                                {watchlist.map((slug) => (
                                                    <option key={slug} value={slug}>
                                                        {slug}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                value={selectedMetric}
                                                onChange={(e) => setSelectedMetric(e.target.value as AlertMetric)}
                                                className="rounded-lg bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 outline-none ring-1 ring-zinc-800"
                                            >
                                                <option value="CHANGE_1D">24h % Change</option>
                                                <option value="CHANGE_7D">7d % Change</option>
                                            </select>
                                            <select
                                                value={selectedDirection}
                                                onChange={(e) => setSelectedDirection(e.target.value as AlertDirection)}
                                                className="rounded-lg bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 outline-none ring-1 ring-zinc-800"
                                            >
                                                <option value="BELOW">Below threshold</option>
                                                <option value="ABOVE">Above threshold</option>
                                            </select>
                                            <input
                                                type="number"
                                                value={threshold}
                                                onChange={(e) => setThreshold(Number(e.target.value))}
                                                className="rounded-lg bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 outline-none ring-1 ring-zinc-800"
                                                placeholder="Threshold"
                                            />
                                        </div>

                                        <button
                                            onClick={createAlertRule}
                                            disabled={creatingRule || !walletAddress || !selectedProtocol}
                                            className="mt-3 w-full rounded-lg bg-cyan-300 px-3 py-2 text-sm font-black text-zinc-950 transition-all hover:bg-cyan-200 disabled:opacity-50"
                                        >
                                            {creatingRule ? 'Creating Rule...' : 'Create Alert Rule'}
                                        </button>

                                        <div className="mt-4 space-y-2">
                                            {alertsLoading ? (
                                                <p className="text-sm text-zinc-400">Loading rules...</p>
                                            ) : rules.length === 0 ? (
                                                <p className="text-sm text-zinc-400">No rules yet. Create one to monitor your watchlist automatically.</p>
                                            ) : (
                                                rules.map((rule) => (
                                                    <div key={rule.id} className="flex items-center justify-between rounded-lg bg-zinc-950/60 p-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-zinc-100">
                                                                {rule.protocolSlug}: {ALERT_METRIC_LABEL[rule.metric]} {rule.direction === 'BELOW' ? '<=' : '>='} {rule.threshold.toFixed(2)}%
                                                            </p>
                                                            <p className="text-xs text-zinc-500">Created {new Date(rule.createdAt).toLocaleString()}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => setRuleEnabled(rule.id, !rule.enabled)}
                                                            className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wide ${rule.enabled
                                                                ? 'bg-emerald-500/20 text-emerald-200'
                                                                : 'bg-zinc-700 text-zinc-300'
                                                                }`}
                                                        >
                                                            {rule.enabled ? 'Enabled' : 'Disabled'}
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <div className="mt-4 space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Recent Alert Events</p>
                                            {events.length === 0 ? (
                                                <p className="text-sm text-zinc-400">No alert events yet.</p>
                                            ) : (
                                                events.slice(0, 5).map((event) => (
                                                    <div key={event.id} className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                                        {event.protocolSlug} hit {ALERT_METRIC_LABEL[event.metric]} at {event.currentValue.toFixed(2)}% ({event.direction === 'BELOW' ? '<=' : '>='} {event.threshold.toFixed(2)}%)
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl bg-zinc-900/45 p-5 backdrop-blur-xl">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Research Memory</p>
                                        <h2 className="mb-4 text-xl font-black text-white">Recent Brief History</h2>

                                        {historyLoading ? (
                                            <p className="text-sm text-zinc-400">Loading history...</p>
                                        ) : history.length === 0 ? (
                                            <p className="text-sm text-zinc-400">No saved research runs yet. Generate reports from Research to build your timeline.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {history.map((item) => (
                                                    <div key={item.id} className="rounded-lg bg-zinc-950/60 p-3">
                                                        <div className="mb-2 flex items-center justify-between gap-2">
                                                            <Link href={`/research?q=${item.protocolSlug}`} className="text-sm font-bold uppercase tracking-wide text-cyan-200 hover:underline">
                                                                {item.protocolSlug}
                                                            </Link>
                                                            <span className="text-[10px] text-zinc-500">{new Date(item.createdAt).toLocaleString()}</span>
                                                        </div>
                                                        <p className="line-clamp-3 text-xs leading-relaxed text-zinc-300">{item.briefMarkdown}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-2xl bg-zinc-900/45 p-5 text-sm text-zinc-300 backdrop-blur-xl lg:col-span-2">
                                    Connect a wallet to enable server-synced alert rules and research history. Your protocol watchlist already works in guest mode.
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
