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

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { SpotlightCard } from '@/components/ui/spotlight-card';
import { Sparkles as CanvasSparkles } from '@/components/ui/sparkles';

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
        <span className="loading loading-spinner loading-lg text-zinc-400" />
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
        className="w-full h-11 rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 text-sm text-zinc-100 flex items-center justify-between outline-none transition-all hover:bg-zinc-950 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-xl border border-white/5 bg-[#070b12] p-2 shadow-2xl backdrop-blur-md max-h-72 flex flex-col">
          {/* Search Box */}
          <div className="relative mb-2 shrink-0">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500 z-10" />
            <Input
              type="search"
              placeholder="Search protocols..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9"
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
                      ? 'bg-zinc-800/60 text-white border-l-2 border-zinc-500'
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
                    {isSelected && <Check className="w-3.5 h-3.5 text-zinc-300" />}
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
    <div className="mx-auto max-w-5xl space-y-8 py-6">
      {/* Navigation back & Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/research">
              <Button variant="outline" size="sm" className="flex items-center gap-1.5 font-bold">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Research
              </Button>
            </Link>
            <Badge variant="accent" className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-semibold">
              <Swords className="w-3.5 h-3.5 inline mr-1.5" /> Arena Battleground
            </Badge>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.08)]">
            Protocol <span className="text-zinc-200">Battleground</span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
            Conduct side-by-side AI comparative analysis and quantitative metric audits for any two live DeFi protocols.
          </p>
        </div>
      </header>
      {/* Protocol Selector Arena */}
      <section className="relative z-40 rounded-2xl border border-zinc-800 bg-zinc-900/10 p-6 shadow-xl md:p-8 overflow-hidden">
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
            <div className="w-10 h-10 rounded-full border border-zinc-800 bg-zinc-900/40 flex items-center justify-center text-zinc-300">
              <Swords className="w-4 h-4" />
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
          <Button
            onClick={() => void runComparison(protocolA, protocolB)}
            disabled={loading || protocolsLoading || !protocolA || !protocolB || protocolA === protocolB}
            className="px-8 h-11 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 font-bold shadow-[0_0_12px_rgba(255,255,255,0.08)] hover:shadow-[0_0_18px_rgba(255,255,255,0.18)] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
          >
            <Zap className="w-4.5 h-4.5 fill-zinc-950 text-zinc-950" /> Initiate Head-to-Head Battle
          </Button>
        </div>
      </section>
 
      {/* Loading State */}
      {loading && (
        <div className="animate-in slide-in-from-bottom-4 fade-in overflow-hidden rounded-2xl bg-zinc-950/45 border border-zinc-800 backdrop-blur-md duration-500 relative min-h-[16rem] flex flex-col justify-center shadow-xl">
          <div className="h-0.5 bg-zinc-900 w-full absolute top-0 left-0">
            <div className="h-full bg-zinc-200 animate-progress-fast" />
          </div>
          <div className="p-12 flex flex-col items-center justify-center space-y-6 relative z-10">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-zinc-200 animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold leading-none tracking-tight text-white">{statusMsg}</h3>
              <p className="text-zinc-500 text-xs font-medium">Synthesizing comparative vectors across Solana protocol networks...</p>
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
            <SpotlightCard
              spotlightColor="rgba(255, 255, 255, 0.02)"
              borderColor="rgba(255, 255, 255, 0.1)"
              className="relative overflow-hidden border border-zinc-800 bg-zinc-900/10 p-6 shadow-xl"
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 bg-zinc-900 border border-zinc-850 px-2.5 py-0.5 rounded">PROTOCOL A</span>
              <h2 className="text-3xl font-extrabold text-white mt-3 capitalize tracking-tight">{metrics.nameA}</h2>
              <p className="text-xs text-zinc-500 uppercase mt-1">{metrics.categoryA}</p>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">TVL</span>
                  <span className="text-xl font-bold text-white">{usd(metrics.tvlA)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">Token Price</span>
                  <span className="text-xl font-bold text-zinc-100">{usd(metrics.priceA)}</span>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <Button asChild className="border border-zinc-800 bg-zinc-900/50 text-zinc-350 hover:text-white hover:bg-zinc-900 flex-1 h-11 rounded-lg font-semibold cursor-pointer">
                  <Link href={`/war-room?protocol=${encodeURIComponent(protocolA.toLowerCase())}`}>
                    Stress Test A
                  </Link>
                </Button>
              </div>
            </SpotlightCard>
 
            {/* Protocol B Card */}
            <SpotlightCard
              spotlightColor="rgba(255, 255, 255, 0.02)"
              borderColor="rgba(255, 255, 255, 0.1)"
              className="relative overflow-hidden border border-zinc-800 bg-zinc-900/10 p-6 shadow-xl"
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 bg-zinc-900 border border-zinc-850 px-2.5 py-0.5 rounded">PROTOCOL B</span>
              <h2 className="text-3xl font-extrabold text-white mt-3 capitalize tracking-tight">{metrics.nameB}</h2>
              <p className="text-xs text-zinc-500 uppercase mt-1">{metrics.categoryB}</p>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">TVL</span>
                  <span className="text-xl font-bold text-white">{usd(metrics.tvlB)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block">Token Price</span>
                  <span className="text-xl font-bold text-zinc-100">{usd(metrics.priceB)}</span>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <Button asChild className="border border-zinc-800 bg-zinc-900/50 text-zinc-350 hover:text-white hover:bg-zinc-900 flex-1 h-11 rounded-lg font-semibold cursor-pointer">
                  <Link href={`/war-room?protocol=${encodeURIComponent(protocolB.toLowerCase())}`}>
                    Stress Test B
                  </Link>
                </Button>
              </div>
            </SpotlightCard>
          </section>

          {/* Interactive Visual Comparison Gauges */}
          <SpotlightCard spotlightColor="rgba(255, 255, 255, 0.04)" borderColor="rgba(255, 255, 255, 0.15)">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-zinc-400 animate-pulse" />
              Dynamic Strength Metrics
            </h3>
            
            <div className="space-y-6">
              {/* TVL Compare Row */}
              {(() => {
                const tvlA = Number(metrics.tvlA) || 0;
                const tvlB = Number(metrics.tvlB) || 0;
                const total = tvlA + tvlB;
                const pctA = total > 0 ? (tvlA / total) * 100 : 50;
                const pctB = total > 0 ? (tvlB / total) * 100 : 50;
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className={`font-bold flex items-center gap-1.5 ${tvlA > tvlB ? 'text-white' : 'text-zinc-500'}`}>
                        {tvlA > tvlB && '🏆'} {usd(metrics.tvlA)}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Value Locked</span>
                      <span className={`font-bold flex items-center gap-1.5 ${tvlB > tvlA ? 'text-white' : 'text-zinc-500'}`}>
                        {usd(metrics.tvlB)} {tvlB > tvlA && '🏆'}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 border border-white/5 rounded-full overflow-hidden flex">
                      <div className="h-full bg-gradient-to-r from-white to-zinc-300 shadow-[0_0_8px_rgba(255,255,255,0.15)] transition-all duration-500" style={{ width: `${pctA}%` }} />
                      <div className="h-full bg-gradient-to-r from-zinc-500 to-zinc-700 shadow-[0_0_8px_rgba(113,113,122,0.1)] transition-all duration-500" style={{ width: `${pctB}%` }} />
                    </div>
                  </div>
                );
              })()}

              {/* Mcap Compare Row */}
              {(() => {
                const mcapA = Number(metrics.mcapA) || 0;
                const mcapB = Number(metrics.mcapB) || 0;
                const total = mcapA + mcapB;
                const pctA = total > 0 ? (mcapA / total) * 100 : 50;
                const pctB = total > 0 ? (mcapB / total) * 100 : 50;
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className={`font-bold flex items-center gap-1.5 ${mcapA > mcapB ? 'text-white' : 'text-zinc-500'}`}>
                        {mcapA > mcapB && '🏆'} {usd(metrics.mcapA)}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Market Capitalization</span>
                      <span className={`font-bold flex items-center gap-1.5 ${mcapB > mcapA ? 'text-white' : 'text-zinc-500'}`}>
                        {usd(metrics.mcapB)} {mcapB > mcapA && '🏆'}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 border border-white/5 rounded-full overflow-hidden flex">
                      <div className="h-full bg-gradient-to-r from-white to-zinc-300 shadow-[0_0_8px_rgba(255,255,255,0.15)] transition-all duration-500" style={{ width: `${pctA}%` }} />
                      <div className="h-full bg-gradient-to-r from-zinc-500 to-zinc-700 shadow-[0_0_8px_rgba(113,113,122,0.1)] transition-all duration-500" style={{ width: `${pctB}%` }} />
                    </div>
                  </div>
                );
              })()}

              {/* 24h Change Compare Row */}
              {(() => {
                const cA = Math.abs(Number(metrics.change1dA) || 0);
                const cB = Math.abs(Number(metrics.change1dB) || 0);
                const total = cA + cB;
                const pctA = total > 0 ? (cA / total) * 100 : 50;
                const pctB = total > 0 ? (cB / total) * 100 : 50;
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className={`font-bold flex items-center gap-1.5 ${Number(metrics.change1dA) > Number(metrics.change1dB) ? 'text-white' : 'text-zinc-500'}`}>
                        {Number(metrics.change1dA) > Number(metrics.change1dB) && '🏆'} {pct(metrics.change1dA)}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">24h TVL Momentum</span>
                      <span className={`font-bold flex items-center gap-1.5 ${Number(metrics.change1dB) > Number(metrics.change1dA) ? 'text-white' : 'text-zinc-500'}`}>
                        {pct(metrics.change1dB)} {Number(metrics.change1dB) > Number(metrics.change1dA) && '🏆'}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 border border-white/5 rounded-full overflow-hidden flex">
                      <div className="h-full bg-gradient-to-r from-white to-zinc-300 shadow-[0_0_8px_rgba(255,255,255,0.15)] transition-all duration-500" style={{ width: `${pctA}%` }} />
                      <div className="h-full bg-gradient-to-r from-zinc-500 to-zinc-700 shadow-[0_0_8px_rgba(113,113,122,0.1)] transition-all duration-500" style={{ width: `${pctB}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </SpotlightCard>

          {/* Comparative Highlights Table */}
          <section className="rounded-3xl border border-white/5 bg-zinc-950/35 p-6 shadow-xl backdrop-blur-md">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-zinc-400" />
              Comparative Metric Matrix
            </h3>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  <TableHead className="text-zinc-500 uppercase text-[10px] font-black tracking-widest">Metric Dimension</TableHead>
                  <TableHead className="text-zinc-500 uppercase text-[10px] font-black tracking-widest">{metrics.nameA}</TableHead>
                  <TableHead className="text-zinc-500 uppercase text-[10px] font-black tracking-widest">{metrics.nameB}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-white/5 hover:bg-white/5">
                  <TableCell className="font-bold text-zinc-400">Total Value Locked (TVL)</TableCell>
                  <TableCell className={`font-semibold ${Number(metrics.tvlA) > Number(metrics.tvlB) ? 'text-white font-bold border-l-2 border-l-zinc-300' : 'text-zinc-400'}`}>{usd(metrics.tvlA)}</TableCell>
                  <TableCell className={`font-semibold ${Number(metrics.tvlB) > Number(metrics.tvlA) ? 'text-white font-bold border-l-2 border-l-zinc-500' : 'text-zinc-400'}`}>{usd(metrics.tvlB)}</TableCell>
                </TableRow>
                <TableRow className="border-white/5 hover:bg-white/5">
                  <TableCell className="font-bold text-zinc-400">24h TVL Momentum</TableCell>
                  <TableCell className={`font-semibold ${Number(metrics.change1dA) > Number(metrics.change1dB) ? 'text-white font-bold border-l-2 border-l-zinc-300' : 'text-zinc-400'}`}>{pct(metrics.change1dA)}</TableCell>
                  <TableCell className={`font-semibold ${Number(metrics.change1dB) > Number(metrics.change1dA) ? 'text-white font-bold border-l-2 border-l-zinc-500' : 'text-zinc-400'}`}>{pct(metrics.change1dB)}</TableCell>
                </TableRow>
                <TableRow className="border-white/5 hover:bg-white/5">
                  <TableCell className="font-bold text-zinc-400">7d TVL Momentum</TableCell>
                  <TableCell className={`font-semibold ${Number(metrics.change7dA) > Number(metrics.change7dB) ? 'text-white font-bold border-l-2 border-l-zinc-300' : 'text-zinc-400'}`}>{pct(metrics.change7dA)}</TableCell>
                  <TableCell className={`font-semibold ${Number(metrics.change7dB) > Number(metrics.change7dA) ? 'text-white font-bold border-l-2 border-l-zinc-500' : 'text-zinc-400'}`}>{pct(metrics.change7dB)}</TableCell>
                </TableRow>
                <TableRow className="border-white/5 hover:bg-white/5">
                  <TableCell className="font-bold text-zinc-400">Governance Token Price</TableCell>
                  <TableCell className="font-semibold text-zinc-200">{usd(metrics.priceA)}</TableCell>
                  <TableCell className="font-semibold text-zinc-200">{usd(metrics.priceB)}</TableCell>
                </TableRow>
                <TableRow className="border-white/5 hover:bg-white/5">
                  <TableCell className="font-bold text-zinc-400">Market Capitalization</TableCell>
                  <TableCell className="font-semibold text-zinc-200">{usd(metrics.mcapA)}</TableCell>
                  <TableCell className="font-semibold text-zinc-200">{usd(metrics.mcapB)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
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
                    <span className="text-[10px] font-black text-zinc-300 uppercase bg-zinc-800 px-2 py-0.5 rounded">STEP {i + 1}</span>
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
              <Button
                onClick={copyBriefMarkdown}
                variant="outline"
                size="sm"
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-white/5"
              >
                Copy Markdown
              </Button>
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
            <h2 className="text-2xl font-black text-white mt-10 mb-4 tracking-tight border-l-2 border-zinc-400 pl-3">
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
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-350 shadow-[0_0_10px_rgba(255,255,255,0.4)] transition-transform group-hover:scale-125" />
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
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-sm text-zinc-300">
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
