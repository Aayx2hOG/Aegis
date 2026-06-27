import { getProtocolAuditEvidence } from '../../src/lib/opportunities/audit-evidence'

describe('getProtocolAuditEvidence', () => {
  it('classifies Sanctum Validator LST coverage as inherited', () => {
    const evidence = getProtocolAuditEvidence({
      slug: 'sanctum-validator-lsts',
      audits: '0',
    })

    expect(evidence?.type).toBe('inherited')
    expect(evidence?.sourceUrl).toContain('learn.sanctum.so')
    expect(evidence?.summary).toContain('not a direct audit')
  })

  it('uses reported direct audit counts when no reviewed evidence overrides them', () => {
    const evidence = getProtocolAuditEvidence({ slug: 'lido', audits: '2' })

    expect(evidence?.type).toBe('direct')
    expect(evidence?.label).toBe('2 audits reported')
  })

  it('returns no evidence when coverage cannot be verified', () => {
    expect(getProtocolAuditEvidence({ slug: 'unknown', audits: '0' })).toBeNull()
  })
})
