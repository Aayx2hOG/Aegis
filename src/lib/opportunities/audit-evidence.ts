export type AuditEvidenceType = 'direct' | 'inherited' | 'self-reported'

export type AuditEvidence = {
  type: AuditEvidenceType
  label: string
  summary: string
  sourceLabel: string
  sourceUrl: string
  reviewedAt?: string
}

const REVIEWED_AUDIT_EVIDENCE: Readonly<Record<string, AuditEvidence>> = {
  'sanctum-validator-lsts': {
    type: 'inherited',
    label: 'Inherited audit coverage',
    summary:
      'Sanctum states that its Validator LSTs use a fork of the audited Solana Labs stake-pool program. This is not a direct audit of every validator LST.',
    sourceLabel: 'Sanctum technical documentation',
    sourceUrl: 'https://learn.sanctum.so/docs/technical-documentation/sanctum-lsts',
    reviewedAt: '2026-06-28',
  },
}

export function getProtocolAuditEvidence(protocol: { slug: string; audits?: string | null }): AuditEvidence | null {
  const reviewed = REVIEWED_AUDIT_EVIDENCE[protocol.slug]
  if (reviewed) return reviewed

  const auditCount = Number(protocol.audits)
  if (Number.isFinite(auditCount) && auditCount > 0) {
    return {
      type: 'direct',
      label: `${auditCount} audit${auditCount === 1 ? '' : 's'} reported`,
      summary:
        'DeFiLlama reports completed audits for this protocol. Review the underlying reports before relying on this coverage.',
      sourceLabel: 'DeFiLlama protocol record',
      sourceUrl: `https://defillama.com/protocol/${encodeURIComponent(protocol.slug)}`,
    }
  }

  return null
}
