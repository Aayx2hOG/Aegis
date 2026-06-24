const mockExecuteTool = jest.fn()

jest.mock('@/server/ai/aegis-tools', () => ({
  TOOLS: [],
  executeTool: mockExecuteTool,
}))

describe('runResearchAgent fallback', () => {
  const originalGroqApiKey = process.env.GROQ_API_KEY
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    delete process.env.GROQ_API_KEY
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockExecuteTool.mockReset()
    mockExecuteTool.mockImplementation(async (name: string) => {
      if (name === 'get_protocol_snapshot') {
        return {
          name: 'Jito',
          description: 'Liquid staking protocol.',
          symbol: 'JTO',
          tokenPrice: { price: 2.5, priceChange24h: 3.2, volume24h: 1_000_000, marketCap: 250_000_000 },
          recentTransactions: [{ type: 'TRANSFER', signature: 'sig-1', fee: 5000 }],
        }
      }
      if (name === 'get_protocol_tvl') {
        return { tvl: 100_000_000, change1d: 1.2, change7d: 4.5 }
      }
      return { name: 'Jito', description: 'Liquid staking protocol.', symbol: 'JTO' }
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    if (originalGroqApiKey == null) {
      delete process.env.GROQ_API_KEY
    } else {
      process.env.GROQ_API_KEY = originalGroqApiKey
    }
  })

  it('returns a data-backed fallback brief when Groq is not configured', async () => {
    const { runResearchAgent } = await import('@/server/ai/aegis-research-agent')

    const result = await runResearchAgent('jito')

    expect(result.protocol).toBe('jito')
    expect(result.brief).toContain('### Overview')
    expect(result.brief).toContain('Jito')
    expect(result.brief).toContain('| TVL |')
    expect(result.toolCalls.map((call) => call.tool)).toEqual([
      'get_protocol_snapshot',
      'get_protocol_tvl',
      'get_protocol_metadata',
    ])
  })
})
