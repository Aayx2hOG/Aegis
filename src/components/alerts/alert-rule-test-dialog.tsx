'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { SolanaProtocol } from '@/lib/types'
import type { AlertRuleItem, AlertTestResultItem } from './alert-types'
import { ALERT_METRIC_LABEL, formatAlertValue, getLocalCurrentValueForRule } from './alert-utils'

type AlertRuleTestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRule: AlertRuleItem | null
  testRuleValue: string
  onTestRuleValueChange: (value: string) => void
  testResults: AlertTestResultItem[]
  findMarketProtocol: (protocolSlug: string) => SolanaProtocol | undefined
  priceBySlug: Record<string, { priceUsd: number | null; priceChange24h: number | null }>
  onEvaluate: (rule: AlertRuleItem, value: string) => Promise<void>
}

export function AlertRuleTestDialog({
  open,
  onOpenChange,
  selectedRule,
  testRuleValue,
  onTestRuleValueChange,
  testResults,
  findMarketProtocol,
  priceBySlug,
  onEvaluate,
}: AlertRuleTestDialogProps) {
  const latestResult = selectedRule && testResults[0]?.ruleId === selectedRule.id ? testResults[0] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-cyan-500/20 bg-zinc-950/95 text-zinc-100 sm:max-w-lg rounded-xs backdrop-blur-md shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-orbitron tracking-wider text-lg uppercase text-cyan-400">
            Manual test rule
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs font-mono">
            Enter a value to see whether the rule would pass or fail. This does not create a real alert.
          </DialogDescription>
        </DialogHeader>
        {selectedRule && (
          <div className="space-y-4">
            <div className="rounded-xs border border-zinc-900 bg-zinc-950/80 p-4 text-xs text-zinc-200">
              <p className="font-orbitron font-bold text-white uppercase tracking-wider">{selectedRule.protocolSlug}</p>
              <p className="mt-1.5 font-mono text-zinc-400">
                {ALERT_METRIC_LABEL[selectedRule.metric]} {selectedRule.direction === 'BELOW' ? '<=' : '>='}{' '}
                {formatAlertValue(selectedRule.metric, selectedRule.threshold)}
              </p>
            </div>
            <label className="grid gap-2 text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400/80">
              Test value
              <Input
                type="number"
                step={
                  selectedRule.metric === 'PRICE_USD' ? '0.0001' : selectedRule.metric === 'TVL_USD' ? '1000' : '0.1'
                }
                value={testRuleValue}
                onChange={(event) => onTestRuleValueChange(event.target.value)}
                className="rounded-xs border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-hidden transition focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 font-mono text-xs"
              />
            </label>
            <p className="text-xs text-zinc-400 font-mono">
              Current live value for reference:{' '}
              {(() => {
                const market = findMarketProtocol(selectedRule.protocolSlug)
                const price = priceBySlug[selectedRule.protocolSlug]?.priceUsd ?? null
                const liveValue = getLocalCurrentValueForRule(selectedRule, market, price)
                return liveValue == null ? 'unavailable' : formatAlertValue(selectedRule.metric, liveValue)
              })()}
            </p>
            {latestResult ? (
              <div
                className={`rounded-xs border p-4 text-xs space-y-2 backdrop-blur-md ${
                  latestResult.triggered
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/5 border-rose-500/15 text-rose-350'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold uppercase tracking-wider text-[10px] font-orbitron text-zinc-400">
                    Latest manual result
                  </p>
                  <span
                    className={`rounded-xs px-2 py-0.5 text-[10px] font-mono font-bold uppercase border ${
                      latestResult.triggered
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                    }`}
                  >
                    {latestResult.triggered ? 'PASSED (Alert Fires)' : 'FAILED (No Alert)'}
                  </span>
                </div>
                <p className="text-zinc-300 text-xs leading-relaxed font-mono">{latestResult.summary}</p>
              </div>
            ) : null}
          </div>
        )}
        <DialogFooter className="sm:justify-between gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border border-zinc-800 bg-zinc-900/50 text-zinc-350 hover:text-white hover:bg-zinc-900 rounded-xs font-mono text-xs px-3 py-1.5 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={async () => {
              if (!selectedRule) return
              await onEvaluate(selectedRule, testRuleValue)
            }}
            className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-orbitron font-black uppercase tracking-wider rounded-xs shadow-[0_0_8px_rgba(6,182,212,0.2)] transition-all text-xs cursor-pointer px-4 py-1.5"
          >
            Evaluate test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
