'use client'

import { Button } from '@/components/ui/button'
import type { AlertEventItem } from './alert-types'
import { ALERT_METRIC_LABEL, formatAlertValue } from './alert-utils'
import { toast } from 'sonner'

type AlertSummaryDialogProps = {
  event: AlertEventItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AlertSummaryDialog({ event, open, onOpenChange }: AlertSummaryDialogProps) {
  if (!open || !event) return null

  const condition = `${ALERT_METRIC_LABEL[event.metric]} ${
    event.direction === 'BELOW' ? '<=' : '>='
  } ${formatAlertValue(event.metric, event.threshold)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="max-h-[84vh] w-[min(900px,95%)] overflow-auto rounded-xs border border-cyan-500/20 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-900 pb-3">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
              &gt; telemetry metadata
            </p>
            <h3 className="mt-2 text-xl font-orbitron font-black text-white">{event.protocolSlug}</h3>
            <p className="mt-1 text-xs text-zinc-400 font-mono">
              Rule-based alert details, with an optional generated explanation.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-xs font-mono text-xs px-3 py-1.5 cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 font-mono">
          <div className="rounded-xs border border-zinc-900 bg-zinc-950/80 p-4 shadow-md">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Metric</p>
            <p className="mt-2 text-sm font-semibold text-zinc-200">{ALERT_METRIC_LABEL[event.metric]}</p>
          </div>
          <div className="rounded-xs border border-zinc-900 bg-zinc-950/80 p-4 shadow-md">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Condition</p>
            <p className="mt-2 text-sm font-semibold text-zinc-200">{condition}</p>
          </div>
          <div className="rounded-xs border border-zinc-900 bg-zinc-950/80 p-4 shadow-md">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Current value</p>
            <p className="mt-2 text-sm font-semibold text-zinc-200">
              {formatAlertValue(event.metric, event.currentValue)}
            </p>
          </div>
          <div className="rounded-xs border border-zinc-900 bg-zinc-950/80 p-4 shadow-md">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Triggered at</p>
            <p className="mt-2 text-sm font-semibold text-zinc-200">{new Date(event.triggeredAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xs border border-zinc-900 bg-zinc-950/80 p-4 shadow-md">
          <p className="text-[10px] font-orbitron font-bold uppercase tracking-wider text-cyan-400 border-b border-zinc-900 pb-2">
            Optional Summary
          </p>
          <div className="mt-3 whitespace-pre-wrap text-xs leading-6 text-zinc-200 font-mono">
            {event.summary ?? 'No summary available.'}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 font-mono pt-3 border-t border-zinc-900">
            <span>
              Generated: {event.summaryGeneratedAt ? new Date(event.summaryGeneratedAt).toLocaleString() : 'unknown'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border border-zinc-800 bg-zinc-900/50 text-zinc-350 hover:text-white hover:bg-zinc-900 rounded-xs text-xs px-3 py-1.5 cursor-pointer"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    [
                      `Protocol: ${event.protocolSlug}`,
                      `Metric: ${ALERT_METRIC_LABEL[event.metric]}`,
                      `Condition: ${condition}`,
                      `Current value: ${formatAlertValue(event.metric, event.currentValue)}`,
                      `Triggered at: ${new Date(event.triggeredAt).toLocaleString()}`,
                      `Generated: ${
                        event.summaryGeneratedAt ? new Date(event.summaryGeneratedAt).toLocaleString() : 'unknown'
                      }`,
                      '',
                      event.summary ?? 'No summary available.',
                    ].join('\n'),
                  )
                  toast.success('Copied full summary to clipboard.')
                } catch {
                  toast.error('Could not copy the summary.')
                }
              }}
            >
              Copy full summary
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
