'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useAtom } from 'jotai'
import { agentStateAtom } from '@/lib/store/research-store'
import type { ResearchBrief } from '@/lib/types'

import { useWatchlist } from '@/lib/hooks/use-watchlist'
import { useChainProtocols } from '@/lib/hooks/use-defillama'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { AlertCircle, BarChart3, Loader2, RefreshCw, Search, Star, Swords, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { useWallet } from '@solana/wallet-adapter-react'
import { useMultiChain } from '@/components/chain/chain-provider'
import { normalizeProtocolSlug } from '@/lib/protocol/slug-resolver'
import type { SolanaProtocol } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PrimaryWorkflow } from '@/components/workflow/primary-workflow'

import { TracingBeam } from '@/components/ui/tracing-beam'

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
])

const EXCLUDED_PROTOCOL_CATEGORIES = new Set([
  'CEX',
  'CeFi',
  'Centralized Exchange',
  'Indexes',
  'Portfolio Tracker',
  'Risk Curators',
  'Wallet',
])

const INITIAL_VISIBLE_PROTOCOLS = 60

function formatProtocolName(name: string): string {
  if (!name) return ''
  return name
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildSupportedProtocolCatalog(protocols: SolanaProtocol[]) {
  const deduped = new Map<string, SolanaProtocol>()

  protocols.forEach((protocol) => {
    const slug = normalizeProtocolSlug(protocol.slug)
    if (!slug || deduped.has(slug)) return
    deduped.set(slug, protocol)
  })

  return Array.from(deduped.values())
    .map((protocol) => {
      const raw = protocol as { tvl?: number; tvlUsd?: number; category?: string }
      const tvlNum: number | null =
        typeof raw.tvl === 'number' ? raw.tvl : typeof raw.tvlUsd === 'number' ? raw.tvlUsd : null
      return { protocol, tvlNum }
    })
    .filter(({ tvlNum }) => tvlNum != null && tvlNum > 0)
    .filter(({ protocol }) => {
      const category = (protocol as { category?: string }).category?.trim() ?? 'Uncategorized'
      if (EXCLUDED_PROTOCOL_CATEGORIES.has(category)) return false
      if (RELEVANT_PROTOCOL_CATEGORIES.size === 0) return true
      return RELEVANT_PROTOCOL_CATEGORIES.has(category) || category === 'Uncategorized'
    })
    .sort((a, b) => (b.tvlNum ?? 0) - (a.tvlNum ?? 0))
    .map(({ protocol, tvlNum }) => ({
      slug: normalizeProtocolSlug(protocol.slug),
      label: protocol.name || formatProtocolName(protocol.slug),
      category: (protocol as { category?: string }).category ?? 'Uncategorized',
      tvl:
        typeof tvlNum === 'number'
          ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(tvlNum)
          : 'N/A',
    }))
}

function matchesProtocolSearch(protocol: { slug: string; label: string; category: string }, query: string) {
  if (!query) return true
  const normalizedQuery = query.toLowerCase()
  return (
    protocol.slug.toLowerCase().includes(normalizedQuery) ||
    protocol.label.toLowerCase().includes(normalizedQuery) ||
    protocol.category.toLowerCase().includes(normalizedQuery)
  )
}

// Category Badge Color helper
function getCategoryTone(category: string) {
  const cat = category.toLowerCase()
  if (cat.includes('lending') || cat.includes('cdp')) return 'border-cyan-500/35 bg-cyan-500/5 text-cyan-400'
  if (cat.includes('amm') || cat.includes('dex')) return 'border-emerald-500/35 bg-emerald-500/5 text-emerald-400'
  if (cat.includes('yield') || cat.includes('staking')) return 'border-amber-500/35 bg-amber-500/5 text-amber-400'
  return 'border-rose-500/35 bg-rose-500/5 text-rose-400'
}

async function readApiError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null
  return typeof body?.error === 'string' ? body.error : fallback
}

export default function ResearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      }
    >
      <ResearchContent />
    </Suspense>
  )
}

function ResearchContent() {
  const wallet = useWallet()
  const searchParams = useSearchParams()
  const { activeChain } = useMultiChain()
  const [brief, setBrief] = useState<ResearchBrief | null>(null)
  const [, setAgentState] = useAtom(agentStateAtom)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [protocolSearch, setProtocolSearch] = useState('')
  const [visibleProtocols, setVisibleProtocols] = useState(INITIAL_VISIBLE_PROTOCOLS)
  const { isWatched, toggle, isConnected } = useWatchlist()
  const { data: chainProtocols = [], isLoading: protocolsLoading } = useChainProtocols(activeChain.type)

  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([])

  const supportedProtocols = useMemo(() => buildSupportedProtocolCatalog(chainProtocols), [chainProtocols])
  const deferredProtocolSearch = useDeferredValue(protocolSearch.trim())
  const filteredProtocols = useMemo(
    () => supportedProtocols.filter((protocol) => matchesProtocolSearch(protocol, deferredProtocolSearch)),
    [deferredProtocolSearch, supportedProtocols],
  )
  const visibleFilteredProtocols = useMemo(
    () => filteredProtocols.slice(0, visibleProtocols),
    [filteredProtocols, visibleProtocols],
  )

  useEffect(() => {
    setVisibleProtocols(INITIAL_VISIBLE_PROTOCOLS)
  }, [activeChain.type, deferredProtocolSearch])

  // Auto-run if query param exists
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      void runResearch(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Loading console log simulation
  useEffect(() => {
    if (!loading) {
      setSimulatedLogs([])
      return
    }
    const rawLogs = [
      `Initializing secure Aegis node proxy for ${activeChain.displayName.toUpperCase()}...`,
      `[NODE] Handshake complete. Resolving RPC feeds...`,
      `[FEED] Fetching historical TVL metrics via DeFiLlama proxy...`,
      `[INTEL] Analyzing smart contract risk footprint...`,
      `[AI-AGENT] Scanning on-chain liquidity depth and slippage parameters...`,
      `[AI-AGENT] Resolving recent security incidents and audits...`,
      `[AI-AGENT] Synthesizing dossier metrics into markdown report...`,
      `[SYSTEM] Structuring research brief. Outputting classification card...`,
    ]

    setSimulatedLogs([`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${rawLogs[0]}`])
    let nextIdx = 1
    const timer = setInterval(() => {
      if (nextIdx < rawLogs.length) {
        const currentLog = rawLogs[nextIdx]
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
        setSimulatedLogs((old) => [...old, `[${timestamp}] ${currentLog}`])
        nextIdx++
      } else {
        clearInterval(timer)
      }
    }, 2200)

    return () => clearInterval(timer)
  }, [loading, activeChain])

  async function runResearch(protocol: string) {
    const normalizedProtocol = normalizeProtocolSlug(protocol)
    if (!normalizedProtocol) return
    setLoading(true)
    setError(null)
    setBrief(null)
    setAgentState({ status: 'thinking', currentTool: null, toolCalls: [], error: null })

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol: normalizedProtocol,
          chainType: activeChain.type,
          walletAddress: wallet.publicKey?.toBase58(),
        }),
      })
      if (!res.ok) throw new Error(await readApiError(res, 'Research request failed.'))
      const data: ResearchBrief = await res.json()
      setBrief(data)
      setAgentState({
        status: 'done',
        currentTool: null,
        toolCalls: data.toolCalls.map((tc) => ({
          tool: tc.tool,
          toolName: tc.tool,
          input: tc.input,
          output: tc.output,
          durationMs: tc.durationMs,
        })),
        error: null,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setAgentState({ status: 'error', currentTool: null, toolCalls: [], error: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="aegis-shell max-w-5xl cyber-grid">
      <header className="space-y-4 text-left">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="accent"
              className="aegis-kicker"
            >
              <Search className="h-3.5 w-3.5" />
              Research analyst
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="aegis-button-secondary"
            >
              <Link href="/research/compare" className="flex items-center gap-1.5">
                <Swords className="h-3.5 w-3.5" /> Compare
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="aegis-button-secondary"
            >
              <Link href="/watchlist" className="flex items-center gap-1.5">
                Watchlist <Star className="h-3.5 w-3.5 fill-current text-cyan-200" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="aegis-heading">
            {activeChain.displayName} protocol research
          </h1>
          <p className="aegis-muted max-w-2xl">
            Search the active chain catalog, generate a research brief, and send relevant protocols directly into
            watchlists or war-room simulations.
          </p>
        </div>
      </header>

      <PrimaryWorkflow compact />

      {/* Results (Dossier Mode) */}
      {brief && !loading && (
        <div className="animate-in space-y-8 fade-in duration-700">
          <TracingBeam>
            <article className="aegis-panel relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-cyan-300" />
                  <span className="text-sm font-semibold text-cyan-100">
                    Research brief: {brief.protocol}
                  </span>
                </div>
                <div className="flex gap-2">
                  {brief?.protocol && (
                    <Button
                      asChild
                      size="sm"
                      className="aegis-button-primary"
                    >
                      <Link href={`/war-room?protocol=${brief.protocol.toLowerCase()}`}>Run War Room Simulation</Link>
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      const slug = brief.protocol.toLowerCase()
                      toggle(slug)
                      if (!isWatched(slug)) {
                        toast.success(`${slug} added to watchlist.`)
                      }
                    }}
                    variant={isWatched(brief.protocol.toLowerCase()) ? 'outline' : 'default'}
                    size="sm"
                    className={
                      isWatched(brief.protocol.toLowerCase())
                        ? 'rounded-md border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
                        : 'rounded-md bg-white font-semibold text-zinc-950 transition-all hover:bg-zinc-200'
                    }
                  >
                    {isWatched(brief.protocol.toLowerCase()) ? 'Active monitor' : 'Watch protocol'}
                  </Button>
                </div>
              </div>

              {!isConnected && (
                <div className="px-6 pt-4 md:px-10">
                  <div className="rounded-md border border-cyan-300/15 bg-cyan-300/10 px-3.5 py-2 text-xs font-medium text-cyan-100">
                    Guest mode: watchlist changes are saved locally in this browser.
                  </div>
                </div>
              )}
              <div className="p-6 md:p-10 text-left">
                <MarkdownBrief content={brief.brief} />
              </div>
            </article>

            {/* Footer Tip */}
            <div className="py-8 text-center">
              <p className="text-xs text-zinc-600">Brief generated with current protocol and market context.</p>
            </div>
          </TracingBeam>
        </div>
      )}

      {/* Active Thinking State (Console Terminal Logger) */}
      {loading && (
        <div className="aegis-panel animate-in slide-in-from-bottom-4 fade-in relative flex min-h-[18rem] flex-col justify-between overflow-hidden duration-500">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-2 font-mono text-xs text-cyan-100">
            <span className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5" /> Research pipeline
            </span>
            <span className="text-zinc-550 flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin" /> PROCESS: ACTIVE
            </span>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-start space-y-2 font-mono text-xs text-left overflow-y-auto">
            {simulatedLogs.map((log, index) => (
              <div key={index} className="text-cyan-400/90 tracking-wide font-light">
                {log}
              </div>
            ))}
            <div className="flex animate-pulse items-center gap-1 font-bold text-white">
              <span>Preparing brief</span>
              <span className="h-3 w-1.5 bg-white inline-block animate-caret" />
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="text-xs font-medium text-cyan-100/70">
              Fetching protocol metrics, market context, and risk signals
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-400/20 bg-rose-400/10 p-4 text-left text-sm text-rose-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1 font-semibold">{error}</p>
        </div>
      )}

      <section className="aegis-panel relative p-5 text-left md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="aegis-kicker">
              <BarChart3 className="h-3.5 w-3.5" />
              Protocol catalog
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              {supportedProtocols.length} verified network protocols
            </h2>
            <p className="aegis-muted max-w-2xl">
              Live catalog derived from the active chain. Protocols are sorted by liquidity scale and filtered to
              DeFi-relevant categories.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs text-zinc-400">
            <p className="font-medium text-zinc-500">Catalog status</p>
            <p className="mt-0.5 font-semibold text-cyan-100">
              {protocolsLoading ? 'Refreshing metrics' : 'Synchronized'}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-zinc-200">Search protocols</p>
              <p className="text-xs text-zinc-500">Filter by name, slug, or category.</p>
            </div>
            <div className="text-xs font-medium text-zinc-500">
              {protocolsLoading ? 'Awaiting metrics...' : `${supportedProtocols.length} entries matching filters`}
            </div>
          </div>
          <div>
            <Input
              type="search"
              value={protocolSearch}
              onChange={(e) => setProtocolSearch(e.target.value)}
              placeholder="Search jito, aave, kamino..."
              className="h-10 w-full rounded-md border-white/10 bg-zinc-950/70 text-sm focus:border-cyan-300/40"
            />
          </div>
        </div>

        <div className="mt-6 max-h-[28rem] overflow-auto rounded-lg border border-white/10 bg-zinc-950/25 p-4 scrollbar-thin">
          <div className="mb-3 flex items-center justify-between gap-3 px-1 text-xs text-zinc-500">
            <span>
              Showing {Math.min(visibleProtocols, filteredProtocols.length)} of {filteredProtocols.length} protocols
            </span>
            {deferredProtocolSearch && (
              <button
                type="button"
                onClick={() => setProtocolSearch('')}
                className="font-semibold text-cyan-200 hover:text-white"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleFilteredProtocols.map((protocol) => (
              <button
                key={protocol.slug}
                type="button"
                onClick={() => {
                  void runResearch(protocol.slug)
                }}
                className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 text-left transition hover:border-cyan-300/25 hover:bg-white/[0.06]"
                style={{ contentVisibility: 'auto', containIntrinsicSize: '60px' }}
                disabled={loading}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white transition-colors group-hover:text-cyan-100">
                    {protocol.label}
                  </p>
                  <span
                    className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${getCategoryTone(protocol.category)}`}
                  >
                    {protocol.category}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-medium text-zinc-500">TVL</p>
                  <p className="text-sm font-semibold text-white">{protocol.tvl}</p>
                </div>
              </button>
            ))}
            {filteredProtocols.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.025] px-4 py-8 text-center text-sm text-zinc-500 sm:col-span-2 xl:col-span-3">
                No protocols match that search.
              </div>
            )}
          </div>
          {filteredProtocols.length > visibleProtocols && (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                onClick={() =>
                  setVisibleProtocols((current) =>
                    Math.min(current + INITIAL_VISIBLE_PROTOCOLS, filteredProtocols.length),
                  )
                }
                variant="outline"
                size="sm"
                className="aegis-button-secondary text-sm"
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      </section>

      <style jsx global>{`
        @keyframes progress-fast {
          0% {
            width: 0%;
            left: 0;
          }
          40% {
            width: 70%;
            left: 0;
          }
          100% {
            width: 0%;
            left: 100%;
          }
        }
        .animate-progress-fast {
          animation: progress-fast 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          position: absolute;
        }
        @keyframes caret {
          0%,
          100% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
        }
        .animate-caret {
          animation: caret 1s step-end infinite;
        }
      `}</style>
    </div>
  )
}

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function MarkdownBrief({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none font-sans text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-8 flex items-center gap-2 border-b border-white/10 pb-2 text-xl font-semibold tracking-tight text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-6 border-l border-cyan-300/30 pl-2 text-base font-semibold text-cyan-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-5 text-sm font-semibold text-white">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 text-xs sm:text-sm leading-relaxed text-zinc-300 font-medium">{children}</p>
          ),
          ul: ({ children }) => <ul className="mb-6 space-y-2.5 font-sans">{children}</ul>,
          li: ({ children }) => (
            <li className="group ml-1 flex items-start gap-2 text-zinc-300 text-xs sm:text-sm">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full border border-cyan-300/70 bg-cyan-300/50" />
              <div className="min-w-0 leading-relaxed font-medium">{children}</div>
            </li>
          ),
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-lg border border-white/10 bg-zinc-950/70 shadow-inner">
              <table className="w-full text-xs text-left border-collapse font-mono">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-white/10 bg-white/[0.04] text-[10px] font-semibold text-zinc-400">
              {children}
            </thead>
          ),
          th: ({ children }) => <th className="px-5 py-3 font-semibold text-cyan-100">{children}</th>,
          td: ({ children }) => <td className="border-b border-white/5 px-5 py-3 text-zinc-300">{children}</td>,
          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded-md border border-cyan-300/15 bg-cyan-300/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-cyan-100">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
