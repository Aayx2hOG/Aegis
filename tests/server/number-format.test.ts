import { formatTokenUsd, formatUsd } from '@/lib/format/number'

describe('number formatting', () => {
  it('keeps precision for sub-dollar token prices', () => {
    expect(formatTokenUsd(0.01969)).toBe('$0.01969')
  })

  it('does not round sub-dollar generic USD values to cents', () => {
    expect(formatUsd(0.01969)).toBe('$0.01969')
  })

  it('keeps large USD values readable', () => {
    expect(formatUsd(1072557438.1)).toBe('$1,072,557,438.1')
  })
})
