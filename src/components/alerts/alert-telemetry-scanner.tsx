'use client'

import { Meteors } from '@/components/ui/meteors'
import { Sparkles } from '@/components/ui/sparkles'

type AlertRuleItem = {
  enabled: boolean
}

type AlertEventItem = {
  protocolSlug: string
  triggeredAt: string
}

export function AlertTelemetryScanner({
  rules,
  events,
  historyCount,
  storageMode,
  loading,
  dbStatus,
}: {
  rules: AlertRuleItem[]
  events: AlertEventItem[]
  historyCount: number
  storageMode: 'database' | 'local' | 'loading'
  loading: boolean
  dbStatus: string | null
}) {
  const enabledRules = rules.filter((rule) => rule.enabled).length
  const latestEvent = events[0]
  const latestEventLabel = latestEvent
    ? `${latestEvent.protocolSlug} ${new Date(latestEvent.triggeredAt).toLocaleDateString()}`
    : 'none'
  const storageLabel = storageMode === 'database' ? 'Database' : storageMode === 'local' ? 'Local browser' : 'Resolving'
  const storageDetail =
    storageMode === 'database'
      ? 'Rules and events are persisted in the configured database.'
      : storageMode === 'local'
        ? 'Rules and events are stored in this browser for the current alert identity.'
        : 'Aegis is checking whether database storage is available.'
  const statusRows = [
    ['Saved rules', String(rules.length)],
    ['Enabled rules', String(enabledRules)],
    ['Recent events', String(events.length)],
    ['Research runs', String(historyCount)],
    ['Storage', storageLabel],
    ['Latest event', latestEventLabel],
  ]

  return (
    <div className="relative overflow-hidden rounded-xs border border-cyan-500/10 bg-zinc-950/60 p-4 space-y-4 shadow-md flex flex-col sm:flex-row items-center gap-4">
      <Meteors number={3} />
      <div className="relative w-28 h-28 border border-cyan-500/20 rounded-full flex items-center justify-center bg-zinc-950 shadow-[0_0_12px_rgba(6,182,212,0.1)] overflow-hidden shrink-0">
        <Sparkles
          id="sonar-sparkles"
          particleDensity={8}
          minSize={0.4}
          maxSize={1.0}
          particleColor="#06b6d4"
          className="opacity-25"
        />
        <div className="absolute w-24 h-24 border border-cyan-500/10 rounded-full" />
        <div className="absolute w-16 h-16 border border-cyan-500/15 rounded-full" />
        <div className="absolute w-8 h-8 border border-cyan-500/20 rounded-full" />
        <div className="absolute w-full h-[1px] bg-cyan-500/10" />
        <div className="absolute h-full w-[1px] bg-cyan-500/10" />

        <span className="absolute top-6 left-6 w-1.5 h-1.5 rounded-full bg-cyan-400 motion-safe:animate-ping duration-1000" />
        <span className="absolute top-6 left-6 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />

        <span className="absolute bottom-8 right-6 w-1.5 h-1.5 rounded-full bg-rose-500 motion-safe:animate-ping duration-800" />
        <span className="absolute bottom-8 right-6 w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#ef4444]" />

        <div
          className="absolute inset-0 origin-center bg-[conic-gradient(from_0deg,rgba(6,182,212,0.12)_0deg,transparent_90deg)] rounded-full motion-safe:animate-spin"
          style={{ animationDuration: '5s' }}
        />
        <span className="absolute bottom-1 left-0 right-0 text-center text-[6px] font-mono text-cyan-500/40 uppercase tracking-widest">
          SENTINEL SCAN
        </span>
      </div>

      <div className="flex-1 w-full min-h-[92px] rounded-xs bg-zinc-950/80 border border-zinc-900/60 p-3 shadow-[inset_0_0_10px_rgba(0,0,0,0.85)] font-mono text-[10px] text-cyan-400 flex flex-col justify-between z-10">
        <div className="flex items-center justify-between border-b border-cyan-500/10 pb-1.5 mb-1.5 select-none">
          <span className="font-bold flex items-center gap-1 uppercase tracking-wider">
            <span className={`h-1.5 w-1.5 rounded-full ${dbStatus ? 'bg-amber-400' : 'bg-cyan-400'}`} />
            ALERT OPERATIONS
          </span>
          <span className="text-zinc-550 uppercase text-[7px] tracking-widest font-bold">
            {loading ? 'STATE: LOADING' : dbStatus ? 'STATE: DEGRADED' : 'STATE: READY'}
          </span>
        </div>
        <div
          className={`mb-2 rounded border px-2 py-1.5 text-left ${
            storageMode === 'database'
              ? 'border-emerald-300/15 bg-emerald-300/10 text-emerald-100'
              : storageMode === 'local'
                ? 'border-amber-300/15 bg-amber-300/10 text-amber-100'
                : 'border-cyan-300/15 bg-cyan-300/10 text-cyan-100'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider">Storage: {storageLabel}</span>
            <span className="text-[8px] uppercase tracking-widest opacity-75">
              {storageMode === 'database' ? 'Persistent' : storageMode === 'local' ? 'Browser fallback' : 'Loading'}
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed opacity-80">{storageDetail}</p>
        </div>
        <div className="grid gap-1 text-left sm:grid-cols-2">
          {statusRows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-2 rounded border border-cyan-500/5 bg-white/[0.02] px-2 py-1 tracking-wide"
            >
              <span className="text-zinc-500">{label}</span>
              <span className="truncate text-white">{value}</span>
            </div>
          ))}
        </div>
        {dbStatus && <p className="mt-2 truncate text-[10px] text-amber-300">{dbStatus}</p>}
      </div>
    </div>
  )
}
