import type { OpportunityScore } from '@/lib/opportunities/scoring'
import type { ProtocolYieldSummary } from '@/lib/opportunities/yields'
import { getProtocolAuditEvidence } from '@/lib/opportunities/audit-evidence'

export type OpportunityRiskFlag = {
  id: string
  label: string
  detail: string
  impact: string
  severity: 'warning' | 'caution' | 'info'
}

export type OpportunityAssessment = {
  confidence: 'High' | 'Medium' | 'Low'
  verdict: 'Standard review' | 'Elevated risk' | 'Review required'
  securityEvidence: 'Verified' | 'Unverified'
  issueSummary?: string
}

export function getOpportunityRiskFlags(
  protocol: OpportunityScore,
  yieldSummary?: ProtocolYieldSummary,
): OpportunityRiskFlag[] {
  const flags: OpportunityRiskFlag[] = []

  if (!getProtocolAuditEvidence(protocol)) {
    flags.push({
      id: 'audit-unavailable',
      label: 'Audit status unverified',
      detail: 'The market feed does not confirm a completed security audit.',
      impact: 'Confidence reduced; no security conclusion is included in the market score.',
      severity: 'caution',
    })
  }
  if (protocol.tvl < 10_000_000) {
    flags.push({
      id: 'low-liquidity',
      label: 'Low protocol TVL',
      detail: 'Lower liquidity can increase exit difficulty and price impact.',
      impact: 'Raises the risk verdict; review exit liquidity before depositing.',
      severity: 'warning',
    })
  }
  if (protocol.change7d != null && protocol.change7d <= -10) {
    flags.push({
      id: 'tvl-decline',
      label: 'Rapid TVL decline',
      detail: `TVL declined ${Math.abs(protocol.change7d).toFixed(1)}% over seven days.`,
      impact: 'Raises the risk verdict; the decline is reflected in market momentum.',
      severity: 'warning',
    })
  }
  if (yieldSummary?.apy != null && yieldSummary.apy >= 30) {
    flags.push({
      id: 'high-apy',
      label: 'Unusually high APY',
      detail: 'High advertised yield can reflect temporary incentives or additional risk.',
      impact: 'Raises the risk verdict; verify whether the rate is sustainable.',
      severity: 'caution',
    })
  }
  if (yieldSummary?.apyReward != null && yieldSummary.apy > 0 && yieldSummary.apyReward / yieldSummary.apy >= 0.5) {
    flags.push({
      id: 'reward-heavy',
      label: 'Reward-heavy yield',
      detail: 'At least half of the APY comes from token incentives that may change.',
      impact: 'Raises the risk verdict; the market score does not forecast reward durability.',
      severity: 'caution',
    })
  }
  if (yieldSummary?.hasImpermanentLossRisk) {
    flags.push({
      id: 'impermanent-loss',
      label: 'Impermanent-loss exposure',
      detail: 'The representative pool is marked as having impermanent-loss risk.',
      impact: 'Raises the risk verdict; loss size depends on assets, prices, and position settings.',
      severity: 'warning',
    })
  }
  if (yieldSummary && !yieldSummary.isCurrentChain) {
    flags.push({
      id: 'alternate-chain-yield',
      label: `Yield shown on ${yieldSummary.poolChain}`,
      detail: 'No representative pool was matched on the selected chain, so this APY requires using another chain.',
      impact: 'Confidence reduced; this yield is not available on the selected chain.',
      severity: 'caution',
    })
  }
  if (!yieldSummary) {
    flags.push({
      id: 'yield-unavailable',
      label: 'Yield unavailable',
      detail: 'No representative yield pool was matched for this protocol.',
      impact: 'Confidence reduced; yield is shown separately until coverage is complete.',
      severity: 'info',
    })
  }

  const priority = { warning: 0, caution: 1, info: 2 }
  return flags.sort((left, right) => priority[left.severity] - priority[right.severity]).slice(0, 3)
}

export function getOpportunityAssessment(
  protocol: OpportunityScore,
  yieldSummary?: ProtocolYieldSummary,
): OpportunityAssessment {
  const flags = getOpportunityRiskFlags(protocol, yieldSummary)
  const securityEvidence = getProtocolAuditEvidence(protocol) ? 'Verified' : 'Unverified'
  const primaryIssue = flags.find((flag) => flag.severity === 'warning' || flag.severity === 'caution')
  const confidenceReductions =
    (protocol.dataCompleteness < 100 ? 1 : 0) +
    (securityEvidence === 'Unverified' ? 1 : 0) +
    (!yieldSummary || !yieldSummary.isCurrentChain ? 1 : 0)

  return {
    confidence: confidenceReductions >= 2 ? 'Low' : confidenceReductions === 1 ? 'Medium' : 'High',
    verdict: flags.some((flag) => flag.severity === 'warning')
      ? 'Review required'
      : flags.some((flag) => flag.severity === 'caution')
        ? 'Elevated risk'
        : 'Standard review',
    securityEvidence,
    issueSummary: primaryIssue?.label,
  }
}
