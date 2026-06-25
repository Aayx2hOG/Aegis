'use client'

import { ChevronDown, Plus, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AlertDirection, AlertMetric } from './alert-types'
import { ALERT_METRIC_LABEL, formatAlertValue } from './alert-utils'

type AlertRuleFormProps = {
  alertWalletAddress?: string | null
  availableProtocolSlugs: string[]
  creatingAlert: boolean
  evaluatingAlerts: boolean
  protocolSlug: string
  metric: AlertMetric
  direction: AlertDirection
  threshold: string
  selectedCurrentValue: number | null
  onProtocolSlugChange: (value: string) => void
  onMetricChange: (value: AlertMetric) => void
  onDirectionChange: (value: AlertDirection) => void
  onThresholdChange: (value: string) => void
  onCreateAlert: () => Promise<void>
  onCreateAndTestAlert: () => Promise<void>
  onRunEvaluation: () => void
}

export function AlertRuleForm({
  alertWalletAddress,
  availableProtocolSlugs,
  creatingAlert,
  evaluatingAlerts,
  protocolSlug,
  metric,
  direction,
  threshold,
  selectedCurrentValue,
  onProtocolSlugChange,
  onMetricChange,
  onDirectionChange,
  onThresholdChange,
  onCreateAlert,
  onCreateAndTestAlert,
  onRunEvaluation,
}: AlertRuleFormProps) {
  return (
    <div className="rounded-xs border border-cyan-500/10 bg-zinc-950/60 p-4 space-y-4 shadow-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400">Create Alert Vector</p>
          <p className="mt-1 text-xs text-zinc-400">
            Set one rule on a watched protocol, then run a live evaluation to verify it fires.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            type="button"
            onClick={onRunEvaluation}
            disabled={!alertWalletAddress || evaluatingAlerts}
            title="Checks every saved alert against the latest market data"
            className="border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 font-mono rounded-xs text-xs sm:min-w-[150px] cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            {evaluatingAlerts ? 'Running check...' : 'Run saved alerts'}
          </Button>
          <Button
            type="button"
            onClick={onCreateAndTestAlert}
            disabled={!alertWalletAddress || creatingAlert || evaluatingAlerts || selectedCurrentValue == null}
            title="Creates an alert at the current live value, then checks it immediately"
            className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-black uppercase tracking-wider rounded-xs shadow-[0_0_8px_rgba(6,182,212,0.2)] transition-all sm:min-w-[180px] text-xs h-9 sm:h-auto py-2 px-3 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create & test
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 font-mono">
        <p>&gt; Run saved alerts: checks every enabled rule against the latest market data.</p>
        <p>&gt; Create & test: saves the new rule and tests only that specific rule right away.</p>
      </div>

      <form
        className="mt-4 grid gap-4 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault()
          await onCreateAlert()
        }}
      >
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400/80">
            Protocol slug
          </label>
          <div className="relative">
            <select
              value={protocolSlug}
              onChange={(event) => onProtocolSlugChange(event.target.value)}
              className="flex h-11 w-full rounded-xs border border-zinc-800 bg-zinc-950/80 px-3 pr-10 text-sm shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono appearance-none"
              disabled={!alertWalletAddress || creatingAlert}
            >
              <option value="" disabled className="bg-zinc-950 text-white">
                Select a protocol from your watchlist
              </option>
              {availableProtocolSlugs.map((slug) => (
                <option key={slug} value={slug} className="bg-zinc-950 text-white font-mono">
                  {slug}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
          <p className="mt-1 text-xs text-zinc-450 font-medium">Choose a protocol from your current watchlist.</p>
          <p className="mt-2 text-xs text-cyan-400 font-mono">
            Live {ALERT_METRIC_LABEL[metric]}:{' '}
            {selectedCurrentValue == null ? 'not available' : formatAlertValue(metric, selectedCurrentValue)}
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400/80">
            Metric
          </label>
          <select
            value={metric}
            onChange={(event) => onMetricChange(event.target.value as AlertMetric)}
            className="flex h-11 w-full rounded-xs border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-sm shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono"
            disabled={!alertWalletAddress || creatingAlert}
          >
            <option value="CHANGE_1D" className="bg-zinc-950 text-white">
              24h change
            </option>
            <option value="CHANGE_7D" className="bg-zinc-950 text-white">
              7d change
            </option>
            <option value="TVL_USD" className="bg-zinc-950 text-white">
              TVL ($)
            </option>
            <option value="PRICE_USD" className="bg-zinc-950 text-white">
              Token Price ($)
            </option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400/80">
            Direction
          </label>
          <select
            value={direction}
            onChange={(event) => onDirectionChange(event.target.value as AlertDirection)}
            className="flex h-11 w-full rounded-xs border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-sm shadow-xs transition-colors focus:border-cyan-500/30 text-white font-mono"
            disabled={!alertWalletAddress || creatingAlert}
          >
            <option value="BELOW" className="bg-zinc-950 text-white font-mono">
              Below threshold
            </option>
            <option value="ABOVE" className="bg-zinc-950 text-white font-mono">
              Above threshold
            </option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400/80">
            {metric === 'CHANGE_1D' || metric === 'CHANGE_7D' ? 'Threshold %' : 'Threshold ($)'}
          </label>
          <Input
            type="number"
            step={metric === 'PRICE_USD' ? '0.0001' : metric === 'TVL_USD' ? '1000' : '0.1'}
            value={threshold}
            onChange={(event) => onThresholdChange(event.target.value)}
            placeholder={metric === 'PRICE_USD' ? '1.50' : metric === 'TVL_USD' ? '10000000' : '10'}
            className="h-11 rounded-xs border border-zinc-800 bg-zinc-950/80 px-3 text-sm text-white focus:border-cyan-500/30 font-mono"
            disabled={!alertWalletAddress || creatingAlert}
          />
          <p className="mt-1 text-xs text-zinc-450 leading-relaxed font-medium">
            {metric === 'TVL_USD'
              ? 'Enter absolute TVL in USD (e.g. 50000000 for $50M).'
              : metric === 'PRICE_USD'
                ? 'Enter target token price in USD (e.g. 1.25).'
                : 'Use the live value above if you want this rule to fire on the next check.'}
          </p>
        </div>

        <div className="flex items-end">
          <Button
            type="submit"
            disabled={!alertWalletAddress || creatingAlert}
            className="h-11 w-full bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-black uppercase tracking-wider rounded-xs shadow-[0_0_8px_rgba(6,182,212,0.2)] transition-all text-xs cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-1" />
            {creatingAlert ? 'Creating...' : 'Save alert'}
          </Button>
        </div>
      </form>
    </div>
  )
}
