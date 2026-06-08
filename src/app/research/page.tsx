'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import { agentStateAtom } from '@/store/research-store';
import type { ResearchBrief } from '@/shared/types';

import { useWatchlist } from '@/hooks/use-watchlist';
import { useChainProtocols } from '@/hooks/use-defillama';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { Star, Swords, RefreshCw, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMultiChain } from '@/components/chain/chain-provider';
import { normalizeProtocolSlug } from '@/shared/protocol/slug-resolver';
import type { SolanaProtocol } from '@/shared/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import { TracingBeam } from '@/components/ui/tracing-beam';

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
      const raw = protocol as { tvl?: number; tvlUsd?: number; category?: string };
      const tvlNum: number | null = typeof raw.tvl === 'number' ? raw.tvl : typeof raw.tvlUsd === 'number' ? raw.tvlUsd : null;
      return { protocol, tvlNum };
    })
    .filter(({ tvlNum }) => tvlNum != null && tvlNum > 0)
    .filter(({ protocol }) => {
      const category = (protocol as { category?: string }).category?.trim() ?? 'Uncategorized';
      if (EXCLUDED_PROTOCOL_CATEGORIES.has(category)) return false;
      if (RELEVANT_PROTOCOL_CATEGORIES.size === 0) return true;
      return RELEVANT_PROTOCOL_CATEGORIES.has(category) || category === 'Uncategorized';
    })
    .sort((a, b) => (b.tvlNum ?? 0) - (a.tvlNum ?? 0))
    .map(({ protocol, tvlNum }) => ({
      slug: normalizeProtocolSlug(protocol.slug),
      label: protocol.name || formatProtocolName(protocol.slug),
      category: (protocol as { category?: string }).category ?? 'Uncategorized',
      tvl: typeof tvlNum === 'number' ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(tvlNum) : 'N/A',
    }));
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

// Category Badge Color helper
function getCategoryTone(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes('lending') || cat.includes('cdp')) return 'border-cyan-500/35 bg-cyan-500/5 text-cyan-400';
  if (cat.includes('amm') || cat.includes('dex')) return 'border-emerald-500/35 bg-emerald-500/5 text-emerald-400';
  if (cat.includes('yield') || cat.includes('staking')) return 'border-amber-500/35 bg-amber-500/5 text-amber-400';
  return 'border-rose-500/35 bg-rose-500/5 text-rose-400';
}

export default function ResearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-cyan-500" />
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

  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([]);

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
      void runResearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Loading console log simulation
  useEffect(() => {
    if (!loading) {
      setSimulatedLogs([]);
      return;
    }
    const rawLogs = [
      `Initializing secure Aegis node proxy for ${activeChain.displayName.toUpperCase()}...`,
      `[NODE] Handshake complete. Resolving RPC feeds...`,
      `[FEED] Fetching historical TVL metrics via DeFiLlama proxy...`,
      `[INTEL] Analyzing smart contract risk footprint...`,
      `[AI-AGENT] Scanning on-chain liquidity depth and slippage parameters...`,
      `[AI-AGENT] Resolving recent security incidents and audits...`,
      `[AI-AGENT] Synthesizing dossier metrics into markdown report...`,
      `[SYSTEM] Structuring research brief. Outputting classification card...`
    ];

    setSimulatedLogs([`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${rawLogs[0]}`]);
    let nextIdx = 1;
    const timer = setInterval(() => {
      if (nextIdx < rawLogs.length) {
        const currentLog = rawLogs[nextIdx];
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        setSimulatedLogs((old) => [...old, `[${timestamp}] ${currentLog}`]);
        nextIdx++;
      } else {
        clearInterval(timer);
      }
    }, 2200);

    return () => clearInterval(timer);
  }, [loading, activeChain]);

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
    <div className="mx-auto max-w-5xl space-y-8 py-6 px-2 cyber-grid">
      {/* Header */}
      <header className="space-y-4 text-left">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="accent" className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-orbitron font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)] bg-cyan-950/20 text-cyan-400 border-cyan-500/20">
              Aegis Research Analyst
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="border-cyan-500/10 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/15 hover:text-white font-orbitron font-bold uppercase tracking-wider rounded-xs transition-all">
              <Link href="/research/compare" className="flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" /> Protocol Battleground
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900 text-zinc-300 font-orbitron font-bold uppercase tracking-wider rounded-xs">
              <Link href="/watchlist" className="flex items-center gap-1.5">
                Watchlist <Star className="w-3.5 h-3.5 fill-current text-cyan-400" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-orbitron font-black tracking-wide text-white md:text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.08)] uppercase">
            {activeChain.displayName} <span className="text-cyan-400 font-black">Research</span>
          </h1>
          <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-zinc-400">
            Autonomous AI analyst extracting on-chain contract intelligence, governance data, and multi-chain TVL trends in real-time.
          </p>
        </div>
      </header>

      {/* Results (Dossier Mode) */}
      {brief && !loading && (
        <div className="animate-in space-y-8 fade-in duration-700">
          <TracingBeam>
            <article className="relative overflow-hidden rounded-xl bg-zinc-950/70 border border-cyan-500/15 shadow-[0_15px_50px_rgba(0,0,0,0.6)] corner-decor">
              {/* Dossier Header Strip */}
              <div className="border-b border-cyan-500/15 bg-cyan-950/15 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="font-orbitron font-black text-xs uppercase tracking-widest text-cyan-400">
                    CLASSIFIED RESEARCH BRIEF // CORE: {brief.protocol.toUpperCase()}
                  </span>
                </div>
                <div className="flex gap-2">
                  {brief?.protocol && (
                    <Button asChild size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-bold uppercase tracking-wider rounded-xs shadow-[0_0_10px_rgba(6,182,212,0.25)]">
                      <Link href={`/war-room?protocol=${brief.protocol.toLowerCase()}`}>
                        Run War Room Simulation
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
                      ? 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900 rounded-xs'
                      : 'bg-white hover:bg-zinc-200 text-zinc-950 font-semibold rounded-xs transition-all'
                    }
                  >
                    {isWatched(brief.protocol.toLowerCase()) ? '★ Active monitor' : '☆ Watch Protocol'}
                  </Button>
                </div>
              </div>

              {!isConnected && (
                <div className="px-6 pt-4 md:px-10">
                  <div className="rounded-xs bg-cyan-500/5 px-3.5 py-2 text-[9px] font-mono font-bold uppercase tracking-widest text-cyan-400 border border-cyan-500/10">
                    &gt; HOST IDENTITY: GUEST // CACHING SECURE PORTFOLIO TO LOCAL STORAGE.
                  </div>
                </div>
              )}
              <div className="p-6 md:p-10 text-left">
                <MarkdownBrief content={brief.brief} />
              </div>
            </article>

            {/* Footer Tip */}
            <div className="text-center py-8">
              <p className="text-zinc-650 text-xs font-mono">&gt; DECRYPTION COMPLETE. AUDIT COMPLIANCE STANDARDS APPLIED.</p>
            </div>
          </TracingBeam>
        </div>
      )}

      {/* Active Thinking State (Console Terminal Logger) */}
      {loading && (
        <div className="animate-in slide-in-from-bottom-4 fade-in overflow-hidden rounded-xl bg-zinc-950 border border-cyan-500/15 backdrop-blur-md duration-500 relative min-h-[18rem] flex flex-col justify-between shadow-2xl shadow-cyan-500/5 corner-decor">
          <div className="border-b border-cyan-500/15 bg-zinc-900/50 px-4 py-2 flex items-center justify-between text-cyan-400/80 font-mono text-xs">
            <span className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5" /> AEGIS SECURE CONSOLE LOGS</span>
            <span className="text-zinc-550 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> PROCESS: ACTIVE</span>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-start space-y-2 font-mono text-xs text-left overflow-y-auto">
            {simulatedLogs.map((log, index) => (
              <div key={index} className="text-cyan-400/90 tracking-wide font-light">
                {log}
              </div>
            ))}
            <div className="text-white font-bold flex items-center gap-1 animate-pulse">
              <span>&gt; PROCESSING DEFI MATRIX</span>
              <span className="h-3 w-1.5 bg-white inline-block animate-caret" />
            </div>
          </div>
          
          <div className="border-t border-cyan-500/10 p-3 bg-cyan-950/5 text-center">
            <p className="text-[10px] uppercase font-orbitron font-bold tracking-widest text-cyan-500/60">SCANNING HIGH-DIMENSIONAL DATA PIPELINES</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xs bg-rose-500/5 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3 font-mono text-left">
          <span className="mt-0.5">⚠️ ERROR DETECTED:</span>
          <p className="flex-1 font-semibold">{error}</p>
        </div>
      )}

      {/* Catalog Section */}
      <section className="rounded-xl border border-zinc-850 bg-zinc-950/30 p-5 shadow-xl backdrop-blur-md md:p-6 text-left relative">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-xs border border-cyan-500/15 bg-cyan-500/5 px-3 py-0.5 text-[10px] font-orbitron font-bold uppercase tracking-widest text-cyan-400">
              TARGET DATABASE INDEX
            </div>
            <h2 className="text-2xl font-orbitron font-black text-white uppercase tracking-wider">
              {supportedProtocols.length} verified network protocols
            </h2>
            <p className="max-w-2xl text-xs text-zinc-400 leading-relaxed font-medium">
              Live catalog derived from active chain telemetry. Displaying active protocols sorted by liquidity scale (TVL).
            </p>
          </div>
          <div className="rounded-xs border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-zinc-400 font-mono">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-550">Node Sync</p>
            <p className="mt-0.5 font-semibold text-cyan-400">
              {protocolsLoading ? 'REFRESHING DATABASE...' : 'INTELLIGENCE SYNCHRONIZED'}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xs border border-zinc-850 bg-zinc-950/45 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div>
              <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-550">Filter parameters</p>
              <p className="text-[10px] text-zinc-450">Narrow search by protocol labels or category flags.</p>
            </div>
            <div className="text-[10px] font-mono font-semibold text-zinc-500">
              {protocolsLoading ? 'Awaiting metrics...' : `${supportedProtocols.length} entries matching filters`}
            </div>
          </div>
          <div>
            <Input
              type="search"
              value={protocolSearch}
              onChange={(e) => setProtocolSearch(e.target.value)}
              placeholder="Search database (e.g. jito, aave, kamino)..."
              className="h-10 w-full bg-zinc-950 border-zinc-850 focus:border-cyan-500/40 text-xs font-mono"
            />
          </div>
        </div>

        <div className="mt-6 max-h-[28rem] overflow-auto rounded-xs border border-zinc-850 bg-zinc-950/20 p-4 scrollbar-thin">
          <div className="mb-3 flex items-center justify-between gap-3 px-1 text-[10px] font-mono text-zinc-500">
            <span>
              DISPLAYING {Math.min(visibleProtocols, filteredProtocols.length)} OF {filteredProtocols.length} REGISTERED TARGETS
            </span>
            {deferredProtocolSearch && (
              <button
                type="button"
                onClick={() => setProtocolSearch('')}
                className="font-bold text-cyan-400 hover:text-white"
              >
                CLEAR FILTER
              </button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleFilteredProtocols.map((protocol) => (
              <button
                key={protocol.slug}
                type="button"
                onClick={() => {
                  void runResearch(protocol.slug);
                }}
                className="flex items-center justify-between gap-3 rounded-xs border border-zinc-850 bg-zinc-950/60 px-4 py-3 text-left transition hover:border-cyan-500/30 hover:bg-zinc-950 hover:shadow-[0_0_12px_rgba(6,182,212,0.03)] cursor-pointer group"
                style={{ contentVisibility: 'auto', containIntrinsicSize: '60px' }}
                disabled={loading}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-orbitron font-bold tracking-wider text-white group-hover:text-cyan-400 transition-colors uppercase">{protocol.label}</p>
                  <span className={`inline-block mt-1.5 rounded-xs px-2 py-0.5 text-[8px] font-mono uppercase tracking-wider border ${getCategoryTone(protocol.category)}`}>
                    {protocol.category}
                  </span>
                </div>
                <div className="shrink-0 text-right font-mono">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-550">TVL</p>
                  <p className="text-xs text-white font-semibold">{protocol.tvl}</p>
                </div>
              </button>
            ))}
            {filteredProtocols.length === 0 && (
              <div className="rounded-xs border border-dashed border-zinc-850 bg-zinc-950/40 px-4 py-8 text-center text-xs text-zinc-550 font-mono sm:col-span-2 xl:col-span-3">
                &gt; Query yielded 0 matches. Target parameters unrecognized.
              </div>
            )}
          </div>
          {filteredProtocols.length > visibleProtocols && (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                onClick={() => setVisibleProtocols((current) => Math.min(current + INITIAL_VISIBLE_PROTOCOLS, filteredProtocols.length))}
                variant="outline"
                size="sm"
                className="font-orbitron font-bold border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-white rounded-xs uppercase tracking-wider text-xs"
              >
                Load Next Page
              </Button>
            </div>
          )}
        </div>
      </section>

      <style jsx global>{`
        @keyframes progress-fast {
          0% { width: 0%; left: 0; }
          40% { width: 70%; left: 0; }
          100% { width: 0%; left: 100%; }
        }
        .animate-progress-fast {
          animation: progress-fast 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          position: absolute;
        }
        @keyframes caret {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        .animate-caret {
          animation: caret 1s step-end infinite;
        }
      `}</style>
    </div>
  );
}

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function MarkdownBrief({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none font-sans text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-orbitron font-black text-white mt-8 mb-4 tracking-wider uppercase border-b border-cyan-500/10 pb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full" /> {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-orbitron font-bold text-cyan-400 mt-6 mb-3 tracking-wider uppercase border-l border-cyan-500/30 pl-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 mb-1.5 font-bold text-white text-xs font-mono uppercase tracking-wider text-zinc-150">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 text-xs sm:text-sm leading-relaxed text-zinc-300 font-medium">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-6 space-y-2.5 font-sans">
              {children}
            </ul>
          ),
          li: ({ children }) => (
            <li className="group ml-1 flex items-start gap-2 text-zinc-300 text-xs sm:text-sm">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-cyan-500/50 border border-cyan-500/70" />
              <div className="min-w-0 leading-relaxed font-medium">{children}</div>
            </li>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 rounded-xs bg-zinc-950 border border-zinc-850 shadow-inner">
              <table className="w-full text-xs text-left border-collapse font-mono">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase text-[9px] font-bold tracking-widest">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-5 py-3 font-bold text-cyan-400">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-5 py-3 text-zinc-300 border-b border-zinc-900">
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-white">
              {children}
            </strong>
          ),
          code: ({ children }) => (
            <code className="rounded-xs bg-cyan-950/20 border border-cyan-500/15 px-1.5 py-0.5 font-mono text-[11px] text-cyan-300 font-bold">
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
