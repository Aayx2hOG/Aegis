'use client';

import { useWatchlist } from '@/hooks/use-watchlist';
import Link from 'next/link';
import { ExternalLink, Star, Trash2, ArrowLeft } from 'lucide-react';

export default function WatchlistPage() {
  const { watchlist, isLoading, isConnected, remove, needsInit, initialize, isInitializing } = useWatchlist();

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100 selection:bg-primary/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-blue-500/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative max-w-5xl mx-auto py-16 px-6 space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden">
          <div className="space-y-4">
            <Link 
              href="/research" 
              className="group flex items-center gap-2 text-zinc-500 hover:text-primary transition-colors text-xs font-bold uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
              Back to Research
            </Link>
            <h1 className="text-5xl font-black tracking-tight text-white">
              My <span className="text-primary">Watchlist</span>
            </h1>
            <p className="text-zinc-400 max-w-lg">
              Tracked Solana protocols and saved research briefs. On-chain verified.
            </p>
          </div>

          <div className="flex items-center gap-4">
             {isConnected && needsInit && (
                <button 
                  onClick={() => initialize()}
                  disabled={isInitializing}
                  className="px-6 py-3 bg-primary text-zinc-950 text-sm font-black rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  {isInitializing ? <span className="loading loading-spinner loading-xs" /> : 'Initialize Watchlist'}
                </button>
             )}
             <div className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900/50 text-[10px] font-black uppercase tracking-tighter text-zinc-500">
               {watchlist.length} / 20 Protocols
             </div>
          </div>
        </header>

        {/* Content */}
        {!isConnected ? (
          <div className="glass-card p-20 rounded-3xl border border-zinc-800/50 bg-zinc-900/20 backdrop-blur-xl flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center">
              <Star className="w-10 h-10 text-zinc-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Wallet Not Connected</h3>
              <p className="text-zinc-500 max-w-xs mx-auto">Connect your Solana wallet to access your on-chain watchlist.</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-2xl border border-zinc-800 bg-zinc-900/20 animate-pulse" />
            ))}
          </div>
        ) : watchlist.length === 0 ? (
          <div className="glass-card p-20 rounded-3xl border border-zinc-800/50 bg-zinc-900/20 backdrop-blur-xl flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-600">
               ★
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Watchlist Empty</h3>
              <p className="text-zinc-500 max-w-xs mx-auto">Start by adding protocols from the research page.</p>
              <Link 
                href="/research" 
                className="inline-block mt-4 text-primary font-bold hover:underline"
              >
                Go to Research &rarr;
              </Link>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {watchlist.map((slug) => (
              <ProtocolCard key={slug} slug={slug} onRemove={() => remove(slug)} />
            ))}
          </div>
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

function ProtocolCard({ slug, onRemove }: { slug: string; onRemove: () => void }) {
  return (
    <div className="group glass-card p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-primary/50 transition-all flex flex-col justify-between h-48 relative overflow-hidden">
      {/* Glow Effect */}
      <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 blur-3xl group-hover:bg-primary/10 transition-colors" />
      
      <div className="space-y-1">
        <div className="text-[10px] font-black text-primary uppercase tracking-widest">Protocol</div>
        <h3 className="text-2xl font-black text-white capitalize overflow-hidden text-ellipsis">{slug}</h3>
      </div>

      <div className="flex items-center gap-3">
        <Link 
          href={`/research?q=${slug}`}
          className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2"
        >
          Research <ExternalLink className="w-3 h-3" />
        </Link>
        <button 
          onClick={onRemove}
          className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-500/50 rounded-lg transition-all"
          title="Remove from watchlist"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
