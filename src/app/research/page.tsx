'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import { agentStateAtom } from '@/store/research-store';
import type { ResearchBrief, ToolCallRecord } from '@/shared/types/research';

import { useWatchlist } from '@/hooks/use-watchlist';
import { useChainProtocols } from '@/hooks/use-defillama';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMultiChain } from '@/components/chain/chain-provider';
import { normalizeProtocolSlug } from '@/shared/protocol/slug-resolver';
import type { SolanaProtocol } from '@/shared/types/protocol';

const RELEVANT_PROTOCOL_CATEGORIES = new Set([
  'AMM',
  'Bridge',
  'CDP',
  'Derivatives',
  'Dexs',
  'Farm',
  'Insurance',
  'Lending',
  'Liquidity Layer',
  'Liquid Restaking',
  'Liquid Staking',
  'Orderbook',
  'Options',
  'Perpetuals',
  'Prediction Market',
  'Restaking',
  'Stablecoin',
  'Staking',
  'Staking Pool',
  'Synthetic Assets',
  'Vault',
  'Yield',
  'Yield Aggregator',
]);

const EXCLUDED_PROTOCOL_CATEGORIES = new Set([
  'CEX',
  'CeFi',
  'Centralized Exchange',
  'Indexes',
  'Portfolio Tracker',
  'Risk Curators',
  'Wallet',
]);

const INITIAL_VISIBLE_PROTOCOLS = 60;

function formatProtocolName(name: string): string {
  if (!name) return '';
  return name
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildSupportedProtocolCatalog(protocols: SolanaProtocol[]) {
  const deduped = new Map<string, SolanaProtocol>();

  protocols.forEach((protocol) => {
    const slug = normalizeProtocolSlug(protocol.slug);
    if (!slug || deduped.has(slug)) return;
    deduped.set(slug, protocol);
  });

  return Array.from(deduped.values())
    .map((protocol) => {
      // DeFiLlama may use different keys for TVL (tvl, tvlUsd, etc.). Normalize.
      const anyP = protocol as any
      const tvlNum: number | null = typeof anyP.tvl === 'number' ? anyP.tvl : typeof anyP.tvlUsd === 'number' ? anyP.tvlUsd : null
      return { protocol, tvlNum }
    })
    .filter(({ protocol, tvlNum }) => tvlNum != null && tvlNum > 0)
    .filter(({ protocol }) => {
      const category = (protocol as any).category?.trim() ?? 'Uncategorized'
      if (EXCLUDED_PROTOCOL_CATEGORIES.has(category)) return false
      if (RELEVANT_PROTOCOL_CATEGORIES.size === 0) return true
      return RELEVANT_PROTOCOL_CATEGORIES.has(category) || category === 'Uncategorized'
    })
    .sort((a, b) => (b.tvlNum ?? 0) - (a.tvlNum ?? 0))
    .map(({ protocol, tvlNum }) => ({
      slug: normalizeProtocolSlug(protocol.slug),
      label: protocol.name || formatProtocolName(protocol.slug),
      category: (protocol as any).category ?? 'Uncategorized',
      tvl: typeof tvlNum === 'number' ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(tvlNum) : 'N/A',
    }))
}

function matchesProtocolSearch(protocol: { slug: string; label: string; category: string }, query: string) {
  if (!query) return true;
  const normalizedQuery = query.toLowerCase();
  return (
    protocol.slug.toLowerCase().includes(normalizedQuery) ||
    protocol.label.toLowerCase().includes(normalizedQuery) ||
    protocol.category.toLowerCase().includes(normalizedQuery)
  );
}

export default function ResearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    }>
      <ResearchContent />
    </Suspense>
  );
}

function ResearchContent() {
  const wallet = useWallet();
  const searchParams = useSearchParams();
  const { activeChain } = useMultiChain();
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [, setAgentState] = useAtom(agentStateAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protocolSearch, setProtocolSearch] = useState('');
  const [visibleProtocols, setVisibleProtocols] = useState(INITIAL_VISIBLE_PROTOCOLS);
  const { isWatched, toggle, isConnected } = useWatchlist();
  const { data: chainProtocols = [], isLoading: protocolsLoading } = useChainProtocols(activeChain.type);

  const supportedProtocols = useMemo(() => buildSupportedProtocolCatalog(chainProtocols), [chainProtocols]);
  const deferredProtocolSearch = useDeferredValue(protocolSearch.trim());
  const filteredProtocols = useMemo(
    () => supportedProtocols.filter((protocol) => matchesProtocolSearch(protocol, deferredProtocolSearch)),
    [deferredProtocolSearch, supportedProtocols]
  );
  const visibleFilteredProtocols = useMemo(
    () => filteredProtocols.slice(0, visibleProtocols),
    [filteredProtocols, visibleProtocols]
  );

  useEffect(() => {
    setVisibleProtocols(INITIAL_VISIBLE_PROTOCOLS);
  }, [activeChain.type, deferredProtocolSearch]);

  // Auto-run if query param exists
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      runResearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Auto-set status message based on timing
  const [statusMsg, setStatusMsg] = useState('Initializing analyst...');

  async function copyBriefMarkdown() {
    if (!brief?.brief) return;
    try {
      await navigator.clipboard.writeText(brief.brief);
      toast.success('Research brief copied to clipboard.');
    } catch {
      toast.error('Clipboard copy failed. You can still download the report.');
    }
  }

  useEffect(() => {
    if (!loading) return;
    const messages = [
      `Scanning ${activeChain.displayName}...`,
      'Gathering protocol TVL data...',
      'Analyzing token market dynamics...',
      'Inspecting recent on-chain transactions...',
      'Synthesizing research brief...',
      'Finalizing report formatting...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setStatusMsg(messages[i]);
    }, 3500);
    return () => clearInterval(interval);
  }, [loading]);

  async function runResearch(protocol: string) {
    const normalizedProtocol = normalizeProtocolSlug(protocol);
    if (!normalizedProtocol) return;
    setLoading(true);
    setError(null);
    setBrief(null);
    setAgentState({ status: 'thinking', currentTool: null, toolCalls: [], error: null });

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol: normalizedProtocol,
          chainType: activeChain.type,
          walletAddress: wallet.publicKey?.toBase58(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: ResearchBrief = await res.json();
      setBrief(data);
      setAgentState({
        status: 'done',
        currentTool: null,
        toolCalls: data.toolCalls.map((tc) => ({
          toolName: tc.tool,
          input: tc.input,
          output: tc.output,
          durationMs: tc.durationMs
        })),
        error: null,
      });
    } catch (err) {
      const msg = String(err);
      setError(msg);
      setAgentState({ status: 'error', currentTool: null, toolCalls: [], error: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-zinc-100 selection:bg-cyan-400/20 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.2),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[8%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute top-[18%] -right-[8%] h-[32%] w-[32%] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-5xl space-y-8 px-4 py-10 md:space-y-10 md:px-6 md:py-14">
        {/* Header */}
        <header className="relative space-y-4 text-center md:space-y-5">
          <Link
            href="/watchlist"
            className="mx-auto flex w-fit items-center gap-2 rounded-xl bg-zinc-900/60 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300 shadow-xl transition-all hover:bg-zinc-800/80 hover:text-cyan-100 md:absolute md:right-0 md:top-0"
          >
            My Watchlist <Star className="w-3 h-3 group-hover:scale-125 transition-transform" />
          </Link>
          <div className="mb-2 inline-block rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-200">
            Aegis Intelligence
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
            {activeChain.displayName} <span className="text-cyan-200">Research</span>
          </h1>
          <p className="mx-auto max-w-2xl text-zinc-300">
            Autonomous AI analyst generating deep-dive reports for the selected chain using live protocol and market data.
          </p>
        </header>

        {/* Results */}
        {brief && !loading && (
          <div className="animate-in space-y-8 fade-in duration-700">
            {/* Thinking Trace */}
            <details className="group">
              <summary className="flex list-none cursor-pointer items-center gap-2 text-zinc-500 transition-colors hover:text-zinc-300">
                <div className="w-5 h-5 flex items-center justify-center rounded-md bg-zinc-800 group-open:rotate-180 transition-transform">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">Analyst Thinking Trace ({brief.toolCalls.length} Steps)</span>
              </summary>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {brief.toolCalls.map((tc: ToolCallRecord, i: number) => (
                  <div key={i} className="p-4 rounded-xl bg-zinc-900/55 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded">STEP {i + 1}</span>
                      <span className="text-[10px] font-mono text-zinc-600">{tc.durationMs}ms</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-zinc-300">{tc.tool}</div>
                    <div className="text-[10px] text-zinc-500 truncate italic">input: {JSON.stringify(tc.input)}</div>
                    {tc.error && <div className="text-[10px] text-red-500 mt-1 uppercase font-bold">Error: {tc.error}</div>}
                  </div>
                ))}
              </div>
            </details>

            {/* Main Brief */}
            <article className="glass-card relative overflow-hidden rounded-3xl bg-zinc-900/50 shadow-2xl">
              {/* Watchlist Actions */}
              <div className="absolute top-6 right-6 flex gap-2">
                {brief?.protocol && (
                  <Link
                    href={`/war-room?protocol=${brief.protocol.toLowerCase()}`}
                    className="px-4 py-2 bg-cyan-300/20 text-cyan-100 text-xs font-bold rounded-lg hover:bg-cyan-300/30 transition-all"
                  >
                    Run War Room
                  </Link>
                )}
                <button
                  onClick={() => {
                    const slug = brief.protocol.toLowerCase();
                    toggle(slug);
                    if (!isWatched(slug)) {
                      toast.success(`${slug} added to watchlist.`);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${isWatched(brief.protocol.toLowerCase())
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    : 'bg-primary text-zinc-950 hover:bg-primary/90 shadow-lg shadow-primary/20'
                    }`}
                >
                  {isWatched(brief.protocol.toLowerCase()) ? '★ Watched' : '☆ Add to Watchlist'}
                </button>
              </div>
              {!isConnected && (
                <div className="px-6 pt-6 md:px-10">
                  <div className="rounded-lg bg-zinc-950/50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Guest Mode: Watchlist is saved locally in this browser.
                  </div>
                </div>
              )}
              <div className="px-6 pt-6 md:px-10">
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-zinc-950/45 p-2">
                  <button
                    onClick={copyBriefMarkdown}
                    className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-200 transition-all hover:bg-zinc-700"
                  >
                    Copy Markdown
                  </button>
                </div>
              </div>
              <div className="p-6 md:p-10">
                <MarkdownBrief content={brief.brief} />
              </div>
            </article>

            {/* Footer Tip */}
            <div className="text-center pb-20">
              <p className="text-zinc-600 text-xs">Reports are generated in real-time. Verify critical data independently.</p>
            </div>
          </div>
        )}

        {/* Active Thinking State */}
        {loading && (
          <div className="glass-card animate-in slide-in-from-bottom-4 fade-in overflow-hidden rounded-2xl bg-zinc-900/35 backdrop-blur-md duration-500">
            <div className="h-1 bg-zinc-800 w-full">
              <div className="h-full bg-primary animate-progress-fast shadow-[0_0_10px_rgb(var(--p))]" />
            </div>
            <div className="p-12 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-zinc-800" />
                <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-t-primary animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold leading-none tracking-tight text-white">{statusMsg}</h3>
                <p className="text-zinc-500 text-sm">Aegis is processing high-dimensional data flows...</p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 text-red-300 text-sm flex items-start gap-3">
            <span className="mt-0.5">⚠️</span>
            <p className="flex-1 font-medium">{error}</p>
          </div>
        )}

        <section className="rounded-3xl border border-zinc-800/70 bg-zinc-900/40 p-5 shadow-xl backdrop-blur-xl md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center rounded-full bg-cyan-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-100">
                Live protocol catalog
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
                {supportedProtocols.length} supported protocols with active TVL
              </h2>
              <p className="max-w-2xl text-sm text-zinc-300">
                These are the live protocols pulled from DeFiLlama for the currently selected chain, filtered to remove zero-TVL entries so the catalog stays useful and faster to scan.
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300 ring-1 ring-white/5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Feed status</p>
              <p className="mt-1 font-semibold text-cyan-100">
                {protocolsLoading ? 'Refreshing live catalog...' : 'Live and ready'}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Catalog search</p>
                <p className="text-xs text-zinc-400">Search by name, slug, or category.</p>
              </div>
              <div className="text-xs font-semibold text-cyan-100">
                {protocolsLoading ? 'Loading live feed...' : `${supportedProtocols.length} protocols available`}
              </div>
            </div>
            <div className="mt-3">
              <input
                type="search"
                value={protocolSearch}
                onChange={(e) => setProtocolSearch(e.target.value)}
                placeholder="Search protocols..."
                className="h-11 w-full rounded-xl border border-zinc-800/70 bg-zinc-950/80 px-4 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
              />
            </div>
          </div>

          <div className="mt-5 max-h-[28rem] overflow-auto rounded-2xl border border-zinc-800/70 bg-zinc-950/50 p-3">
            <div className="mb-3 flex items-center justify-between gap-3 px-1 text-xs text-zinc-400">
              <span>
                Showing {Math.min(visibleProtocols, filteredProtocols.length)} of {filteredProtocols.length}
                {' '}
                matched protocols
              </span>
              {deferredProtocolSearch && (
                <button
                  type="button"
                  onClick={() => setProtocolSearch('')}
                  className="font-semibold text-cyan-100 hover:text-cyan-50"
                >
                  Clear search
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleFilteredProtocols.map((protocol) => (
                <button
                  key={protocol.slug}
                  type="button"
                  onClick={() => {
                    runResearch(protocol.slug);
                  }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 text-left transition hover:border-cyan-300/40 hover:bg-zinc-900"
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '60px' }}
                  disabled={loading}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-100">{protocol.label}</p>
                    <p className="truncate text-[11px] text-zinc-500">{protocol.category}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100">TVL</p>
                    <p className="text-xs text-zinc-300">{protocol.tvl}</p>
                  </div>
                </button>
              ))}
              {filteredProtocols.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-800/80 bg-zinc-900/50 px-4 py-6 text-sm text-zinc-400 sm:col-span-2 xl:col-span-3">
                  No protocols matched your search.
                </div>
              )}
            </div>
            {filteredProtocols.length > visibleProtocols && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleProtocols((current) => Math.min(current + INITIAL_VISIBLE_PROTOCOLS, filteredProtocols.length))}
                  className="rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700"
                >
                  Load more
                </button>
              </div>
            )}
          </div>
        </section>

      </div>

      <style jsx global>{`
        .glass-card {
           backdrop-filter: blur(20px);
        }
        @keyframes progress-fast {
          0% { width: 0%; left: 0; }
          40% { width: 70%; left: 0; }
          100% { width: 0%; left: 100%; }
        }
        .animate-progress-fast {
          animation: progress-fast 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          position: absolute;
        }
      `}</style>
    </div>
  );
}

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function MarkdownBrief({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-4xl font-black text-white mt-12 mb-6 tracking-tighter capitalize pb-4">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-black text-white mt-10 mb-4 tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-8 mb-2 pl-1 text-xl font-bold text-white">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 text-base leading-7 tracking-wide text-zinc-300 md:text-[1.02rem]">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-7 space-y-3">
              {children}
            </ul>
          ),
          li: ({ children }) => (
            <li className="group ml-1 flex items-start gap-3 wrap-break-word text-zinc-300 [&>p]:mb-0 [&_code]:break-all">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.45)] transition-transform group-hover:scale-125" />
              <div className="min-w-0 leading-7">{children}</div>
            </li>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-8 rounded-xl bg-zinc-950/40">
              <table className="w-full text-sm text-left">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-900/70 text-zinc-500 uppercase text-[10px] font-black tracking-widest">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-6 py-4 font-black">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-6 py-4 text-zinc-300 font-medium">
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-white">
              {children}
            </strong>
          ),
          code: ({ children }) => (
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-sm text-cyan-200">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}


