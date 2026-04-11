'use client';

import { useWatchlist } from '@/hooks/use-watchlist';
import Link from 'next/link';
import { ExternalLink, Star, Trash2, ArrowLeft } from 'lucide-react';

export default function WatchlistPage() {
  const { watchlist, isLoading, isConnected, remove, needsInit, initialize, isInitializing } = useWatchlist();

  return (
    <div className="min-h-screen text-zinc-100 selection:bg-cyan-400/20 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.2),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[8%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute top-[18%] -right-[8%] h-[32%] w-[32%] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-5xl space-y-10 px-4 py-10 md:space-y-12 md:px-6 md:py-14">
        {/* Header */}
        <header className="flex flex-col justify-between gap-6 overflow-hidden md:flex-row md:items-end">
          <div className="space-y-4">
            <Link
              href="/research"
              className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:text-cyan-200"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
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

        {/* Content */}
        {!isConnected ? (
          <div className="glass-card flex flex-col items-center justify-center space-y-6 rounded-3xl bg-zinc-900/35 p-20 text-center backdrop-blur-xl">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800/50">
              <Star className="w-10 h-10 text-zinc-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Wallet Not Connected</h3>
              <p className="mx-auto max-w-xs text-zinc-400">Connect your Solana wallet to access your on-chain watchlist.</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-zinc-900/35" />
            ))}
          </div>
        ) : watchlist.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center space-y-6 rounded-3xl bg-zinc-900/35 p-20 text-center backdrop-blur-xl">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800/50 text-zinc-600">
              ★
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Watchlist Empty</h3>
              <p className="mx-auto max-w-xs text-zinc-400">Start by adding protocols from the research page.</p>
              <Link
                href="/research"
                className="mt-4 inline-block font-bold text-cyan-200 hover:underline"
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
    <div className="group glass-card relative flex h-48 flex-col justify-between overflow-hidden rounded-2xl bg-zinc-900/45 p-6 transition-all hover:bg-zinc-900/65">
      {/* Glow Effect */}
      <div className="absolute -right-10 -top-10 h-24 w-24 bg-cyan-300/10 blur-3xl transition-colors group-hover:bg-cyan-300/20" />

      <div className="space-y-1">
        <div className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Protocol</div>
        <h3 className="text-2xl font-black text-white capitalize overflow-hidden text-ellipsis">{slug}</h3>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={`/research?q=${slug}`}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-200 transition-all hover:bg-zinc-700"
        >
          Research <ExternalLink className="w-3 h-3" />
        </Link>
        <button
          onClick={onRemove}
          className="rounded-lg bg-zinc-900/80 p-2 text-zinc-600 transition-all hover:bg-zinc-800 hover:text-red-400"
          title="Remove from watchlist"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
