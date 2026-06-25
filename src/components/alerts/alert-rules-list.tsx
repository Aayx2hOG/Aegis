'use client'

import { Button } from '@/components/ui/button'
import type { AlertRuleItem } from './alert-types'
import { ALERT_METRIC_LABEL, formatAlertValue } from './alert-utils'

type AlertRulesListProps = {
  rules: AlertRuleItem[]
  visibleRules: AlertRuleItem[]
  loading: boolean
  showAllRules: boolean
  updatingRuleId: string | null
  deletingRuleId: string | null
  onShowAllRulesChange: (showAll: boolean) => void
  onTestRule: (rule: AlertRuleItem) => void
  onToggleRule: (rule: AlertRuleItem) => Promise<void>
  onDeleteRule: (rule: AlertRuleItem) => Promise<void>
}

export function AlertRulesList({
  rules,
  visibleRules,
  loading,
  showAllRules,
  updatingRuleId,
  deletingRuleId,
  onShowAllRulesChange,
  onTestRule,
  onToggleRule,
  onDeleteRule,
}: AlertRulesListProps) {
  return (
    <div className="rounded-xs border border-cyan-500/10 bg-zinc-950/60 p-4 space-y-4 shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-900 pb-2">
        <p className="text-xs font-orbitron font-bold uppercase tracking-wider text-cyan-400">Active Alert Rules</p>
        {rules.length > 0 && (
          <span className="text-xs font-mono font-bold text-zinc-450">
            {loading ? 'loading...' : `${rules.length} saved`}
          </span>
        )}
      </div>
      {rules.length === 0 ? (
        <p className="text-xs text-zinc-400 leading-normal font-mono">
          &gt; No rules yet. Create one above to start monitoring a protocol.
        </p>
      ) : (
        <div className="space-y-3">
          {visibleRules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-xs border border-zinc-900 bg-zinc-950/80 px-3.5 py-3 text-xs text-zinc-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-white text-sm font-orbitron tracking-wider">{rule.protocolSlug}</p>
                  <p className="text-xs text-zinc-400 font-mono mt-1">
                    {ALERT_METRIC_LABEL[rule.metric]} {rule.direction === 'BELOW' ? '<=' : '>='}{' '}
                    {formatAlertValue(rule.metric, rule.threshold)}
                  </p>
                </div>
                <span
                  className={`rounded-xs px-2 py-0.5 text-[10px] font-mono font-bold uppercase border ${
                    rule.enabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                  }`}
                >
                  {rule.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onTestRule(rule)}
                  disabled={updatingRuleId === rule.id || deletingRuleId === rule.id}
                  style={{
                    borderColor: 'rgba(6, 182, 212, 0.3)',
                    backgroundColor: 'rgba(6, 182, 212, 0.05)',
                    color: '#67e8f9',
                  }}
                  className="border rounded-xs font-mono text-xs px-2.5 py-1.5 cursor-pointer transition-all hover:bg-cyan-500/15 hover:text-cyan-200"
                >
                  Test this rule
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleRule(rule)}
                  disabled={updatingRuleId === rule.id || deletingRuleId === rule.id}
                  style={
                    rule.enabled
                      ? {
                          borderColor: 'rgba(245, 158, 11, 0.3)',
                          backgroundColor: 'rgba(245, 158, 11, 0.05)',
                          color: '#f59e0b',
                        }
                      : {
                          borderColor: 'rgba(16, 185, 129, 0.3)',
                          backgroundColor: 'rgba(16, 185, 129, 0.05)',
                          color: '#10b981',
                        }
                  }
                  className="border rounded-xs font-mono text-xs px-2.5 py-1.5 cursor-pointer transition-all hover:opacity-80"
                >
                  {updatingRuleId === rule.id ? 'Updating...' : rule.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteRule(rule)}
                  disabled={updatingRuleId === rule.id || deletingRuleId === rule.id}
                  style={{
                    borderColor: 'rgba(244, 63, 94, 0.3)',
                    backgroundColor: 'rgba(244, 63, 94, 0.05)',
                    color: '#fda4af',
                  }}
                  className="border rounded-xs font-mono text-xs px-2.5 py-1.5 cursor-pointer transition-all hover:bg-rose-500/15 hover:text-rose-200"
                >
                  {deletingRuleId === rule.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {rules.length > 3 && (
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onShowAllRulesChange(!showAllRules)}
            className="border border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-xs font-mono text-xs px-3 py-1.5 cursor-pointer"
          >
            {showAllRules ? 'Show fewer' : `Show all ${rules.length}`}
          </Button>
        </div>
      )}
    </div>
  )
}
