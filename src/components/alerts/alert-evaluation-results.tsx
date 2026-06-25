import type { AlertEvaluationResultItem } from './alert-types'
import { ALERT_METRIC_LABEL, formatAlertValue } from './alert-utils'

type AlertEvaluationResultsProps = {
  results: AlertEvaluationResultItem[]
}

export function AlertEvaluationResults({ results }: AlertEvaluationResultsProps) {
  return (
    <div className="rounded-xs border border-cyan-500/10 bg-zinc-950/60 p-4 space-y-4 shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-900 pb-2">
        <p className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400">Last Evaluation Run</p>
        {results.length > 0 && (
          <span className="text-xs font-mono font-bold text-zinc-450">{results.length} rules</span>
        )}
      </div>
      {results.length === 0 ? (
        <p className="text-xs text-zinc-400 font-mono leading-normal">
          &gt; Run saved alerts to see which rules passed or failed.
        </p>
      ) : (
        <div className="space-y-3">
          {results.map((result) => {
            const condition = `${ALERT_METRIC_LABEL[result.metric]} ${
              result.direction === 'BELOW' ? '<=' : '>='
            } ${formatAlertValue(result.metric, result.threshold)}`
            const statusLabel = result.status === 'triggered' ? 'PASSED' : 'SKIPPED'
            const tone =
              result.status === 'triggered'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/5 border border-rose-500/15 text-rose-300'

            return (
              <div key={result.ruleId} className={`rounded-xs px-3.5 py-3 text-xs ${tone}`}>
                <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-1.5 mb-2">
                  <div className="font-bold font-orbitron tracking-wide">
                    {result.protocolSlug} {statusLabel}
                  </div>
                  <span className="text-xs font-mono font-bold uppercase opacity-85">
                    {result.status === 'triggered' ? 'Triggered' : 'Skipped'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-300 font-mono leading-relaxed">
                  Condition: {condition} <br />
                  {result.currentValue == null
                    ? result.reason
                    : `${result.reason} Current value: ${formatAlertValue(result.metric, result.currentValue)}.`}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
