'use client';

import { useState, useEffect } from 'react';
import { useWatchlist } from '@/hooks/use-watchlist';
import { AppHero } from '@/components/app-hero';
import type { ResearchBrief } from '@/lib/types/research';
import { WalletButton } from '@/components/solana/solana-provider';
import Link from 'next/link';

export function DashboardFeature() {
  const { watchlist, isLoading, isInitializing, initialize, needsInit, isConnected } = useWatchlist();
  const [briefs, setBriefs] = useState<Record<string, ResearchBrief | 'loading' | 'error'>>({});

  useEffect(() => {
    if (isLoading || watchlist.length === 0) return;

    watchlist.forEach((slug) => {
      if (!briefs[slug]) {
        fetchBrief(slug);
      }
    });
  }, [watchlist, isLoading]);

  async function fetchBrief(slug: string) {
    setBriefs((prev) => ({ ...prev, [slug]: 'loading' }));
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol: slug }),
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data: ResearchBrief = await res.json();
      setBriefs((prev) => ({ ...prev, [slug]: data }));
    } catch {
      setBriefs((prev) => ({ ...prev, [slug]: 'error' }));
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100">
      <AppHero 
        title="Agentic Watchlist" 
        subtitle="Your on-chain bookmarks, automatically researched by Aegis AI." 
      />

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {!isConnected ? (
          <div className="glass-card p-12 text-center rounded-3xl border border-zinc-800 bg-zinc-900/40">
            <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              Connect your Solana wallet to access your on-chain research watchlist.
            </p>
            <div className="flex justify-center">
              <WalletButton className="btn btn-primary" />
            </div>
          </div>
        ) : needsInit ? (
          <div className="glass-card p-12 text-center rounded-3xl border border-zinc-800 bg-zinc-900/40">
            <h2 className="text-2xl font-bold mb-4">Initialize Your Watchlist</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              Aegis stores your watchlist on the Solana blockchain. You'll need to initialize your account once to start bookmarking protocols.
            </p>
            <button
              onClick={() => initialize()}
              disabled={isInitializing}
              className="px-8 py-3 bg-primary text-zinc-950 font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {isInitializing ? 'Initializing...' : 'Create Watchlist Account'}
            </button>
          </div>
        ) : (
          <>
            {watchlist.length === 0 && !isLoading ? (
              <div className="glass-card p-16 text-center rounded-3xl border border-zinc-800 bg-zinc-900/40">
                <div className="text-5xl mb-6Opacity-50">🔭</div>
                <h2 className="text-2xl font-bold mb-2">Watchlist is Empty</h2>
                <p className="text-zinc-400 mb-8">Start by researching a protocol and adding it to your watchlist.</p>
                <Link 
                  href="/research"
                  className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all"
                >
                  Go to Research
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {watchlist.map((slug) => (
                  <div key={slug} className="glass-card bg-zinc-900/50 border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-primary/30 transition-all group">
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <h3 className="text-xl font-black tracking-tight text-white capitalize">{slug}</h3>
                        <div className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase">On-Chain</div>
                      </div>
                      
                      {briefs[slug] === 'loading' ? (
                        <div className="py-8 flex flex-col items-center justify-center space-y-3">
                          <span className="loading loading-spinner loading-md text-primary" />
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Aegis Thinking...</span>
                        </div>
                      ) : briefs[slug] === 'error' ? (
                        <div className="py-4 text-center">
                          <p className="text-red-400 text-xs mb-2">Failed to update brief</p>
                          <button onClick={() => fetchBrief(slug)} className="text-[10px] font-bold text-zinc-400 hover:text-white uppercase underline cursor-pointer">Retry</button>
                        </div>
                      ) : briefs[slug] ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                          <p className="text-zinc-400 text-sm line-clamp-3 italic">
                            {(briefs[slug] as ResearchBrief).brief.split('\n')[0].replace(/^#+\s*/, '')}
                          </p>
                          <Link 
                            href={`/research?q=${slug}`}
                            className="block text-center py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-bold hover:bg-zinc-700 transition-colors"
                          >
                            View Full Report
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
