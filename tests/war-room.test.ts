import { runWarRoomSimulation } from '@/server/ai/war-room-engine'

describe('War Room simulation', () => {
    test('basic simulation returns expected structure', () => {
        const positions = [
            {
                id: 'pos1',
                label: 'Test Token',
                symbol: 'TEST',
                protocol: 'test-proto',
                kind: 'token',
                usdValue: 100000,
                volatility: 50,
                liquidityScore: 80,
            },
        ]

        const scenario = {
            type: 'market-crash',
            title: 'Test',
            beginnerLabel: 'Test',
            beginnerSummary: 'Test',
            marketShockPct: 20,
            stablecoinDepegPct: 0,
            liquidityDropPct: 20,
            oracleDelayMinutes: 1,
            protocolExploitSeverity: 5,
        }

        const result = runWarRoomSimulation(positions as any, scenario as any)

        expect(result).toHaveProperty('summary')
        expect(typeof result.summary.portfolioValueUsd).toBe('number')
        expect(typeof result.summary.projectedValueUsd).toBe('number')
        expect(Array.isArray(result.topActions)).toBe(true)
        expect(result.topActions.length).toBeGreaterThan(0)
    })
})
