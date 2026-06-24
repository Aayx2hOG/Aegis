import { getEvmRecentTransactions, getEvmTokenMetadata, getEvmTokenPrice } from '@/server/api/evm'

describe('EVM API degraded states', () => {
  const originalFetch = global.fetch
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    global.fetch = originalFetch
    consoleErrorSpy.mockRestore()
  })

  it('does not return mock transactions when Blockscout fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })

    await expect(getEvmRecentTransactions('0x0000000000000000000000000000000000000000', 'base')).rejects.toThrow(
      'EVM transactions unavailable',
    )
  })

  it('does not return mock metadata when Blockscout fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })

    await expect(getEvmTokenMetadata('0x0000000000000000000000000000000000000000', 'base')).rejects.toThrow(
      'EVM token metadata unavailable',
    )
  })

  it('does not return fixed fallback prices when price sources fail', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })

    await expect(getEvmTokenPrice('0x0000000000000000000000000000000000000000', 'base')).rejects.toThrow(
      'EVM token price unavailable',
    )
  })
})
