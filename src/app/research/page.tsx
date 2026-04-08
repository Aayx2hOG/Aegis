'use client';

import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { agentStateAtom } from '@/store/research-store';
import type { ResearchBrief, ToolCallRecord } from '@/lib/types/research';

import { useWatchlist } from '@/hooks/use-watchlist';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';

const QUICK_PICKS = ['raydium', 'orca', 'marinade', 'jito', 'kamino', 'drift', 'marginfi'];

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
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [, setAgentState] = useAtom(agentStateAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isWatched, toggle, initialize, isInitializing, isConnected, needsInit } = useWatchlist();

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
    if (!protocol.trim()) return;
    setLoading(true);
    setError(null);
    setBrief(null);
    setAgentState({ status: 'thinking', currentTool: null, toolCalls: [], error: null });

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol }),
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
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100 selection:bg-primary/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-blue-500/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative max-w-4xl mx-auto py-16 px-6 space-y-10">
        {/* Header */}
        <header className="relative text-center space-y-4">
          <Link 
            href="/watchlist"
            className="absolute top-0 right-0 group flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-primary hover:border-primary/50 transition-all text-[10px] font-black uppercase tracking-widest shadow-xl"
          >
            My Watchlist <Star className="w-3 h-3 group-hover:scale-125 transition-transform" />
          </Link>
          <div className="inline-block px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-bold tracking-widest uppercase mb-2">
            Aegis Intelligence
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white">
            Solana <span className="text-primary">Research</span>
          </h1>
          <p className="text-zinc-400 max-w-lg mx-auto">
            Autonomous AI analyst generating deep-dive reports via live on-chain and market data integration.
          </p>
        </header>

        {/* Search Section */}
        <section className="glass-card p-1 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 shadow-2xl backdrop-blur-xl">
          <div className="p-4 space-y-4">
            <div className="relative flex items-center">
              <input
                type="text"
                className="w-full h-14 bg-zinc-950/50 border-2 border-zinc-800 focus:border-primary rounded-xl px-5 text-lg outline-none transition-all placeholder:text-zinc-600 font-medium"
                placeholder="Enter protocol slug (e.g. raydium, orca, jito...)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runResearch(query)}
                disabled={loading}
              />
              <button
                className="absolute right-2 h-10 px-6 bg-primary hover:bg-primary/90 text-primary-content rounded-lg font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                onClick={() => runResearch(query)}
                disabled={loading || !query.trim()}
              >
                {loading ? <span className="loading loading-spinner loading-xs" /> : 'Launch'}
              </button>
            </div>


            <div className="flex flex-wrap items-center gap-3 px-1">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">Popular:</span>
              {QUICK_PICKS.map((p) => (
                <button
                  key={p}
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/30 text-zinc-300 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                  onClick={() => { setQuery(p); runResearch(p); }}
                  disabled={loading}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Active Thinking State */}
        {loading && (
          <div className="glass-card overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900/30 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="h-1 bg-zinc-800 w-full">
              <div className="h-full bg-primary animate-progress-fast shadow-[0_0_10px_rgb(var(--p))]" />
            </div>
            <div className="p-12 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-zinc-800" />
                <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-t-primary animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white leading-none tracking-tight">{statusMsg}</h3>
                <p className="text-zinc-500 text-sm">Aegis is processing high-dimensional data flows...</p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm flex items-start gap-3">
             <span className="mt-0.5">⚠️</span>
             <p className="flex-1 font-medium">{error}</p>
          </div>
        )}

        {/* Results */}
        {brief && !loading && (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* Thinking Trace */}
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-zinc-500 hover:text-zinc-300 transition-colors list-none">
                <div className="w-5 h-5 flex items-center justify-center rounded-md bg-zinc-800 group-open:rotate-180 transition-transform">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">Analyst Thinking Trace ({brief.toolCalls.length} Steps)</span>
              </summary>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {brief.toolCalls.map((tc: ToolCallRecord, i: number) => (
                  <div key={i} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded">STEP {i+1}</span>
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
            <article className="glass-card bg-zinc-900/40 border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl relative">
              {/* Watchlist Actions */}
              <div className="absolute top-6 right-6 flex gap-2">
                {!isConnected ? (
                  <div className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-bold rounded-lg uppercase tracking-tight">
                    Connect wallet to bookmark
                  </div>
                ) : needsInit ? (
                  <button 
                    onClick={() => initialize()}
                    disabled={isInitializing}
                    className="px-4 py-2 bg-primary text-zinc-950 text-xs font-bold rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {isInitializing ? <span className="loading loading-spinner loading-xs" /> : 'Initialize Watchlist'}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const slug = brief.protocol.toLowerCase();
                      console.log('Toggling watchlist for:', slug);
                      toggle(slug);
                    }}
                    disabled={isInitializing}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                      isWatched(brief.protocol.toLowerCase())
                        ? 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                        : 'bg-primary text-zinc-950 hover:bg-primary/90 shadow-lg shadow-primary/20'
                    }`}
                  >
                    {isWatched(brief.protocol.toLowerCase()) ? '★ Watched' : '☆ Add to Watchlist'}
                  </button>
                )}
              </div>
              <div className="p-10">
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
            <h1 className="text-4xl font-black text-white mt-12 mb-6 tracking-tighter capitalize border-b border-zinc-800 pb-4">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-black text-white mt-10 mb-4 tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-bold text-white mt-8 mb-2 border-l-4 border-primary pl-4">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-zinc-300 leading-relaxed text-lg font-light tracking-wide mb-6">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-4 mb-8">
              {children}
            </ul>
          ),
          li: ({ children }) => (
            <li className="flex gap-3 text-zinc-300 ml-2 group">
              <span className="text-primary mt-1.5 group-hover:scale-125 transition-transform flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--p),0.5)]" />
              <div className="leading-relaxed">{children}</div>
            </li>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-8 rounded-xl border border-zinc-800 bg-zinc-950/30">
              <table className="w-full text-sm text-left">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-900/50 text-zinc-500 uppercase text-[10px] font-black tracking-widest border-b border-zinc-800">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-6 py-4 font-black">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-6 py-4 text-zinc-300 border-b border-zinc-800/50 font-medium">
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-white">
              {children}
            </strong>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-primary font-mono text-sm">
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


