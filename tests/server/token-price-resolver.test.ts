import {
  getProtocolTokenIdCandidates,
  getProtocolTokenSearchTerms,
  pickBestCoinGeckoSearchMatch,
  resolveProtocolGeckoId,
  resolveProtocolTokenOverride,
} from '@/lib/protocol/token-price-resolver'

describe('protocol token price resolver', () => {
  it('maps protocol-specific slugs to token price ids', () => {
    expect(resolveProtocolGeckoId('raydium-amm')).toBe('raydium')
    expect(resolveProtocolGeckoId('orca-dex')).toBe('orca')
    expect(resolveProtocolGeckoId('jito-liquid-staking')).toBe('jito-governance-token')
  })

  it('prefers explicit protocol gecko ids when available', () => {
    expect(
      resolveProtocolGeckoId('custom-protocol', {
        slug: 'custom-protocol',
        name: 'Custom',
        gecko_id: 'custom-token',
      } as never),
    ).toBe('custom-token')
  })

  it('resolves reverse aliases through the protocol alias table', () => {
    expect(resolveProtocolTokenOverride('raydium')?.geckoId).toBe('raydium')
    expect(resolveProtocolTokenOverride('raydium-amm')?.geckoId).toBe('raydium')
  })

  it('generates fallback token id candidates from aliases and suffix stripping', () => {
    expect(getProtocolTokenIdCandidates('raydium-amm')).toEqual(expect.arrayContaining(['raydium', 'raydium-amm']))
    expect(getProtocolTokenIdCandidates('uniswap-v3')).toEqual(expect.arrayContaining(['uniswap-v3', 'uniswap']))
  })

  it('generates readable search terms for protocol-like slugs', () => {
    expect(getProtocolTokenSearchTerms('uniswap-v3')).toEqual(expect.arrayContaining(['uniswap v3', 'uniswap']))
  })

  it('picks the best CoinGecko search result deterministically', () => {
    const match = pickBestCoinGeckoSearchMatch('uniswap', [
      { id: 'uniswap-state-dollar', name: 'Uniswap State Dollar', symbol: 'USD' },
      { id: 'uniswap', name: 'Uniswap', symbol: 'UNI', market_cap_rank: 30 },
    ])

    expect(match?.id).toBe('uniswap')
  })
})
