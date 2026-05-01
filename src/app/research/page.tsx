'use client';

import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { agentStateAtom } from '@/store/research-store';
import type { ResearchBrief, ToolCallRecord } from '@/shared/types/research';

import { useWatchlist } from '@/hooks/use-watchlist';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { normalizeProtocolSlug } from '@/shared/protocol/slug-resolver';

const AVAILABLE_PROTOCOLS = [
  { slug: 'raydium', note: 'AMM + liquidity routing' },
  { slug: 'orca', note: 'Concentrated liquidity DEX' },
  { slug: 'marinade', note: 'Liquid staking ecosystem' },
  { slug: 'jito', note: 'MEV and validator infrastructure' },
  { slug: 'kamino', note: 'Lending and vault strategies' },
  { slug: 'drift', note: 'Perpetuals and advanced trading' },
  { slug: 'marginfi', note: 'Lending market and risk engine' },
] as const;

function formatProtocolName(name: string): string {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
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
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [, setAgentState] = useAtom(agentStateAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isWatched, toggle, isConnected } = useWatchlist();

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

  function buildExportFileName(protocol: string, ext: string): string {
    const date = new Date().toISOString().slice(0, 10);
    return `aegis-${protocol.toLowerCase()}-brief-${date}.${ext}`;
  }

  async function copyBriefMarkdown() {
    if (!brief?.brief) return;
    try {
      await navigator.clipboard.writeText(brief.brief);
      toast.success('Research brief copied to clipboard.');
    } catch {
      toast.error('Clipboard copy failed. You can still download the report.');
    }
  }

  function downloadTextFile(fileName: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportBriefMarkdown() {
    if (!brief) return;
    downloadTextFile(buildExportFileName(brief.protocol, 'md'), brief.brief, 'text/markdown;charset=utf-8');
  }

  function exportToolAuditJson() {
    if (!brief) return;
    const payload = {
      protocol: brief.protocol,
      generatedAt: new Date().toISOString(),
      toolCalls: brief.toolCalls,
    };
    downloadTextFile(
      buildExportFileName(brief.protocol, 'audit.json'),
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8'
    );
  }

  useEffect(() => {
    if (!loading) return;
    const messages = [
      'Scanning Solana blockchain...',
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
            Solana <span className="text-cyan-200">Research</span>
          </h1>
          <p className="mx-auto max-w-2xl text-zinc-300">
            Autonomous AI analyst generating deep-dive reports via live on-chain and market data integration.
          </p>
        </header>

        {/* Search Section */}
        <section className="glass-card rounded-2xl bg-zinc-900/45 p-1 shadow-2xl backdrop-blur-xl">
          <div className="p-4 space-y-4">
            <div className="relative flex items-center">
              <input
                type="text"
                className="h-14 w-full rounded-xl bg-zinc-950/60 px-5 text-lg font-medium outline-none ring-1 ring-zinc-800/60 transition-all placeholder:text-zinc-600 focus:ring-2 focus:ring-cyan-300/70"
                placeholder="Enter protocol slug (e.g. raydium, orca, jito...)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runResearch(query)}
                disabled={loading}
              />
              <button
                className="absolute right-2 h-10 rounded-lg bg-cyan-300 px-6 font-bold text-zinc-950 shadow-lg shadow-cyan-400/20 transition-all hover:bg-cyan-200 disabled:opacity-50"
                onClick={() => runResearch(query)}
                disabled={loading || !query.trim()}
              >
                {loading ? <span className="loading loading-spinner loading-xs" /> : 'Launch'}
              </button>
            </div>


            <div className="flex flex-wrap items-center gap-3 px-1">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">Available protocols:</span>
              {AVAILABLE_PROTOCOLS.map((protocol) => (
                <button
                  key={protocol.slug}
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-300 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                  onClick={() => { setQuery(protocol.slug); runResearch(protocol.slug); }}
                  disabled={loading}
                >
                  {formatProtocolName(protocol.slug)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Empty State */}
        {!loading && !brief && !error && (
          <section className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/35 p-6 shadow-xl backdrop-blur-xl md:p-8">
              <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
                <div className="space-y-4">
                  <div className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-100">
                    Ready to Research
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
                    Start with any supported Solana protocol.
                  </h2>
                  <p className="max-w-xl text-sm leading-6 text-zinc-300 md:text-base">
                    Enter a protocol slug, or tap one of the accessible options to generate a full brief with market context, on-chain signals, and actionable risks to review.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {AVAILABLE_PROTOCOLS.slice(0, 4).map((protocol) => (
                      <button
                        key={`empty-${protocol.slug}`}
                        onClick={() => {
                          setQuery(protocol.slug);
                          runResearch(protocol.slug);
                        }}
                        disabled={loading}
                        className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-zinc-900"
                      >
                        <div className="text-sm font-bold text-zinc-100">{formatProtocolName(protocol.slug)}</div>
                        <div className="mt-1 text-xs text-zinc-400">{protocol.note}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/45 p-4 md:p-5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">How it works</h3>
                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    <p className="rounded-lg bg-zinc-900/70 px-3 py-2">
                      1. Choose a supported protocol.
                    </p>
                    <p className="rounded-lg bg-zinc-900/70 px-3 py-2">
                      2. Aegis fetches current market + on-chain context.
                    </p>
                    <p className="rounded-lg bg-zinc-900/70 px-3 py-2">
                      3. You get a structured brief and auditable tool trace.
                    </p>
                  </div>
                  <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
                    Tip: protocol slugs are lowercase in the input, but names are displayed with uppercase initials for readability.
                  </div>
                </div>
              </div>
            </div>
          </section>
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
                  <button
                    onClick={exportBriefMarkdown}
                    className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-200 transition-all hover:bg-zinc-700"
                  >
                    Download .md
                  </button>
                  <button
                    onClick={exportToolAuditJson}
                    className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-200 transition-all hover:bg-zinc-700"
                  >
                    Download Audit JSON
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


