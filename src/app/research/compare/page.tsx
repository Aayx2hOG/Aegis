'use client';

import { useEffect, useMemo, useState, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Swords, ArrowLeft, Zap, Sparkles, Search, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMultiChain } from '@/components/chain/chain-provider';
import { useChainProtocols } from '@/hooks/use-defillama';
import { normalizeProtocolSlug } from '@/shared/protocol/slug-resolver';
import type { SolanaProtocol } from '@/shared/types';
import type { ResearchBrief } from '@/shared/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const EXCLUDED_CATEGORIES = new Set(['CEX', 'CeFi', 'Centralized Exchange', 'Indexes', 'Portfolio Tracker', 'Risk Curators', 'Wallet']);

function formatProtocolName(name: string): string {
  if (!name) return '';
  return name
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-cyan-300" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}

interface MetricSnapshot {
  name?: string;
  category?: string;
  tokenPrice?: { price?: number; marketCap?: number };
  marketFallback?: { price?: number; marketCap?: number };
  description?: string;
}

interface MetricTvl {
  name?: string;
  tvl?: number;
  change1d?: number;
  change7d?: number;
  mcap?: number;
  category?: string;
}

function SearchableDropdown({
  value,
  onChange,
  options,
  disabled,
  label,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { slug: string; label: string; tvl: number; category?: string }[];
  disabled?: boolean;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.slug === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.slug.toLowerCase().includes(query)
    );
  }, [options, search]);

  const formatTvl = (val: number) => {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(val);
  };

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
        {label}
      </label>
      
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 text-sm text-zinc-100 flex items-center justify-between outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="font-semibold text-zinc-100">
              {selectedOption.label}{' '}
              <span className="text-zinc-500 font-normal">
                (TVL: {formatTvl(selectedOption.tvl)})
              </span>
            </span>
          ) : (
            <span className="text-zinc-500">Select protocol...</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-xl border border-zinc-850 bg-[#070b12] p-2 shadow-2xl backdrop-blur-md max-h-72 flex flex-col">
          {/* Search Box */}
          <div className="relative mb-2 shrink-0">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="search"
              placeholder="Search protocols..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-9 pr-4 text-xs text-zinc-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/10"
              autoFocus
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 divide-y divide-zinc-900 pr-1 max-h-48 scrollbar-thin">
            {filteredOptions.map((opt) => {
              const isSelected = opt.slug === value;
              return (
                <button
                  key={opt.slug}
                  type="button"
                  onClick={() => {
                    onChange(opt.slug);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                    isSelected
                      ? 'bg-cyan-500/10 text-cyan-300 border-l-2 border-cyan-400'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <div className="truncate">
                    <span className="font-semibold block truncate">{opt.label}</span>
                    <span className="text-[10px] text-zinc-500 block truncate font-mono uppercase">
                      {opt.category ?? 'DeFi'} • {opt.slug}
                    </span>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase tracking-wider">TVL</span>
                      <span className="text-zinc-200 font-semibold">{formatTvl(opt.tvl)}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-300" />}
                  </div>
                </button>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="p-4 text-center text-xs text-zinc-500">No protocols matched.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CompareContent() {
  const wallet = useWallet();
  const searchParams = useSearchParams();
  const { activeChain } = useMultiChain();

  const [protocolA, setProtocolA] = useState('');
  const [protocolB, setProtocolB] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [statusMsg, setStatusMsg] = useState('Preparing arena...');

  const { data: chainProtocols = [], isLoading: protocolsLoading } = useChainProtocols(activeChain.type);

  // Normalize protocol lists for selectors
  const supportedProtocols = useMemo(() => {
    const deduped = new Map<string, SolanaProtocol>();
    chainProtocols.forEach((p) => {
      const slug = normalizeProtocolSlug(p.slug);
      if (slug && !deduped.has(slug)) {
        deduped.set(slug, p);
      }
    });

    return Array.from(deduped.values())
      .filter((p) => {
        const cat = (p as unknown as { category?: string }).category ?? 'Uncategorized';
        return !EXCLUDED_CATEGORIES.has(cat);
      })
      .map((p) => {
        const tvlVal = (p as unknown as { tvl?: number; tvlUsd?: number }).tvl ?? (p as unknown as { tvl?: number; tvlUsd?: number }).tvlUsd ?? 0;
        const cat = (p as unknown as { category?: string }).category ?? 'DeFi';
        return {
          slug: normalizeProtocolSlug(p.slug),
          label: p.name || formatProtocolName(p.slug),
          tvl: tvlVal,
          category: cat,
        };
      })
      .sort((a, b) => b.tvl - a.tvl);
  }, [chainProtocols]);

  // Automatically reset selected protocols when active chain type changes
  useEffect(() => {
    if (supportedProtocols.length >= 2) {
      setProtocolA(supportedProtocols[0].slug);
      setProtocolB(supportedProtocols[1].slug);
    }
  }, [activeChain.type, supportedProtocols]);

  // Clear previous research brief and error states on chain type change
  useEffect(() => {
    setBrief(null);
    setError(null);
  }, [activeChain.type]);

  // Read URL query params if any
  useEffect(() => {
    const pA = searchParams.get('a');
    const pB = searchParams.get('b');
    if (pA && pB) {
      setProtocolA(normalizeProtocolSlug(pA));
      setProtocolB(normalizeProtocolSlug(pB));
      void runComparison(pA, pB);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Loading text cycler
  useEffect(() => {
    if (!loading) return;
    const messages = [
      `Scanning ${activeChain.displayName} DeFi ecosystem...`,
      `Syncing metrics for ${formatProtocolName(protocolA)}...`,
      `Syncing metrics for ${formatProtocolName(protocolB)}...`,
      'Running competitive price and TVL models...',
      'Synthesizing security risk matrices...',
      'Generating AI head-to-head verdict battle card...',
      'Finalizing comparative report...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setStatusMsg(messages[i]);
    }, 2800);
    return () => clearInterval(interval);
  }, [loading, protocolA, protocolB, activeChain]);

  async function runComparison(pA: string, pB: string) {
    const normA = normalizeProtocolSlug(pA);
    const normB = normalizeProtocolSlug(pB);

    if (!normA || !normB) {
      toast.error('Please select both protocols.');
      return;
    }
    if (normA === normB) {
      toast.error('Please select two different protocols.');
      return;
    }

    setLoading(true);
    setError(null);
    setBrief(null);
    setStatusMsg(`Entering battleground: ${formatProtocolName(pA)} vs ${formatProtocolName(pB)}...`);

    try {
      const res = await fetch('/api/research/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolA: normA,
          protocolB: normB,
          chainType: activeChain.type,
          walletAddress: wallet.publicKey?.toBase58(),
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as ResearchBrief;
      setBrief(data);
      toast.success('Battle Card synthesized successfully.');
    } catch (err) {
      setError(String(err));
      toast.error('AI comparison failed.');
    } finally {
      setLoading(false);
    }
  }

  // Parse metrics directly from the tool calls inside the brief for comparative rendering
  const metrics = useMemo(() => {
    if (!brief) return null;
    const normA = normalizeProtocolSlug(protocolA);
    const normB = normalizeProtocolSlug(protocolB);

    const tvlCallA = brief.toolCalls.find((tc) => tc.tool === 'get_protocol_tvl' && normalizeProtocolSlug(String(tc.input?.slug ?? '')) === normA);
    const tvlCallB = brief.toolCalls.find((tc) => tc.tool === 'get_protocol_tvl' && normalizeProtocolSlug(String(tc.input?.slug ?? '')) === normB);
    const snapCallA = brief.toolCalls.find((tc) => tc.tool === 'get_protocol_snapshot' && normalizeProtocolSlug(String(tc.input?.slug ?? '')) === normA);
    const snapCallB = brief.toolCalls.find((tc) => tc.tool === 'get_protocol_snapshot' && normalizeProtocolSlug(String(tc.input?.slug ?? '')) === normB);

    const tvlA = tvlCallA?.output as MetricTvl | undefined;
    const tvlB = tvlCallB?.output as MetricTvl | undefined;
    const snapA = snapCallA?.output as MetricSnapshot | undefined;
    const snapB = snapCallB?.output as MetricSnapshot | undefined;

    const priceA = snapA?.tokenPrice?.price ?? snapA?.marketFallback?.price;
    const priceB = snapB?.tokenPrice?.price ?? snapB?.marketFallback?.price;
    const mcapA = snapA?.tokenPrice?.marketCap ?? snapA?.marketFallback?.marketCap ?? tvlA?.mcap;
    const mcapB = snapB?.tokenPrice?.marketCap ?? snapB?.marketFallback?.marketCap ?? tvlB?.mcap;

    return {
      nameA: snapA?.name ?? tvlA?.name ?? formatProtocolName(protocolA),
      nameB: snapB?.name ?? tvlB?.name ?? formatProtocolName(protocolB),
      tvlA: tvlA?.tvl ?? null,
      tvlB: tvlB?.tvl ?? null,
      change1dA: tvlA?.change1d ?? null,
      change1dB: tvlB?.change1d ?? null,
      change7dA: tvlA?.change7d ?? null,
      change7dB: tvlB?.change7d ?? null,
      priceA,
      priceB,
      mcapA,
      mcapB,
      categoryA: tvlA?.category ?? snapA?.category ?? 'DeFi',
      categoryB: tvlB?.category ?? snapB?.category ?? 'DeFi',
    };
  }, [brief, protocolA, protocolB]);

  function copyBriefMarkdown() {
    if (!brief?.brief) return;
    void navigator.clipboard.writeText(brief.brief);
    toast.success('Markdown brief copied.');
  }

  function usd(val: unknown) {
    const num = Number(val);
    if (!Number.isFinite(num) || num === 0) return 'Unavailable';
    return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  function pct(val: unknown) {
    const num = Number(val);
    if (!Number.isFinite(num)) return 'Unavailable';
    const sign = num > 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  }

  return (
    <div className="min-h-screen text-zinc-100 selection:bg-cyan-400/20 bg-[radial-gradient(circle_at_12%_8%,rgba(22,163,184,0.18),transparent_34%),radial-gradient(circle_at_88%_4%,rgba(59,130,246,0.12),transparent_30%),linear-gradient(165deg,#050910,#0a1119_46%,#070d15)]">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[8%] h-[36%] w-[36%] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute top-[18%] -right-[8%] h-[32%] w-[32%] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-5xl space-y-8 px-4 py-10 md:space-y-10 md:px-6 md:py-14">
        {/* Navigation back */}
        <header className="relative space-y-4 text-center md:space-y-5">
          <Link
            href="/research"
            className="mr-auto flex w-fit items-center gap-2 rounded-xl bg-zinc-900/60 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300 shadow-xl transition-all hover:bg-zinc-800/80 hover:text-cyan-100 md:absolute md:left-0 md:top-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Research
          </Link>
          <div className="mb-2 inline-block rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-500/20 border border-cyan-400/30 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-200">
            <Swords className="w-3.5 h-3.5 inline mr-1.5" />
            Arena Battleground
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
            Protocol <span className="text-cyan-200">Battleground</span>
          </h1>
          <p className="mx-auto max-w-2xl text-zinc-300">
            Conduct side-by-side AI comparative analysis and quantitative metric audits for any two live DeFi protocols.
          </p>
        </header>

        {/* Protocol Selector Arena */}
        <section className="relative z-40 rounded-3xl border border-zinc-800/70 bg-zinc-900/40 p-6 shadow-xl backdrop-blur-xl md:p-8">
          <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] items-start">
            {/* Protocol A Selector */}
            <SearchableDropdown
              value={protocolA}
              onChange={setProtocolA}
              options={supportedProtocols}
              disabled={loading}
              label="DeFi Protocol A"
            />

            {/* Battle Icon */}
            <div className="flex justify-center pt-6">
              <div className="w-12 h-12 rounded-full border border-cyan-500/30 bg-cyan-950/20 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)] animate-pulse">
                <Swords className="w-5 h-5" />
              </div>
            </div>

            {/* Protocol B Selector */}
            <SearchableDropdown
              value={protocolB}
              onChange={setProtocolB}
              options={supportedProtocols}
              disabled={loading}
              label="DeFi Protocol B"
            />
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => void runComparison(protocolA, protocolB)}
              disabled={loading || protocolsLoading || !protocolA || !protocolB || protocolA === protocolB}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-zinc-950 font-black uppercase tracking-wider text-xs shadow-lg shadow-cyan-400/20 transition-all hover:scale-[1.02] hover:shadow-cyan-400/35 active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
            >
              <Zap className="w-4 h-4 fill-zinc-950" /> Initiate Head-to-Head Battle
            </button>
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="glass-card animate-in slide-in-from-bottom-4 fade-in overflow-hidden rounded-3xl bg-zinc-900/35 backdrop-blur-md duration-500 border border-white/5">
            <div className="h-1 bg-zinc-800 w-full">
              <div className="h-full bg-cyan-400 animate-progress-fast shadow-[0_0_10px_#22d3ee]" />
            </div>
            <div className="p-12 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-zinc-800" />
                <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-t-cyan-400 animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold leading-none tracking-tight text-white">{statusMsg}</h3>
                <p className="text-zinc-500 text-sm">Synthesizing comparative vectors across Solana protocol networks...</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-3">
            <span className="mt-0.5">⚠️</span>
            <p className="flex-1 font-medium">{error}</p>
          </div>
        )}

        {/* Results Panel */}
        {brief && metrics && !loading && (
          <div className="animate-in fade-in duration-700 space-y-8">
            {/* Quick Stats side-by-side card comparisons */}
            <section className="grid gap-6 md:grid-cols-2">
              {/* Protocol A Card */}
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-950/5 p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-500/5 blur-2xl pointer-events-none" />
                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">PROTOCOL A</span>
                <h2 className="text-2xl font-black text-white mt-2 capitalize">{metrics.nameA}</h2>
                <p className="text-xs text-zinc-500 uppercase mt-1">{metrics.categoryA}</p>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">TVL</span>
                    <span className="text-lg font-black text-white">{usd(metrics.tvlA)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Token Price</span>
                    <span className="text-lg font-black text-cyan-300">{usd(metrics.priceA)}</span>
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <Link
                    href={`/war-room?protocol=${encodeURIComponent(protocolA.toLowerCase())}`}
                    className="px-4 py-2 bg-cyan-300/10 hover:bg-cyan-300/20 text-cyan-300 border border-cyan-300/20 text-xs font-bold rounded-lg transition-all flex items-center justify-center flex-1"
                  >
                    Stress Test A
                  </Link>
                </div>
              </div>

              {/* Protocol B Card */}
              <div className="rounded-2xl border border-blue-400/20 bg-blue-950/5 p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-blue-500/5 blur-2xl pointer-events-none" />
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">PROTOCOL B</span>
                <h2 className="text-2xl font-black text-white mt-2 capitalize">{metrics.nameB}</h2>
                <p className="text-xs text-zinc-500 uppercase mt-1">{metrics.categoryB}</p>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">TVL</span>
                    <span className="text-lg font-black text-white">{usd(metrics.tvlB)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Token Price</span>
                    <span className="text-lg font-black text-blue-300">{usd(metrics.priceB)}</span>
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <Link
                    href={`/war-room?protocol=${encodeURIComponent(protocolB.toLowerCase())}`}
                    className="px-4 py-2 bg-blue-300/10 hover:bg-blue-300/20 text-blue-300 border border-blue-300/20 text-xs font-bold rounded-lg transition-all flex items-center justify-center flex-1"
                  >
                    Stress Test B
                  </Link>
                </div>
              </div>
            </section>

            {/* Comparative Highlights Table */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6 shadow-xl backdrop-blur-md">
              <h3 className="text-base font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-300" />
                Comparative Metric Matrix
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-500 uppercase text-[10px] font-black tracking-widest">
                      <th className="px-4 py-3">Metric Dimension</th>
                      <th className="px-4 py-3">{metrics.nameA}</th>
                      <th className="px-4 py-3">{metrics.nameB}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    <tr>
                      <td className="px-4 py-4 font-bold text-zinc-400">Total Value Locked (TVL)</td>
                      <td className={`px-4 py-4 font-semibold ${Number(metrics.tvlA) > Number(metrics.tvlB) ? 'text-emerald-400 font-bold border-l-2 border-l-emerald-500/50' : 'text-zinc-200'}`}>{usd(metrics.tvlA)}</td>
                      <td className={`px-4 py-4 font-semibold ${Number(metrics.tvlB) > Number(metrics.tvlA) ? 'text-emerald-400 font-bold border-l-2 border-l-emerald-500/50' : 'text-zinc-200'}`}>{usd(metrics.tvlB)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 font-bold text-zinc-400">24h TVL Momentum</td>
                      <td className={`px-4 py-4 font-semibold ${Number(metrics.change1dA) > Number(metrics.change1dB) ? 'text-emerald-400 font-bold border-l-2 border-l-emerald-500/50' : 'text-zinc-200'}`}>{pct(metrics.change1dA)}</td>
                      <td className={`px-4 py-4 font-semibold ${Number(metrics.change1dB) > Number(metrics.change1dA) ? 'text-emerald-400 font-bold border-l-2 border-l-emerald-500/50' : 'text-zinc-200'}`}>{pct(metrics.change1dB)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 font-bold text-zinc-400">7d TVL Momentum</td>
                      <td className={`px-4 py-4 font-semibold ${Number(metrics.change7dA) > Number(metrics.change7dB) ? 'text-emerald-400 font-bold border-l-2 border-l-emerald-500/50' : 'text-zinc-200'}`}>{pct(metrics.change7dA)}</td>
                      <td className={`px-4 py-4 font-semibold ${Number(metrics.change7dB) > Number(metrics.change7dA) ? 'text-emerald-400 font-bold border-l-2 border-l-emerald-500/50' : 'text-zinc-200'}`}>{pct(metrics.change7dB)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 font-bold text-zinc-400">Governance Token Price</td>
                      <td className="px-4 py-4 font-semibold text-zinc-200">{usd(metrics.priceA)}</td>
                      <td className="px-4 py-4 font-semibold text-zinc-200">{usd(metrics.priceB)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-4 font-bold text-zinc-400">Market Capitalization</td>
                      <td className="px-4 py-4 font-semibold text-zinc-200">{usd(metrics.mcapA)}</td>
                      <td className="px-4 py-4 font-semibold text-zinc-200">{usd(metrics.mcapB)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Analyst Thinking Trace */}
            <details className="group">
              <summary className="flex list-none cursor-pointer items-center gap-2 text-zinc-500 transition-colors hover:text-zinc-300">
                <div className="w-5 h-5 flex items-center justify-center rounded-md bg-zinc-800 group-open:rotate-180 transition-transform">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">Analyst Thinking Trace ({brief.toolCalls.length} Steps)</span>
              </summary>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {brief.toolCalls.map((tc, i) => (
                  <div key={i} className="p-4 rounded-xl bg-zinc-900/55 flex flex-col gap-2 border border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-cyan-300 uppercase bg-cyan-500/10 px-1.5 py-0.5 rounded">STEP {i + 1}</span>
                      <span className="text-[10px] font-mono text-zinc-600">{tc.durationMs}ms</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-zinc-300">{tc.tool}</div>
                    <div className="text-[10px] text-zinc-500 truncate italic">input: {JSON.stringify(tc.input)}</div>
                    {tc.error && <div className="text-[10px] text-red-500 mt-1 uppercase font-bold">Error: {tc.error}</div>}
                  </div>
                ))}
              </div>
            </details>

            {/* Comparative AI Report (Battle Card) */}
            <article className="glass-card relative overflow-hidden rounded-3xl bg-zinc-900/50 shadow-2xl border border-white/5">
              <div className="absolute top-6 right-6">
                <button
                  onClick={copyBriefMarkdown}
                  className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-200 transition-all"
                >
                  Copy Markdown
                </button>
              </div>

              <div className="p-6 md:p-10 mt-6">
                <MarkdownBrief content={brief.brief} />
              </div>
            </article>

            {/* Footer tip */}
            <div className="text-center pb-20">
              <p className="text-zinc-600 text-xs">Reports are generated in real-time by the Aegis Comparative AI agent. Verify critical allocations independently.</p>
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

function MarkdownBrief({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-3xl font-black text-white mt-12 mb-6 tracking-tighter pb-2 border-b border-zinc-800">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-black text-white mt-10 mb-4 tracking-tight border-l-2 border-cyan-400 pl-3">
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
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_#22d3ee] transition-transform group-hover:scale-125" />
              <div className="min-w-0 leading-7">{children}</div>
            </li>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-8 rounded-xl bg-zinc-950/40 border border-zinc-800">
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
