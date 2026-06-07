'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import { agentStateAtom } from '@/store/research-store';
import type { ResearchBrief, ToolCallRecord } from '@/shared/types';

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
import type { SolanaProtocol } from '@/shared/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import { TracingBeam } from '@/components/ui/tracing-beam';
import { Tabs } from '@/components/ui/tabs';
import { Sparkles } from '@/components/ui/sparkles';

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
      const raw = protocol as { tvl?: number; tvlUsd?: number; category?: string }
      const tvlNum: number | null = typeof raw.tvl === 'number' ? raw.tvl : typeof raw.tvlUsd === 'number' ? raw.tvlUsd : null
      return { protocol, tvlNum }
    })
    .filter(({ tvlNum }) => tvlNum != null && tvlNum > 0)
    .filter(({ protocol }) => {
      const category = (protocol as { category?: string }).category?.trim() ?? 'Uncategorized'
      if (EXCLUDED_PROTOCOL_CATEGORIES.has(category)) return false
      if (RELEVANT_PROTOCOL_CATEGORIES.size === 0) return true
      return RELEVANT_PROTOCOL_CATEGORIES.has(category) || category === 'Uncategorized'
    })
    .sort((a, b) => (b.tvlNum ?? 0) - (a.tvlNum ?? 0))
    .map(({ protocol, tvlNum }) => ({
      slug: normalizeProtocolSlug(protocol.slug),
      label: protocol.name || formatProtocolName(protocol.slug),
      category: (protocol as { category?: string }).category ?? 'Uncategorized',
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
  }, [loading, activeChain.displayName]);

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
          tool: tc.tool,
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
    <div className="mx-auto max-w-5xl space-y-8 py-6">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="accent" className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-semibold">
              Aegis Research Analyst
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="border-zinc-800 bg-zinc-900/40 text-zinc-350 hover:bg-zinc-800 hover:text-white font-bold transition-all">
              <Link href="/research/compare">
                ⚔️ Protocol Battleground
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/watchlist" className="flex items-center gap-1.5 font-bold">
                My Watchlist <Star className="w-3.5 h-3.5 fill-current" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.08)]">
            {activeChain.displayName} <span className="text-zinc-200">Research</span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
            Autonomous AI analyst generating deep-dive reports for the selected chain using live protocol and market data.
          </p>
        </div>
      </header>

      {/* Results */}
      {brief && !loading && (
        <div className="animate-in space-y-8 fade-in duration-700">
          {/* Main Brief wrapped in a Tracing Beam */}
          <TracingBeam>
            <article className="relative overflow-hidden rounded-2xl bg-zinc-900/20 border border-zinc-800 shadow-xl">
              {/* Watchlist Actions */}
              <div className="absolute top-6 right-6 flex gap-2 z-20">
                {brief?.protocol && (
                  <Button asChild size="sm" className="bg-white text-zinc-950 hover:bg-zinc-200 font-semibold rounded-lg shadow-[0_0_12px_rgba(255,255,255,0.08)] hover:shadow-[0_0_18px_rgba(255,255,255,0.18)] transition-all">
                    <Link href={`/war-room?protocol=${brief.protocol.toLowerCase()}`}>
                      Run War Room
                    </Link>
                  </Button>
                )}
                <Button
                  onClick={() => {
                    const slug = brief.protocol.toLowerCase();
                    toggle(slug);
                    if (!isWatched(slug)) {
                      toast.success(`${slug} added to watchlist.`);
                    }
                  }}
                  variant={isWatched(brief.protocol.toLowerCase()) ? 'outline' : 'default'}
                  size="sm"
                  className={isWatched(brief.protocol.toLowerCase())
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    : 'bg-white hover:bg-zinc-200 text-zinc-950 font-semibold rounded-lg shadow-[0_0_12px_rgba(255,255,255,0.08)] hover:shadow-[0_0_18px_rgba(255,255,255,0.18)] transition-all'
                  }
                >
                  {isWatched(brief.protocol.toLowerCase()) ? '★ Watched' : '☆ Add to Watchlist'}
                </Button>
              </div>
              {!isConnected && (
                <div className="px-6 pt-6 md:px-10">
                  <div className="rounded-lg bg-zinc-950/50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 border border-zinc-900">
                    Guest Mode: Watchlist is saved locally in this browser.
                  </div>
                </div>
              )}
              <div className="p-6 md:p-10">
                <MarkdownBrief content={brief.brief} />
              </div>
            </article>
 
            {/* Footer Tip */}
            <div className="text-center py-12">
              <p className="text-zinc-500 text-xs">Reports are generated in real-time. Verify critical data independently.</p>
            </div>
          </TracingBeam>
        </div>
      )}
 
      {/* Active Thinking State */}
      {loading && (
        <div className="animate-in slide-in-from-bottom-4 fade-in overflow-hidden rounded-2xl bg-zinc-950/40 border border-zinc-800/80 backdrop-blur-md duration-500 relative min-h-[16rem] flex flex-col justify-center shadow-xl">
          <div className="h-0.5 bg-zinc-900 w-full absolute top-0 left-0">
            <div className="h-full bg-zinc-200 animate-progress-fast" />
          </div>
          <div className="p-12 flex flex-col items-center justify-center space-y-6 relative z-10">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-zinc-200 animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold leading-none tracking-tight text-white">{statusMsg}</h3>
              <p className="text-zinc-500 text-xs font-medium">Aegis is processing high-dimensional data flows...</p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-3">
          <span className="mt-0.5">⚠️</span>
          <p className="flex-1 font-medium">{error}</p>
        </div>
      )}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 shadow-xl backdrop-blur-md md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              Live protocol catalog
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              {supportedProtocols.length} supported protocols with active TVL
            </h2>
            <p className="max-w-2xl text-sm text-zinc-350">
              These are the live protocols pulled from DeFiLlama for the currently selected chain, filtered to remove zero-TVL entries so the catalog stays useful and faster to scan.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Feed status</p>
            <p className="mt-1 font-semibold text-zinc-350">
              {protocolsLoading ? 'Refreshing live catalog...' : 'Live and ready'}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/20 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Catalog search</p>
              <p className="text-xs text-zinc-400">Search by name, slug, or category.</p>
            </div>
            <div className="text-xs font-semibold text-zinc-450">
              {protocolsLoading ? 'Loading live feed...' : `${supportedProtocols.length} protocols available`}
            </div>
          </div>
          <div className="mt-3">
            <Input
              type="search"
              value={protocolSearch}
              onChange={(e) => setProtocolSearch(e.target.value)}
              placeholder="Search protocols..."
              className="h-11 w-full bg-zinc-950/80 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-800"
            />
          </div>
        </div>

        <div className="mt-5 max-h-[28rem] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
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
                className="font-semibold text-zinc-450 hover:text-zinc-200"
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
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/20 px-3.5 py-2.5 text-left transition hover:border-zinc-700 hover:bg-zinc-900/40"
                style={{ contentVisibility: 'auto', containIntrinsicSize: '60px' }}
                disabled={loading}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{protocol.label}</p>
                  <p className="truncate text-[11px] text-zinc-500">{protocol.category}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">TVL</p>
                  <p className="text-xs text-zinc-300">{protocol.tvl}</p>
                </div>
              </button>
            ))}
            {filteredProtocols.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-850 bg-zinc-950/40 px-4 py-6 text-sm text-zinc-400 sm:col-span-2 xl:col-span-3">
                No protocols matched your search.
              </div>
            )}
          </div>
          {filteredProtocols.length > visibleProtocols && (
            <div className="mt-3 flex justify-center">
              <Button
                type="button"
                onClick={() => setVisibleProtocols((current) => Math.min(current + INITIAL_VISIBLE_PROTOCOLS, filteredProtocols.length))}
                variant="outline"
                size="sm"
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      </section>

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
            <h1 className="text-4xl font-extrabold text-white mt-12 mb-6 tracking-tighter capitalize pb-4">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-extrabold text-white mt-10 mb-4 tracking-tight">
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
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-650 transition-transform group-hover:scale-125" />
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
            <thead className="bg-zinc-900/70 text-zinc-500 uppercase text-[10px] font-bold tracking-widest">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-6 py-4 font-bold">
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
            <code className="rounded bg-zinc-850 px-1.5 py-0.5 font-mono text-sm text-zinc-200">
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


