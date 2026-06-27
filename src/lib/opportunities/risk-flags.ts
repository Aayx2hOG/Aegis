import type { OpportunityScore } from '@/lib/opportunities/scoring'
import type { ProtocolYieldSummary } from '@/lib/opportunities/yields'
import { getProtocolAuditEvidence } from '@/lib/opportunities/audit-evidence'

export type OpportunityRiskFlag = {
  id: string
  label: string
  detail: string
  severity: 'warning' | 'caution' | 'info'
}

export function getOpportunityRiskFlags(
  protocol: OpportunityScore,
  yieldSummary?: ProtocolYieldSummary,
): OpportunityRiskFlag[] {
  const flags: OpportunityRiskFlag[] = []

  if (!getProtocolAuditEvidence(protocol)) {
    flags.push({
      id: 'audit-unavailable',
      label: 'Audit coverage unavailable',
      detail: 'The market feed does not confirm a completed security audit.',
      severity: 'caution',
    })
  }
  if (protocol.tvl < 10_000_000) {
    flags.push({
      id: 'low-liquidity',
      label: 'Low protocol TVL',
      detail: 'Lower liquidity can increase exit difficulty and price impact.',
      severity: 'warning',
    })
  }
  if (protocol.change7d != null && protocol.change7d <= -10) {
    flags.push({
      id: 'tvl-decline',
      label: 'Rapid TVL decline',
      detail: `TVL declined ${Math.abs(protocol.change7d).toFixed(1)}% over seven days.`,
      severity: 'warning',
    })
  }
  if (yieldSummary?.apy != null && yieldSummary.apy >= 30) {
    flags.push({
      id: 'high-apy',
      label: 'Unusually high APY',
      detail: 'High advertised yield can reflect temporary incentives or additional risk.',
      severity: 'caution',
    })
  }
  if (yieldSummary?.apyReward != null && yieldSummary.apy > 0 && yieldSummary.apyReward / yieldSummary.apy >= 0.5) {
    flags.push({
      id: 'reward-heavy',
      label: 'Reward-heavy yield',
      detail: 'At least half of the APY comes from token incentives that may change.',
      severity: 'caution',
    })
  }
  if (yieldSummary?.hasImpermanentLossRisk) {
    flags.push({
      id: 'impermanent-loss',
      label: 'Impermanent-loss exposure',
      detail: 'The representative pool is marked as having impermanent-loss risk.',
      severity: 'warning',
    })
  }
  if (yieldSummary && !yieldSummary.isCurrentChain) {
    flags.push({
      id: 'alternate-chain-yield',
      label: `Yield shown on ${yieldSummary.poolChain}`,
      detail: 'No representative pool was matched on the selected chain, so this APY requires using another chain.',
      severity: 'caution',
    })
  }
  if (!yieldSummary) {
    flags.push({
      id: 'yield-unavailable',
      label: 'Yield unavailable',
      detail: 'No representative yield pool was matched for this protocol.',
      severity: 'info',
    })
  }

  const priority = { warning: 0, caution: 1, info: 2 }
  return flags.sort((left, right) => priority[left.severity] - priority[right.severity]).slice(0, 3)
}
