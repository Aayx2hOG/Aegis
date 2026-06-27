'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { ArrowLeft, Check, ChevronRight, ExternalLink, Info, Loader2, Plus, Search, X } from 'lucide-react'

import { useMultiChain } from '@/components/chain/chain-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatUsd } from '@/lib/format/number'
import { useProtocolYields } from '@/lib/hooks/use-defillama-yields'
import { useChainProtocols } from '@/lib/hooks/use-defillama'
import { useWatchlist } from '@/lib/hooks/use-multichain-watchlist'
import { getOpportunityRiskFlags } from '@/lib/opportunities/risk-flags'
import { getProtocolAuditEvidence } from '@/lib/opportunities/audit-evidence'
import {
  scoreOpportunities,
  type OpportunityInput,
  type OpportunityProfile,
  type OpportunityScore,
} from '@/lib/opportunities/scoring'
import { getProtocolSlugCandidates, normalizeProtocolSlug } from '@/lib/protocol/slug-resolver'
import { findProtocolYieldSummary, type ProtocolYieldSummary } from '@/lib/opportunities/yields'

const MIN_SELECTIONS = 2
const MAX_SELECTIONS = 5
const EXCLUDED_CATEGORIES = new Set([
  'CEX',
  'CeFi',
  'Centralized Exchange',
  'Indexes',
  'Portfolio Tracker',
  'Risk Curators',
  'Wallet',
])

const PROFILES: Array<{ id: OpportunityProfile; label: string; hint: string }> = [
  { id: 'conservative', label: 'Safer', hint: 'Scale and stability matter most' },
  { id: 'balanced', label: 'Balanced', hint: 'Balances scale, momentum, stability, and yield' },
  { id: 'aggressive', label: 'Growth', hint: 'Momentum and current yield matter most' },
]

const HISTORY_KEY = 'aegis-opportunity-history-v1'

type ComparisonHistoryEntry = {
  capturedAt: string
  protocols: Record<string, { rank: number; score: number; tvl: number; apy: number | null }>
}

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatApy(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`
}

function formatChainName(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function loadComparisonHistory(): Record<string, ComparisonHistoryEntry> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? '{}') as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ComparisonHistoryEntry>) : {}
  } catch {
    return {}
  }
}

function findYieldSummary(protocol: Pick<OpportunityInput, 'slug' | 'name'>, summaries: ProtocolYieldSummary[]) {
  return findProtocolYieldSummary(protocol, summaries, getProtocolSlugCandidates(protocol.slug))
}

function scoreColor(score: number) {
  if (score >= 75) return 'text-emerald-300'
  if (score >= 50) return 'text-cyan-300'
  return 'text-amber-300'
}

function stabilityColor(stability: OpportunityScore['stabilityBand']) {
  if (stability === 'Stable') return 'text-emerald-300'
  if (stability === 'Volatile') return 'text-rose-300'
  return 'text-amber-300'
}

function leaderReasons(leader: OpportunityScore, rankings: OpportunityScore[]) {
  const reasons: string[] = []
  const largestTvl = Math.max(...rankings.map((item) => item.tvl))
  const strongestMomentum = Math.max(...rankings.map((item) => item.momentumScore))
  const strongestStability = Math.max(...rankings.map((item) => item.stabilityScore))

  if (leader.tvl === largestTvl) reasons.push('Largest TVL in this comparison')
  if (leader.momentumScore === strongestMomentum) reasons.push('Strongest recent TVL momentum')
  if (leader.stabilityScore === strongestStability) reasons.push('Most stable recent movement')
  if (reasons.length === 0) reasons.push('Best combined score across the selected factors')
  return reasons.slice(0, 2)
}

function plainLanguageSignals(protocol: OpportunityScore) {
  const signals: string[] = []
  if (protocol.scaleScore >= 67) signals.push('Strong chain-specific TVL compared with the selected protocols')
  if (protocol.momentumScore >= 67) signals.push('Recent TVL trend is stronger than the selected alternatives')
  if (protocol.stabilityScore >= 75) signals.push('Recent TVL movement has been comparatively stable')
  if (protocol.yieldScore >= 67) signals.push('Representative current APY is competitive in this comparison')
  if (signals.length === 0) signals.push('The result comes from its combined market profile, not one dominant factor')
  return signals.slice(0, 3)
}

function OpportunityFinderContent() {
  const searchParams = useSearchParams()
  const { activeChain } = useMultiChain()
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58()
  const {
    data: chainProtocols = [],
    isLoading,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useChainProtocols(activeChain.type)
  const yieldQuery = useProtocolYields(activeChain.type)
  const savedQuery = useWatchlist(activeChain.type, activeChain.environment, walletAddress)
  const [profile, setProfile] = useState<OpportunityProfile>('balanced')
  const [selectionsByChain, setSelectionsByChain] = useState<Record<string, string[]>>({})
  const [search, setSearch] = useState('')
  const [depositAmount, setDepositAmount] = useState('1000')
  const [comparisonHistory] = useState<Record<string, ComparisonHistoryEntry>>(loadComparisonHistory)

  const baseProtocols = useMemo<OpportunityInput[]>(() => {
    const deduped = new Map<string, OpportunityInput>()

    chainProtocols.forEach((protocol) => {
      const slug = normalizeProtocolSlug(protocol.slug)
      const category = protocol.category ?? 'DeFi'
      if (!slug || EXCLUDED_CATEGORIES.has(category) || deduped.has(slug)) return

      deduped.set(slug, {
        slug,
        name: protocol.name || slug,
        category,
        tvl: protocol.tvl ?? 0,
        change1d: protocol.change_1d,
        change7d: protocol.change_7d,
        audits: protocol.audits,
      })
    })

    return Array.from(deduped.values()).sort((a, b) => b.tvl - a.tvl)
  }, [chainProtocols])

  const yieldSummaries = useMemo(() => yieldQuery.data?.data ?? [], [yieldQuery.data?.data])
  const protocols = useMemo<OpportunityInput[]>(
    () =>
      baseProtocols.map((protocol) => ({
        ...protocol,
        apy: findYieldSummary(protocol, yieldSummaries)?.apy ?? null,
      })),
    [baseProtocols, yieldSummaries],
  )

  const defaultSelections = useMemo(() => {
    const requested = (searchParams.get('protocols') ?? searchParams.get('protocol') ?? '')
      .split(',')
      .map(normalizeProtocolSlug)
      .filter((slug) => protocols.some((protocol) => protocol.slug === slug))
    const requestedSlugs = Array.from(new Set(requested))
    const defaults = protocols.map((protocol) => protocol.slug).filter((slug) => !requestedSlugs.includes(slug))
    return [...requestedSlugs, ...defaults].slice(0, Math.max(3, requestedSlugs.length))
  }, [protocols, searchParams])

  const chainSelectionKey = activeChain.type
  const selectedSlugs = selectionsByChain[chainSelectionKey] ?? defaultSelections
  const selectedProtocols = useMemo(
    () =>
      selectedSlugs
        .map((slug) => protocols.find((protocol) => protocol.slug === slug))
        .filter((protocol): protocol is OpportunityInput => Boolean(protocol)),
    [protocols, selectedSlugs],
  )
  const rankings = useMemo(() => scoreOpportunities(selectedProtocols, profile), [profile, selectedProtocols])
  const leader = rankings[0]
  const yieldIncludedInScore = leader?.includedFactors.yield ?? false
  const leaderYieldSummary = leader ? findYieldSummary(leader, yieldSummaries) : undefined
  const depositValue = Math.max(0, Number(depositAmount) || 0)
  const historySignature = `${activeChain.type}:${profile}:${[...selectedSlugs].sort().join(',')}`
  const previousComparison = comparisonHistory[historySignature]
  const dataUpdatedLabel = dataUpdatedAt
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(
        new Date(dataUpdatedAt),
      )
    : 'Waiting for live data'
  const yieldUpdatedLabel = yieldQuery.data?.fetchedAt
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(
        new Date(yieldQuery.data.fetchedAt),
      )
    : yieldQuery.isLoading
      ? 'Loading'
      : 'Unavailable'

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    return protocols
      .filter(
        (protocol) =>
          !selectedSlugs.includes(protocol.slug) &&
          (protocol.name.toLowerCase().includes(query) ||
            protocol.slug.includes(query) ||
            protocol.category?.toLowerCase().includes(query)),
      )
      .slice(0, 6)
  }, [protocols, search, selectedSlugs])

  const quickAdds = protocols.filter((protocol) => !selectedSlugs.includes(protocol.slug)).slice(0, 5)
  const savedProtocolSlugs = (savedQuery.data ?? []).filter((slug) =>
    protocols.some((protocol) => protocol.slug === normalizeProtocolSlug(slug)),
  )

  useEffect(() => {
    if (rankings.length < MIN_SELECTIONS || dataUpdatedAt === 0) return
    const nextEntry: ComparisonHistoryEntry = {
      capturedAt: new Date(dataUpdatedAt).toISOString(),
      protocols: Object.fromEntries(
        rankings.map((protocol) => [
          protocol.slug,
          { rank: protocol.rank, score: protocol.score, tvl: protocol.tvl, apy: protocol.apy ?? null },
        ]),
      ),
    }
    try {
      const current = loadComparisonHistory()
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify({ ...current, [historySignature]: nextEntry }))
    } catch {
      // Comparison history is a progressive enhancement.
    }
  }, [dataUpdatedAt, historySignature, rankings])

  function updateSelection(next: string[]) {
    setSelectionsByChain((current) => ({ ...current, [chainSelectionKey]: next }))
  }

  function addProtocol(slug: string) {
    if (selectedSlugs.length >= MAX_SELECTIONS || selectedSlugs.includes(slug)) return
    updateSelection([...selectedSlugs, slug])
    setSearch('')
  }

  function removeProtocol(slug: string) {
    if (selectedSlugs.length <= MIN_SELECTIONS) return
    updateSelection(selectedSlugs.filter((item) => item !== slug))
  }

  function useSavedProtocols() {
    const next = Array.from(new Set(savedProtocolSlugs.map(normalizeProtocolSlug))).slice(0, MAX_SELECTIONS)
    if (next.length >= MIN_SELECTIONS) updateSelection(next)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-2 py-6">
      <header>
        <Link
          href="/research"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Research
        </Link>
        <div className="mt-5 max-w-3xl">
          <p className="finance-label text-cyan-300">Opportunity Finder</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Which protocol looks strongest right now?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Compare 2–5 protocols using mainnet TVL, current yield, recent growth, and stability.
          </p>
          <p className="mt-2 text-xs font-semibold text-cyan-300">
            {formatChainName(activeChain.type)} market · mainnet market data
          </p>
        </div>
      </header>

      <section className="finance-surface p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Protocols</p>
              <div className="flex items-center gap-3">
                {savedProtocolSlugs.length >= MIN_SELECTIONS && (
                  <button
                    type="button"
                    onClick={useSavedProtocols}
                    className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                  >
                    Use saved protocols
                  </button>
                )}
                <span className="text-xs text-zinc-500">
                  {selectedSlugs.length}/{MAX_SELECTIONS}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {selectedProtocols.map((protocol) => (
                <span
                  key={protocol.slug}
                  className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-zinc-100"
                >
                  {protocol.name}
                  <button
                    type="button"
                    onClick={() => removeProtocol(protocol.slug)}
                    disabled={selectedSlugs.length <= MIN_SELECTIONS}
                    aria-label={`Remove ${protocol.name}`}
                    className="text-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>

            {selectedSlugs.length < MAX_SELECTIONS && (
              <div className="relative mt-3 max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Add another protocol"
                  className="pl-9"
                />
                {search.trim() && (
                  <div className="absolute inset-x-0 top-12 z-30 overflow-hidden rounded-md border border-white/10 bg-zinc-950 shadow-2xl">
                    {searchResults.length > 0 ? (
                      searchResults.map((protocol) => (
                        <button
                          key={protocol.slug}
                          type="button"
                          onClick={() => addProtocol(protocol.slug)}
                          className="flex w-full items-center justify-between gap-3 border-b border-white/5 px-3 py-2.5 text-left last:border-0 hover:bg-white/[0.05]"
                        >
                          <span>
                            <span className="block text-sm font-medium text-white">{protocol.name}</span>
                            <span className="block text-xs text-zinc-500">{protocol.category}</span>
                          </span>
                          <span className="text-xs text-zinc-400">{formatUsd(protocol.tvl)} TVL</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-4 text-sm text-zinc-500">No matching protocols.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {!search && quickAdds.length > 0 && selectedSlugs.length < MAX_SELECTIONS && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">Quick add:</span>
                {quickAdds.map((protocol) => (
                  <button
                    key={protocol.slug}
                    type="button"
                    onClick={() => addProtocol(protocol.slug)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400 hover:border-cyan-300/20 hover:text-cyan-200"
                  >
                    <Plus className="h-3 w-3" />
                    {protocol.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-full border-t border-white/10 pt-4 lg:w-[310px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <p className="text-sm font-semibold text-white">What matters to you?</p>
            <div className="mt-3 grid grid-cols-3 rounded-md border border-white/10 bg-zinc-950/50 p-1">
              {PROFILES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  title={option.hint}
                  onClick={() => setProfile(option.id)}
                  className={`rounded px-2 py-2 text-xs font-semibold transition ${
                    profile === option.id ? 'bg-cyan-300 text-zinc-950' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">{PROFILES.find((option) => option.id === profile)?.hint}.</p>
          </div>
        </div>
      </section>

      {isLoading && (
        <div className="finance-surface flex items-center justify-center gap-2 p-10 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading live protocol data
        </div>
      )}

      {error && (
        <div className="finance-surface flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold text-rose-300">Protocol data could not be loaded.</p>
            <p className="mt-1 text-xs text-zinc-500">Check your connection and try the live feed again.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isFetching}
            onClick={() => void refetch()}
            className="border-white/10"
          >
            {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && protocols.length === 0 && (
        <div className="finance-surface p-5">
          <p className="text-sm font-semibold text-zinc-200">No protocols were returned for this chain.</p>
          <p className="mt-1 text-xs text-zinc-500">Switch chains or retry when the market-data feed is available.</p>
        </div>
      )}

      {leader && rankings.length >= MIN_SELECTIONS && !isLoading && (
        <>
          <section className="overflow-hidden rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06]">
            <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
              <div>
                <p className="finance-label text-emerald-300">Best current match · {profile}</p>
                <h2 className="mt-2 text-2xl font-bold text-white">{leader.name}</h2>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {leaderReasons(leader, rankings).map((reason) => (
                    <span key={reason} className="inline-flex items-center gap-1.5 text-sm text-zinc-300">
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="block text-right text-3xl font-bold text-emerald-300">{leader.score}</span>
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">Relative score</span>
                </div>
                <Button asChild className="aegis-button-primary">
                  <Link href={`/protocol/${encodeURIComponent(leader.slug)}`}>
                    Review
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 border-t border-emerald-300/10 bg-zinc-950/25 px-5 py-4 sm:grid-cols-[minmax(160px,0.55fr)_1fr] md:px-6">
              <label className="text-xs font-semibold text-zinc-300">
                Estimate yield on
                <span className="mt-1 flex items-center rounded-md border border-white/10 bg-zinc-950/60 px-3">
                  <span className="text-zinc-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                    className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none"
                  />
                </span>
              </label>
              <div className="flex items-end justify-between gap-4 rounded-md border border-white/10 bg-zinc-950/40 px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Representative current APY</p>
                  <p className="mt-1 text-lg font-semibold text-white">{formatApy(leader.apy)}</p>
                  {leaderYieldSummary && !leaderYieldSummary.isCurrentChain && (
                    <p className="mt-0.5 text-[10px] text-amber-300">Available on {leaderYieldSummary.poolChain}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Estimated annual yield</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-300">
                    {leader.apy == null ? 'Unavailable' : formatUsd((depositValue * leader.apy) / 100)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="finance-surface overflow-hidden">
            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">Full comparison</h2>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>TVL updated {dataUpdatedLabel}</span>
                    <span>Yields updated {yieldUpdatedLabel}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-zinc-300">Rules-based</span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-zinc-300">
                    Same inputs for every protocol
                  </span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-zinc-300">
                    No manual overrides
                  </span>
                  {!yieldIncludedInScore && (
                    <span className="rounded-full border border-amber-300/20 px-2.5 py-1 text-amber-300">
                      Yield excluded from score · incomplete coverage
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-white/10 text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Rank</th>
                    <th className="px-4 py-3 font-semibold">Protocol</th>
                    <th className="px-4 py-3 font-semibold">TVL</th>
                    <th className="px-4 py-3 font-semibold">Current APY</th>
                    <th className="px-4 py-3 font-semibold">Est. yearly</th>
                    <th className="px-4 py-3 font-semibold">7d</th>
                    <th className="px-4 py-3 font-semibold">Market stability</th>
                    <th className="px-4 py-3 text-right font-semibold">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((protocol) => {
                    const yieldSummary = findYieldSummary(protocol, yieldSummaries)
                    const riskFlags = getOpportunityRiskFlags(protocol, yieldSummary)
                    const auditEvidence = getProtocolAuditEvidence(protocol)
                    const previous = previousComparison?.protocols[protocol.slug]
                    const rankMovement = previous ? previous.rank - protocol.rank : 0

                    return (
                      <tr key={protocol.slug} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3 font-mono text-zinc-500">#{protocol.rank}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/protocol/${encodeURIComponent(protocol.slug)}`}
                            className="font-semibold text-white hover:text-cyan-200"
                          >
                            {protocol.name}
                          </Link>
                          <span className="mt-0.5 block text-xs text-zinc-500">{protocol.category}</span>
                          {previous && (
                            <span
                              className={`mt-1 block text-[11px] ${
                                rankMovement > 0
                                  ? 'text-emerald-300'
                                  : rankMovement < 0
                                    ? 'text-rose-300'
                                    : 'text-zinc-500'
                              }`}
                            >
                              {rankMovement > 0
                                ? `Up ${rankMovement} rank${rankMovement === 1 ? '' : 's'} since last comparison`
                                : rankMovement < 0
                                  ? `Down ${Math.abs(rankMovement)} rank${rankMovement === -1 ? '' : 's'} since last comparison`
                                  : 'Rank unchanged since last comparison'}
                            </span>
                          )}
                          <details className="group mt-2">
                            <summary className="cursor-pointer list-none text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                              Why this score?
                            </summary>
                            <div className="mt-3 w-[min(560px,75vw)] space-y-3 rounded-md border border-white/10 bg-zinc-950/80 p-3">
                              <div className="rounded-md border border-emerald-300/15 bg-emerald-300/[0.05] p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-emerald-200">Data verification</p>
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                                    Deterministic result
                                  </span>
                                </div>
                                <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                                  DeFiLlama market and yield data is processed with the same published rules for every
                                  protocol. AI cannot alter the score, and there are no protocol-specific manual
                                  adjustments.
                                </p>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                                  <span>Coverage: {protocol.dataCompleteness}%</span>
                                  <span>Updated: {dataUpdatedLabel}</span>
                                  <span>Source: DeFiLlama</span>
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                                  What supported this result
                                </p>
                                <div className="mt-2 space-y-1.5">
                                  {plainLanguageSignals(protocol).map((signal) => (
                                    <p key={signal} className="flex gap-2 text-xs text-zinc-300">
                                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                                      {signal}
                                    </p>
                                  ))}
                                </div>
                              </div>
                              {auditEvidence && (
                                <div className="rounded-md border border-cyan-300/15 bg-cyan-300/[0.05] p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-cyan-100">{auditEvidence.label}</p>
                                    <span className="rounded-full border border-cyan-300/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300">
                                      {auditEvidence.type}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                                    {auditEvidence.summary}
                                  </p>
                                  <a
                                    href={auditEvidence.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
                                  >
                                    Verify: {auditEvidence.sourceLabel}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                  {auditEvidence.reviewedAt && (
                                    <p className="mt-1 text-[10px] text-zinc-500">
                                      Evidence reviewed {auditEvidence.reviewedAt}
                                    </p>
                                  )}
                                </div>
                              )}
                              {riskFlags.length > 0 && (
                                <div className="border-t border-white/10 pt-3">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                                    Important checks
                                  </p>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                    {riskFlags.map((flag) => (
                                      <div
                                        key={flag.id}
                                        className={`rounded-md border p-2.5 ${
                                          flag.severity === 'warning'
                                            ? 'border-rose-300/15 bg-rose-300/[0.06]'
                                            : flag.severity === 'caution'
                                              ? 'border-amber-300/15 bg-amber-300/[0.06]'
                                              : 'border-white/10 bg-white/[0.03]'
                                        }`}
                                      >
                                        <p className="text-xs font-semibold text-zinc-200">{flag.label}</p>
                                        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{flag.detail}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </details>
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-200">{formatUsd(protocol.tvl)}</td>
                        <td className="px-4 py-3 text-zinc-300">
                          {yieldQuery.isLoading ? (
                            'Loading…'
                          ) : yieldSummary ? (
                            <>
                              <span className="block">{formatApy(protocol.apy)}</span>
                              <span
                                className={`mt-0.5 block text-[10px] ${
                                  yieldSummary.isCurrentChain ? 'text-zinc-500' : 'text-amber-300'
                                }`}
                              >
                                {yieldSummary.isCurrentChain
                                  ? yieldSummary.protocolSlug === protocol.slug
                                    ? yieldSummary.symbol
                                    : `${yieldSummary.protocolSlug
                                        .split('-')
                                        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                                        .join(' ')} · ${yieldSummary.symbol}`
                                  : `On ${yieldSummary.poolChain}`}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="block text-xs text-zinc-500">Current yield unavailable</span>
                              <span className="mt-0.5 block text-[10px] text-zinc-600">Excluded from every score</span>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-200">
                          {protocol.apy == null ? (
                            <span className="text-xs font-normal text-zinc-500">Not available</span>
                          ) : (
                            formatUsd((depositValue * protocol.apy) / 100)
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{pct(protocol.change7d)}</td>
                        <td className={`px-4 py-3 font-medium ${stabilityColor(protocol.stabilityBand)}`}>
                          {protocol.stabilityBand}
                        </td>
                        <td className={`px-4 py-3 text-right text-lg font-bold ${scoreColor(protocol.score)}`}>
                          {protocol.score}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <details className="rounded-md border border-white/10 bg-white/[0.02] px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-zinc-400">Data integrity and limitations</summary>
        <div className="mt-4 grid gap-4 text-xs leading-relaxed text-zinc-500 md:grid-cols-2">
          <div className="flex gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
            <p>
              Rankings are produced by deterministic application code—not generated by AI. Every selected protocol is
              evaluated from the same DeFiLlama fields, with no paid placement or protocol-specific override.
            </p>
          </div>
          <div>
            <p className="font-semibold text-zinc-300">Included</p>
            <p className="mt-1">
              Current TVL, 24-hour and 7-day TVL movement, plus APY from the protocol&apos;s highest-TVL matched pool.
            </p>
            <p className="mt-3 font-semibold text-zinc-300">Not included</p>
            <p className="mt-1">
              Complete audit verification, exploit history, token emissions, fees, lockups, governance, impermanent loss
              size, or wallet suitability.
            </p>
            <p className="mt-3 text-amber-200/80">
              Yield estimates assume the current APY remains unchanged for one year. They are illustrations, not
              forecasts, and exclude principal price changes.
            </p>
          </div>
        </div>
      </details>
    </div>
  )
}

export function OpportunityFinder() {
  return <OpportunityFinderContent />
}
