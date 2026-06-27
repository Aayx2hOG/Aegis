'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useWallet } from '@solana/wallet-adapter-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BellRing,
  Clock3,
  Database,
  FileText,
  RefreshCw,
  ShieldCheck,
  Star,
  Swords,
} from 'lucide-react'

import { useMultiChain } from '@/components/chain/chain-provider'
import { useGuestAlertWalletAddress } from '@/components/alerts/use-guest-alert-wallet-address'
import { ALERT_METRIC_LABEL, formatAlertValue, readLocalAlertStore } from '@/components/alerts/alert-utils'
import type {
  AlertEventItem,
  AlertRuleItem,
  CoinGeckoResponse,
  DefiLlamaProtocolDetail,
} from '@/components/alerts/alert-types'
import { getLatestTokenPriceFromProtocolDetail } from '@/components/alerts/alert-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { useChainProtocols } from '@/lib/hooks/use-defillama'
import { useWatchlist } from '@/lib/hooks/use-watchlist'
import { fetchJson } from '@/lib/api/fetch-json'
import { normalizeProtocolSlug, resolveProtocolFromList } from '@/lib/protocol/slug-resolver'

type ResearchRunItem = {
  id: string
  protocolSlug: string
  briefMarkdown: string
  createdAt: string
}

function formatCompactUsd(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function getTone(value?: number | null) {
  if (typeof value !== 'number') return 'text-zinc-400'
  if (value > 0) return 'text-emerald-300'
  if (value < 0) return 'text-rose-300'
  return 'text-zinc-300'
}

function MarkdownBrief({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none font-sans text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-4 mt-7 text-xl font-semibold text-white">{children}</h1>,
          h2: ({ children }) => (
            <h2 className="mb-3 mt-6 border-l border-cyan-300/35 pl-2 text-base font-semibold text-cyan-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => <h3 className="mb-2 mt-5 text-sm font-semibold text-white">{children}</h3>,
          p: ({ children }) => <p className="mb-4 text-sm leading-relaxed text-zinc-300">{children}</p>,
          ul: ({ children }) => <ul className="mb-5 space-y-2">{children}</ul>,
          li: ({ children }) => (
            <li className="ml-1 flex items-start gap-2 text-sm leading-relaxed text-zinc-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/70" />
              <div>{children}</div>
            </li>
          ),
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          table: ({ children }) => (
            <div className="my-5 overflow-x-auto rounded-lg border border-white/10 bg-zinc-950/70">
              <table className="w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-white/10 px-4 py-3 text-cyan-100">{children}</th>,
          td: ({ children }) => <td className="border-b border-white/5 px-4 py-3 text-zinc-300">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function ProtocolDossier({ slug }: { slug: string }) {
  const normalizedSlug = normalizeProtocolSlug(slug)
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58()
  const guestAlertWalletAddress = useGuestAlertWalletAddress()
  const alertWalletAddress = walletAddress ?? guestAlertWalletAddress
  const { activeChain } = useMultiChain()
  const { data: chainProtocols = [], isLoading: protocolsLoading } = useChainProtocols(activeChain.type)
  const watchlist = useWatchlist()
  const [localAlertRules, setLocalAlertRules] = useState<AlertRuleItem[]>([])
  const [localAlertEvents, setLocalAlertEvents] = useState<AlertEventItem[]>([])

  const protocol = useMemo(
    () => resolveProtocolFromList(normalizedSlug, chainProtocols),
    [chainProtocols, normalizedSlug],
  )
  const protocolSlug = normalizeProtocolSlug(protocol?.slug ?? normalizedSlug)
  const geckoId =
    ((protocol as { gecko_id?: string | null; geckoId?: string | null } | undefined)?.gecko_id ??
      (protocol as { gecko_id?: string | null; geckoId?: string | null } | undefined)?.geckoId ??
      protocolSlug) ||
    null

  const detailQuery = useQuery({
    queryKey: ['defillama-protocol-detail', protocolSlug],
    queryFn: () =>
      fetchJson<DefiLlamaProtocolDetail>(`/api/defillama/protocol?slug=${encodeURIComponent(protocolSlug)}`),
    enabled: Boolean(protocolSlug),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const priceQuery = useQuery({
    queryKey: ['coingecko-price', geckoId],
    queryFn: async () => {
      const res = await fetchJson<CoinGeckoResponse>(`/api/coingecko?id=${encodeURIComponent(geckoId ?? protocolSlug)}`)
      return {
        priceUsd: res.market_data?.current_price?.usd ?? null,
        priceChange24h: res.market_data?.price_change_percentage_24h ?? null,
      }
    },
    enabled: Boolean(geckoId),
    staleTime: 60_000,
    retry: false,
  })

  const historyQuery = useQuery({
    queryKey: ['research-history', walletAddress ?? 'guest', protocolSlug],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '25' })
      if (walletAddress) params.set('walletAddress', walletAddress)
      const body = await fetchJson<{ runs: ResearchRunItem[] }>(`/api/research/history?${params.toString()}`)
      return body.runs ?? []
    },
    staleTime: 60_000,
    retry: false,
  })

  const dbAlertsQuery = useQuery({
    queryKey: ['protocol-alerts', alertWalletAddress, protocolSlug],
    queryFn: async () => {
      if (!alertWalletAddress) return { rules: [], recentEvents: [] }
      return fetchJson<{ rules: AlertRuleItem[]; recentEvents: AlertEventItem[] }>(
        `/api/alerts/rules?walletAddress=${encodeURIComponent(alertWalletAddress)}`,
      )
    },
    enabled: Boolean(alertWalletAddress),
    staleTime: 60_000,
    retry: false,
  })

  useEffect(() => {
    if (!alertWalletAddress) return
    const currentAlertWalletAddress = alertWalletAddress

    function loadLocalAlerts() {
      const store = readLocalAlertStore(currentAlertWalletAddress)
      setLocalAlertRules(store.rules)
      setLocalAlertEvents(store.events)
    }

    loadLocalAlerts()
    window.addEventListener('storage', loadLocalAlerts)
    return () => window.removeEventListener('storage', loadLocalAlerts)
  }, [alertWalletAddress])

  const latestTokenPrice = getLatestTokenPriceFromProtocolDetail(detailQuery.data)
  const priceUsd = priceQuery.data?.priceUsd ?? latestTokenPrice
  const priceChange24h = priceQuery.data?.priceChange24h ?? null
  const researchRuns = useMemo(
    () => historyQuery.data?.filter((run) => normalizeProtocolSlug(run.protocolSlug) === protocolSlug) ?? [],
    [historyQuery.data, protocolSlug],
  )
  const latestResearch = researchRuns[0]

  const combinedRules = useMemo(() => {
    const rules = [...(dbAlertsQuery.data?.rules ?? []), ...localAlertRules]
    const seen = new Set<string>()
    return rules.filter((rule) => {
      const key = `${rule.protocolSlug}:${rule.metric}:${rule.direction}:${rule.threshold}`
      if (normalizeProtocolSlug(rule.protocolSlug) !== protocolSlug || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [dbAlertsQuery.data?.rules, localAlertRules, protocolSlug])

  const combinedEvents = useMemo(() => {
    return [...(dbAlertsQuery.data?.recentEvents ?? []), ...localAlertEvents]
      .filter((event) => normalizeProtocolSlug(event.protocolSlug) === protocolSlug)
      .sort((left, right) => new Date(right.triggeredAt).getTime() - new Date(left.triggeredAt).getTime())
      .slice(0, 4)
  }, [dbAlertsQuery.data?.recentEvents, localAlertEvents, protocolSlug])

  const isWatched = watchlist.isWatched(protocolSlug)
  const displayName = protocol?.name ?? protocolSlug
  const category = protocol?.category ?? 'Protocol'
  const tvl = protocol?.tvl ?? null

  return (
    <div className="aegis-shell cyber-grid min-h-screen">
      <SpotlightCard
        spotlightColor="rgba(6, 182, 212, 0.05)"
        borderColor="rgba(103, 232, 249, 0.2)"
        className="aegis-panel p-6 md:p-8"
      >
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-5 text-left">
            <Badge variant="outline" className="aegis-kicker">
              <Database className="h-3.5 w-3.5" />
              Protocol dossier
            </Badge>
            <div>
              <h1 className="aegis-heading max-w-4xl capitalize">{displayName}</h1>
              <p className="aegis-muted mt-3 max-w-2xl">
                One place to review market telemetry, saved research, watchlist status, alert coverage, and simulation
                actions for <span className="font-semibold text-zinc-200">{protocolSlug}</span>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-300">
                {activeChain.displayName}
              </Badge>
              <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                {category}
              </Badge>
              <Badge
                variant="outline"
                className={
                  isWatched
                    ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                    : 'border-zinc-700 bg-zinc-900/70 text-zinc-300'
                }
              >
                {isWatched ? 'Watched' : 'Not watched'}
              </Badge>
            </div>
          </div>

          <div className="grid gap-2 text-left">
            <Button asChild className="aegis-button-primary h-10 justify-between">
              <Link href={`/research?q=${encodeURIComponent(protocolSlug)}`}>
                Research
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="aegis-button-secondary h-10 justify-between">
              <Link href={`/alerts?protocol=${encodeURIComponent(protocolSlug)}`}>
                Create alert
                <BellRing className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="aegis-button-secondary h-10 justify-between">
              <Link href={`/research/compare?protocols=${encodeURIComponent(protocolSlug)}`}>
                Compare opportunity
                <Swords className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              type="button"
              onClick={() => watchlist.toggle(protocolSlug)}
              className="h-10 justify-between rounded-md border border-white/10 bg-white/[0.04] font-semibold text-zinc-200 hover:bg-white/[0.08]"
            >
              {isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
              <Star className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SpotlightCard>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'TVL', value: formatCompactUsd(tvl), icon: BarChart3, tone: 'text-cyan-100' },
          { label: 'Token price', value: formatCompactUsd(priceUsd), icon: Database, tone: 'text-zinc-100' },
          {
            label: '24h move',
            value: formatPercent(priceChange24h ?? protocol?.change_1d),
            icon: RefreshCw,
            tone: getTone(priceChange24h ?? protocol?.change_1d),
          },
          {
            label: '7d move',
            value: formatPercent(protocol?.change_7d),
            icon: Clock3,
            tone: getTone(protocol?.change_7d),
          },
        ].map((item) => (
          <div key={item.label} className="finance-surface p-4 text-left">
            <div className="flex items-center justify-between">
              <p className="finance-label">{item.label}</p>
              <item.icon className="h-4 w-4 text-zinc-500" />
            </div>
            <p className={`mt-3 text-2xl font-semibold ${item.tone}`}>{protocolsLoading ? '...' : item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="aegis-panel p-5 text-left">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <p className="finance-label text-cyan-300">Research brief</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Latest research notes</h2>
            </div>
            <Button asChild size="sm" className="aegis-button-secondary h-9 px-3 text-xs">
              <Link href={`/research?q=${encodeURIComponent(protocolSlug)}`}>Generate brief</Link>
            </Button>
          </div>

          {latestResearch ? (
            <div className="pt-2">
              <p className="mt-3 text-xs text-zinc-500">
                Generated {new Date(latestResearch.createdAt).toLocaleString()}
              </p>
              <MarkdownBrief content={latestResearch.briefMarkdown} />
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-zinc-950/35 p-8 text-center">
              <FileText className="h-8 w-8 text-zinc-600" />
              <p className="mt-4 text-sm font-semibold text-zinc-200">No saved research brief yet</p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                Generate a protocol brief from Research and it will appear here as the operational context for this
                protocol.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="aegis-panel p-5 text-left">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="finance-label text-amber-300">Alert coverage</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{combinedRules.length} active rules</h2>
              </div>
              <ShieldCheck className="h-5 w-5 text-zinc-500" />
            </div>
            <div className="mt-4 space-y-3">
              {combinedRules.length > 0 ? (
                combinedRules.slice(0, 4).map((rule) => (
                  <div key={rule.id} className="rounded-md border border-white/10 bg-zinc-950/55 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{ALERT_METRIC_LABEL[rule.metric]}</p>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-[10px] text-zinc-300">
                        {rule.direction.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{formatAlertValue(rule.metric, rule.threshold)}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-white/10 bg-zinc-950/35 p-4">
                  <AlertTriangle className="h-5 w-5 text-amber-300" />
                  <p className="mt-3 text-sm font-semibold text-zinc-200">No alert coverage</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Add a TVL, price, or movement rule so this protocol is monitored.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="aegis-panel p-5 text-left">
            <p className="finance-label text-rose-300">Recent trigger history</p>
            <div className="mt-4 space-y-3">
              {combinedEvents.length > 0 ? (
                combinedEvents.map((event) => (
                  <div key={event.id} className="rounded-md border border-white/10 bg-zinc-950/55 p-3">
                    <p className="text-sm font-semibold text-white">{ALERT_METRIC_LABEL[event.metric]}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatAlertValue(event.metric, event.currentValue)} on{' '}
                      {new Date(event.triggeredAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-white/10 bg-zinc-950/35 p-4 text-sm text-zinc-500">
                  No alert events for this protocol yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
