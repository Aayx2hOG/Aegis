'use client';

import { useEffect, useMemo, useState, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Swords, ArrowLeft, Zap, Search, ChevronDown, Check, Terminal, RefreshCw } from 'lucide-react';
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
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-cyan-500" />
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
    <div className="space-y-2 relative text-left" ref={dropdownRef}>
      <label className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400/80 block">
        {label}
      </label>
      
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-11 rounded-xs border border-zinc-800 bg-zinc-950/80 px-4 text-xs font-mono text-zinc-100 flex items-center justify-between outline-hidden transition-all hover:bg-zinc-950 focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="font-semibold text-zinc-100">
              {selectedOption.label.toUpperCase()}{' '}
              <span className="text-cyan-400 font-normal">
                (TVL: {formatTvl(selectedOption.tvl)})
              </span>
            </span>
          ) : (
            <span className="text-zinc-550">&gt; SELECT TARGET VECTOR...</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-cyan-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-xs border border-cyan-500/20 bg-[#070b13] p-2.5 shadow-2xl backdrop-blur-md max-h-[450px] flex flex-col">
          {/* Search Box */}
          <div className="relative mb-2 shrink-0">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-cyan-500/60 z-10" />
            <Input
              type="search"
              placeholder="Filter vectors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-10 bg-zinc-950 border-cyan-500/10 font-mono"
              autoFocus
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 divide-y divide-zinc-900 pr-1 max-h-[350px] scrollbar-thin">
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
                  className={`w-full flex items-center justify-between rounded-xs px-3.5 py-2.5 text-left text-xs transition ${
                    isSelected
                      ? 'bg-cyan-500/10 text-white border-l-2 border-cyan-500'
                      : 'text-zinc-400 hover:bg-zinc-950 hover:text-cyan-400 font-mono'
                  }`}
                >
                  <div className="truncate">
                    <span className="font-bold block truncate uppercase">{opt.label}</span>
                    <span className="text-[10px] text-zinc-400 block truncate font-mono uppercase mt-0.5">
                      {opt.category ?? 'DeFi'} • {opt.slug}
                    </span>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <span className="text-[8px] text-zinc-500 block uppercase tracking-wider">TVL</span>
                      <span className="text-zinc-300 font-semibold">{formatTvl(opt.tvl)}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                </button>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="p-4 text-center text-xs text-zinc-550 font-mono">&gt; Vector mismatch. Try another query.</div>
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
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([]);

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

  // Loading console log simulation
  useEffect(() => {
    if (!loading) {
      setSimulatedLogs([]);
      return;
    }
    const rawLogs = [
      `Locking comparative parameters on ${formatProtocolName(protocolA).toUpperCase()}...`,
      `Locking comparative parameters on ${formatProtocolName(protocolB).toUpperCase()}...`,
      `Synthesizing security vector mappings for dual nodes...`,
      `Calculating TVL differentials and token metrics...`,
      `Deploying neural models for head-to-head analysis...`,
      `Dossier compiling. Reviewing smart contract risk weights...`
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
    }, 2000);

    return () => clearInterval(timer);
  }, [loading, protocolA, protocolB]);

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
      const data = (await res.json()) as ResearchBrief;
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
    <div className="mx-auto max-w-5xl space-y-8 py-6 px-2 cyber-grid">
      {/* Navigation back & Header */}
      <header className="space-y-4 text-left">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/research">
              <span className="inline-flex items-center justify-center gap-1.5 font-orbitron font-bold border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900 text-zinc-300 rounded-xs text-xs px-3.5 py-2 cursor-pointer transition-all">
                <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" /> Back to Research
              </span>
            </Link>
            <Badge variant="accent" className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-orbitron font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)] bg-cyan-950/20 text-cyan-400 border-cyan-500/20">
              <Swords className="w-3.5 h-3.5 inline mr-1.5" /> Arena Battleground
            </Badge>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-orbitron font-black tracking-wide text-white md:text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.08)] uppercase">
            Protocol <span className="text-cyan-400 font-black">Battleground</span>
          </h1>
          <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-zinc-400">
            Conduct quantitative metrics audit and comparative security reviews for any two registered DeFi platforms side-by-side.
          </p>
        </div>
      </header>

      {/* Protocol Selector Arena */}
      <section className="relative z-45 rounded-xl border border-cyan-500/10 bg-zinc-950/40 p-6 shadow-xl md:p-8 corner-decor">
        <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] items-start">
          {/* Protocol A Selector */}
          <SearchableDropdown
            value={protocolA}
            onChange={setProtocolA}
            options={supportedProtocols}
            disabled={loading}
            label="DeFi Target Vector A"
          />
 
          {/* Battle Icon */}
          <div className="flex justify-center pt-6">
            <div className="w-11 h-11 rounded-full border border-cyan-500/20 bg-cyan-950/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)] animate-pulse">
              <Swords className="w-5 h-5" />
            </div>
          </div>
 
          {/* Protocol B Selector */}
          <SearchableDropdown
            value={protocolB}
            onChange={setProtocolB}
            options={supportedProtocols}
            disabled={loading}
            label="DeFi Target Vector B"
          />
        </div>
 
        <div className="mt-8 flex justify-center">
          <Button
            onClick={() => void runComparison(protocolA, protocolB)}
            disabled={loading || protocolsLoading || !protocolA || !protocolB || protocolA === protocolB}
            className="px-8 h-11 rounded-xs bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-black uppercase tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
          >
            <Zap className="w-4.5 h-4.5 fill-current text-zinc-950" /> Initiate Target Comparison
          </Button>
        </div>
      </section>
 
      {/* Loading State (Console Terminal Logger) */}
      {loading && (
        <div className="animate-in slide-in-from-bottom-4 fade-in overflow-hidden rounded-xl bg-zinc-950 border border-cyan-500/15 backdrop-blur-md duration-500 relative min-h-[16rem] flex flex-col justify-between shadow-2xl corner-decor">
          <div className="border-b border-cyan-500/15 bg-zinc-900/50 px-4 py-2 flex items-center justify-between text-cyan-400/80 font-mono text-xs">
            <span className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5" /> DECOMPOSING DUAL VECTORS</span>
            <span className="text-zinc-550 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> COMPARISON: RUNNING</span>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-start space-y-2 font-mono text-xs text-left overflow-y-auto">
            {simulatedLogs.map((log, index) => (
              <div key={index} className="text-cyan-400/90 tracking-wide font-light">
                {log}
              </div>
            ))}
            <div className="text-white font-bold flex items-center gap-1 animate-pulse">
              <span>&gt; RESOLVING COMPARATIVE METRIC MATRICES</span>
              <span className="h-3 w-1.5 bg-white inline-block animate-caret" />
            </div>
          </div>
          
          <div className="border-t border-cyan-500/10 p-3 bg-cyan-950/5 text-center">
            <p className="text-[10px] uppercase font-orbitron font-bold tracking-widest text-cyan-500/60">AUDITING CONTRACT STATES IN PARALLEL</p>
          </div>
        </div>
      )}
 
      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xs bg-rose-500/5 border border-rose-500/20 text-rose-300 text-xs font-mono flex items-start gap-3 text-left">
          <span className="mt-0.5">⚠️ ARENA FAILURE:</span>
          <p className="flex-1 font-semibold">{error}</p>
        </div>
      )}
 
      {/* Results Panel */}
      {brief && metrics && !loading && (
        <div className="animate-in fade-in duration-700 space-y-8 text-left">
          {/* Quick Stats side-by-side card comparisons */}
          <section className="grid gap-6 md:grid-cols-2">
            {/* Protocol A Card */}
            <SpotlightCard
              spotlightColor="rgba(6, 182, 212, 0.04)"
              borderColor="rgba(6, 182, 212, 0.2)"
              className="relative overflow-hidden border border-cyan-500/10 bg-zinc-950/40 p-6 shadow-xl rounded-xl corner-decor"
            >
              <span className="text-[9px] font-orbitron font-bold uppercase tracking-widest text-cyan-400 bg-cyan-950/30 border border-cyan-500/20 px-2.5 py-0.5 rounded-xs">VECTOR A</span>
              <h2 className="text-2xl font-orbitron font-black text-white mt-4 capitalize tracking-wide">{metrics.nameA}</h2>
              <p className="text-[10px] text-zinc-550 font-mono mt-1 uppercase tracking-wider">{metrics.categoryA}</p>
              <div className="grid grid-cols-2 gap-4 mt-6 font-mono border-t border-zinc-900 pt-4">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Total TVL</span>
                  <span className="text-base font-bold text-white mt-1 block">{usd(metrics.tvlA)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Token Price</span>
                  <span className="text-base font-bold text-cyan-400 mt-1 block">{usd(metrics.priceA)}</span>
                </div>
              </div>
              <div className="mt-6">
                <Button asChild className="border border-cyan-500/15 bg-cyan-500/5 text-cyan-400 hover:text-white hover:bg-cyan-500/20 w-full h-10 rounded-xs font-orbitron font-bold uppercase tracking-wider cursor-pointer">
                  <Link href={`/war-room?protocol=${encodeURIComponent(protocolA.toLowerCase())}`}>
                    Stress Test Vector A
                  </Link>
                </Button>
              </div>
            </SpotlightCard>
 
            {/* Protocol B Card */}
            <SpotlightCard
              spotlightColor="rgba(6, 182, 212, 0.04)"
              borderColor="rgba(6, 182, 212, 0.2)"
              className="relative overflow-hidden border border-cyan-500/10 bg-zinc-950/40 p-6 shadow-xl rounded-xl corner-decor"
            >
              <span className="text-[9px] font-orbitron font-bold uppercase tracking-widest text-cyan-400 bg-cyan-950/30 border border-cyan-500/20 px-2.5 py-0.5 rounded-xs">VECTOR B</span>
              <h2 className="text-2xl font-orbitron font-black text-white mt-4 capitalize tracking-wide">{metrics.nameB}</h2>
              <p className="text-[10px] text-zinc-550 font-mono mt-1 uppercase tracking-wider">{metrics.categoryB}</p>
              <div className="grid grid-cols-2 gap-4 mt-6 font-mono border-t border-zinc-900 pt-4">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Total TVL</span>
                  <span className="text-base font-bold text-white mt-1 block">{usd(metrics.tvlB)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">Token Price</span>
                  <span className="text-base font-bold text-cyan-400 mt-1 block">{usd(metrics.priceB)}</span>
                </div>
              </div>
              <div className="mt-6">
                <Button asChild className="border border-cyan-500/15 bg-cyan-500/5 text-cyan-400 hover:text-white hover:bg-cyan-500/20 w-full h-10 rounded-xs font-orbitron font-bold uppercase tracking-wider cursor-pointer">
                  <Link href={`/war-room?protocol=${encodeURIComponent(protocolB.toLowerCase())}`}>
                    Stress Test Vector B
                  </Link>
                </Button>
              </div>
            </SpotlightCard>
          </section>
 
          {/* Interactive Visual Comparison Gauges */}
          <SpotlightCard spotlightColor="rgba(6, 182, 212, 0.03)" borderColor="rgba(6, 182, 212, 0.15)" className="rounded-xl border border-cyan-500/10 bg-zinc-950/50 p-6">
            <h3 className="text-xs font-orbitron font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-cyan-400 animate-pulse rounded-full" />
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
                  <div className="space-y-2 text-left">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className={`font-bold flex items-center gap-1.5 ${tvlA > tvlB ? 'text-cyan-450 font-bold' : 'text-zinc-500'}`}>
                        {tvlA > tvlB && '🏆'} {usd(metrics.tvlA)}
                      </span>
                      <span className="text-[9px] font-orbitron font-bold uppercase tracking-widest text-zinc-500">Total Value Locked Balance</span>
                      <span className={`font-bold flex items-center gap-1.5 ${tvlB > tvlA ? 'text-cyan-450 font-bold' : 'text-zinc-500'}`}>
                        {usd(metrics.tvlB)} {tvlB > tvlA && '🏆'}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 border border-zinc-900 rounded-xs overflow-hidden flex">
                      <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all duration-500" style={{ width: `${pctA}%` }} />
                      <div className="h-full bg-gradient-to-r from-zinc-700 to-zinc-800 transition-all duration-500" style={{ width: `${pctB}%` }} />
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
                  <div className="space-y-2 text-left">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className={`font-bold flex items-center gap-1.5 ${mcapA > mcapB ? 'text-cyan-455 font-bold' : 'text-zinc-500'}`}>
                        {mcapA > mcapB && '🏆'} {usd(metrics.mcapA)}
                      </span>
                      <span className="text-[9px] font-orbitron font-bold uppercase tracking-widest text-zinc-500">Market Capitalization Volume</span>
                      <span className={`font-bold flex items-center gap-1.5 ${mcapB > mcapA ? 'text-cyan-455 font-bold' : 'text-zinc-500'}`}>
                        {usd(metrics.mcapB)} {mcapB > mcapA && '🏆'}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 border border-zinc-900 rounded-xs overflow-hidden flex">
                      <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all duration-500" style={{ width: `${pctA}%` }} />
                      <div className="h-full bg-gradient-to-r from-zinc-700 to-zinc-800 transition-all duration-500" style={{ width: `${pctB}%` }} />
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
                  <div className="space-y-2 text-left">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className={`font-bold flex items-center gap-1.5 ${Number(metrics.change1dA) > Number(metrics.change1dB) ? 'text-cyan-450 font-bold' : 'text-zinc-500'}`}>
                        {Number(metrics.change1dA) > Number(metrics.change1dB) && '🏆'} {pct(metrics.change1dA)}
                      </span>
                      <span className="text-[9px] font-orbitron font-bold uppercase tracking-widest text-zinc-500">24H Net TVL Delta Velocity</span>
                      <span className={`font-bold flex items-center gap-1.5 ${Number(metrics.change1dB) > Number(metrics.change1dA) ? 'text-cyan-450 font-bold' : 'text-zinc-500'}`}>
                        {pct(metrics.change1dB)} {Number(metrics.change1dB) > Number(metrics.change1dA) && '🏆'}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-zinc-950 border border-zinc-900 rounded-xs overflow-hidden flex">
                      <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all duration-500" style={{ width: `${pctA}%` }} />
                      <div className="h-full bg-gradient-to-r from-zinc-700 to-zinc-800 transition-all duration-500" style={{ width: `${pctB}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </SpotlightCard>
 
          {/* Comparative Highlights Table */}
          <section className="rounded-xl border border-zinc-850 bg-zinc-950/45 p-6 shadow-xl backdrop-blur-md">
            <h3 className="text-xs font-orbitron font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-cyan-500 rounded-full" />
              Comparative Metric Matrix
            </h3>
            <Table className="font-mono text-xs text-left">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-zinc-850">
                  <TableHead className="text-zinc-500 uppercase text-[9px] font-bold tracking-wider">Telemetry Dimension</TableHead>
                  <TableHead className="text-cyan-400 uppercase text-[9px] font-bold tracking-wider">{metrics.nameA}</TableHead>
                  <TableHead className="text-cyan-400 uppercase text-[9px] font-bold tracking-wider">{metrics.nameB}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-zinc-900 hover:bg-zinc-900/40">
                  <TableCell className="font-semibold text-zinc-400">Total Value Locked (TVL)</TableCell>
                  <TableCell className={`font-medium ${Number(metrics.tvlA) > Number(metrics.tvlB) ? 'text-white border-l-2 border-l-cyan-500 pl-3 font-semibold' : 'text-zinc-400'}`}>{usd(metrics.tvlA)}</TableCell>
                  <TableCell className={`font-medium ${Number(metrics.tvlB) > Number(metrics.tvlA) ? 'text-white border-l-2 border-l-cyan-500 pl-3 font-semibold' : 'text-zinc-400'}`}>{usd(metrics.tvlB)}</TableCell>
                </TableRow>
                <TableRow className="border-zinc-900 hover:bg-zinc-900/40">
                  <TableCell className="font-semibold text-zinc-400">24H TVL Momentum</TableCell>
                  <TableCell className={`font-medium ${Number(metrics.change1dA) > Number(metrics.change1dB) ? 'text-white border-l-2 border-l-cyan-500 pl-3 font-semibold' : 'text-zinc-400'}`}>{pct(metrics.change1dA)}</TableCell>
                  <TableCell className={`font-medium ${Number(metrics.change1dB) > Number(metrics.change1dA) ? 'text-white border-l-2 border-l-cyan-500 pl-3 font-semibold' : 'text-zinc-400'}`}>{pct(metrics.change1dB)}</TableCell>
                </TableRow>
                <TableRow className="border-zinc-900 hover:bg-zinc-900/40">
                  <TableCell className="font-semibold text-zinc-400">7D TVL Momentum</TableCell>
                  <TableCell className={`font-medium ${Number(metrics.change7dA) > Number(metrics.change7dB) ? 'text-white border-l-2 border-l-cyan-500 pl-3 font-semibold' : 'text-zinc-400'}`}>{pct(metrics.change7dA)}</TableCell>
                  <TableCell className={`font-medium ${Number(metrics.change7dB) > Number(metrics.change7dA) ? 'text-white border-l-2 border-l-cyan-500 pl-3 font-semibold' : 'text-zinc-400'}`}>{pct(metrics.change7dB)}</TableCell>
                </TableRow>
                <TableRow className="border-zinc-900 hover:bg-zinc-900/40">
                  <TableCell className="font-semibold text-zinc-400">Governance Token Valuation</TableCell>
                  <TableCell className="font-semibold text-zinc-200">{usd(metrics.priceA)}</TableCell>
                  <TableCell className="font-semibold text-zinc-200">{usd(metrics.priceB)}</TableCell>
                </TableRow>
                <TableRow className="border-zinc-900 hover:bg-zinc-900/40">
                  <TableCell className="font-semibold text-zinc-400">Token Market Cap</TableCell>
                  <TableCell className="font-semibold text-zinc-200">{usd(metrics.mcapA)}</TableCell>
                  <TableCell className="font-semibold text-zinc-200">{usd(metrics.mcapB)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>
 
          {/* Analyst Thinking Trace */}
          <details className="group border border-zinc-850 p-4 bg-zinc-950/30 rounded-xs">
            <summary className="flex list-none cursor-pointer items-center gap-2 text-zinc-500 transition-colors hover:text-zinc-300 font-mono text-xs">
              <div className="w-5 h-5 flex items-center justify-center rounded-sm bg-zinc-900 border border-zinc-800 group-open:rotate-180 transition-transform">
                <svg className="w-3 h-3 fill-cyan-400" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
              </div>
              <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest">&gt; TELEMETRY QUERY PIPELINE ({brief.toolCalls.length} TRACES)</span>
            </summary>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {brief.toolCalls.map((tc, i) => (
                <div key={i} className="p-4 rounded-xs bg-zinc-950/90 flex flex-col gap-2 border border-zinc-850 text-xs">
                  <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5 mb-1 font-mono text-[9px]">
                    <span className="font-bold text-cyan-400">TRACE {i + 1}</span>
                    <span className="text-zinc-550">{tc.durationMs}ms</span>
                  </div>
                  <div className="font-mono text-xs font-bold text-white uppercase tracking-wider">{tc.tool}</div>
                  <div className="text-[10px] text-zinc-500 truncate font-mono italic">input: {JSON.stringify(tc.input)}</div>
                  {tc.error && <div className="text-[10px] text-rose-500 mt-1 font-mono uppercase font-bold">Trace Error: {tc.error}</div>}
                </div>
              ))}
            </div>
          </details>
 
          {/* Comparative AI Report (Battle Card Dossier) */}
          <article className="relative overflow-hidden rounded-xl bg-zinc-950/70 border border-cyan-500/15 shadow-[0_15px_50px_rgba(0,0,0,0.6)] corner-decor">
            {/* Dossier Header Strip */}
            <div className="border-b border-cyan-500/15 bg-cyan-950/15 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <span className="font-orbitron font-black text-xs uppercase tracking-widest text-cyan-400">
                COMPARATIVE EVALUATION DOSSIER // DEFI ARENA BATTLE CARD
              </span>
              <Button
                onClick={copyBriefMarkdown}
                variant="outline"
                size="sm"
                className="bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-300 font-mono text-xs rounded-xs"
              >
                Copy Markdown Brief
              </Button>
            </div>
 
            <div className="p-6 md:p-10 text-left">
              <MarkdownBrief content={brief.brief} />
            </div>
          </article>
 
          {/* Footer tip */}
          <div className="text-center pb-20">
            <p className="text-zinc-650 font-mono text-xs">&gt; HEAD-TO-HEAD SYNTHESIS COMPLETED. TELEMETRY CACHE IN EQUILIBRIUM.</p>
          </div>
        </div>
      )}
    </div>
  );
}

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
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-cyan-500/50 border border-cyan-500/70" />
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
