'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { AlertEventItem, AlertRuleItem, AlertStorageMode, ResearchHistoryItem } from './alert-types'
import { AlertTelemetryScanner } from './alert-telemetry-scanner'
import { ALERT_METRIC_LABEL, formatAlertValue, normalizeAlertEvents } from './alert-utils'
import { toast } from 'sonner'

type AlertRecentActivityProps = {
  rules: AlertRuleItem[]
  events: AlertEventItem[]
  history: ResearchHistoryItem[]
  storageMode: AlertStorageMode
  loading: boolean
  dbStatus: string | null
  historyLoading: boolean
  regeneratingEventId: string | null
  pollingEventId: string | null
  onRegeneratingEventIdChange: (eventId: string | null) => void
  onPollingEventIdChange: (eventId: string | null) => void
  onEventsChange: (updater: (events: AlertEventItem[]) => AlertEventItem[]) => void
  onViewFullSummary: (eventId: string) => void
}

export function AlertRecentActivity({
  rules,
  events,
  history,
  storageMode,
  loading,
  dbStatus,
  historyLoading,
  regeneratingEventId,
  pollingEventId,
  onRegeneratingEventIdChange,
  onPollingEventIdChange,
  onEventsChange,
  onViewFullSummary,
}: AlertRecentActivityProps) {
  return (
    <div className="console-panel corner-decor border border-cyan-500/10 bg-zinc-950/40 p-5 rounded-xs space-y-6 shadow-2xl">
      <AlertTelemetryScanner
        rules={rules}
        events={events}
        historyCount={history.length}
        storageMode={storageMode}
        loading={loading}
        dbStatus={dbStatus}
      />

      <div className="rounded-xs border border-cyan-500/10 bg-zinc-950/60 p-4 space-y-4 shadow-md">
        <p className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400 border-b border-zinc-900 pb-2">
          Recent Brief History
        </p>
        {historyLoading ? (
          <p className="text-xs text-zinc-400 font-mono leading-normal">&gt; Loading history...</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-zinc-400 font-mono leading-normal">
            &gt; No saved research runs yet. Generate reports to build your timeline.
          </p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-xs border border-zinc-900 bg-zinc-950/80 p-3.5">
                <div className="flex items-center justify-between gap-2 border-b border-zinc-900 pb-1.5 mb-2">
                  <Link
                    href={`/research?q=${item.protocolSlug}`}
                    className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 hover:underline"
                  >
                    {item.protocolSlug}
                  </Link>
                  <span className="text-[10px] font-mono text-zinc-550 font-semibold">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-300 font-mono">
                  {item.briefMarkdown}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xs border border-cyan-500/10 bg-zinc-950/60 p-4 space-y-4 shadow-md">
        <p className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400 border-b border-zinc-900 pb-2">
          Recent System Triggers
        </p>
        {events.length === 0 ? (
          <p className="text-xs text-zinc-400 font-mono leading-normal">&gt; No alert events yet.</p>
        ) : (
          <div className="space-y-3">
            {normalizeAlertEvents(events)
              .slice(0, 3)
              .map((event) => (
                <div
                  key={event.id}
                  className="rounded-xs border border-rose-500/15 bg-rose-500/5 px-3.5 py-3 text-xs text-rose-250"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-rose-500/10 pb-1.5 mb-2">
                    <div className="font-bold font-orbitron tracking-wide text-rose-300">
                      {event.protocolSlug} hit {ALERT_METRIC_LABEL[event.metric]} at{' '}
                      {formatAlertValue(event.metric, event.currentValue)}
                    </div>
                    <div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs font-mono font-bold text-rose-300 hover:text-rose-100 hover:underline p-0 h-auto cursor-pointer"
                        disabled={regeneratingEventId === event.id}
                        onClick={async () => {
                          try {
                            onRegeneratingEventIdChange(event.id)
                            const res = await fetch(`/api/alerts/events/${event.id}/regenerate`, {
                              method: 'POST',
                            })
                            const body = await res.json()
                            if (res.status === 202) {
                              toast.success('Optional explanation queued - will update shortly')
                              onPollingEventIdChange(event.id)
                            } else if (!res.ok) {
                              toast.error(body?.error ?? 'Failed to generate optional explanation')
                              return
                            } else {
                              const updated = body.event as AlertEventItem
                              onEventsChange((current) =>
                                current.map((existing) =>
                                  existing.id === updated.id
                                    ? {
                                        ...existing,
                                        summary: updated.summary,
                                        summaryGeneratedAt: updated.summaryGeneratedAt,
                                      }
                                    : existing,
                                ),
                              )
                              toast.success('Optional explanation generated')
                            }
                          } catch (err) {
                            console.error('[regen] error', err)
                            toast.error('Failed to generate optional explanation')
                          } finally {
                            onRegeneratingEventIdChange(null)
                          }
                        }}
                      >
                        {regeneratingEventId === event.id ? 'Generating...' : '[Generate optional explanation]'}
                      </Button>
                    </div>
                  </div>
                  {event.summary ? (
                    <>
                      <p className="mt-1 line-clamp-2 text-xs text-rose-100/80 leading-relaxed font-mono">
                        {event.summary}
                      </p>
                      <p className="mt-2 text-[10px] font-mono text-rose-350">
                        Generated:{' '}
                        {event.summaryGeneratedAt ? new Date(event.summaryGeneratedAt).toLocaleString() : 'unknown'}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-[10px] font-mono text-rose-350">
                      No optional explanation generated. Alert was triggered by rule-based market data.
                    </p>
                  )}
                  <div className="mt-3 flex gap-3 border-t border-rose-500/10 pt-2">
                    <Button
                      variant="link"
                      size="sm"
                      className="text-xs font-mono font-bold text-rose-300 hover:text-rose-100 hover:underline p-0 h-auto cursor-pointer"
                      onClick={() => {
                        if (event.summary) {
                          onViewFullSummary(event.id)
                        } else {
                          toast('No optional explanation to view yet')
                        }
                      }}
                    >
                      [View optional explanation]
                    </Button>
                    {pollingEventId === event.id && (
                      <span className="text-xs font-mono text-zinc-450">Polling for update...</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
