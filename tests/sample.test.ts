import createSampleBasket, { SAMPLE_SCALE, SAMPLE_MAX_PER_POSITION_USD } from '../src/shared/war-room-sample'

describe('createSampleBasket', () => {
    it('scales down and caps USD values', () => {
        const positions = [
            { id: '1', label: 'A', protocol: 'X', kind: 'token', usdValue: 100000, volatility: 10 },
            { id: '2', label: 'B', protocol: 'Y', kind: 'token', usdValue: 50, volatility: 5 },
        ] as any

        const sample = createSampleBasket(positions)

        expect(sample.length).toBe(2)
        // first should be scaled and capped
        expect(sample[0].usdValue).toBeLessThanOrEqual(SAMPLE_MAX_PER_POSITION_USD)
        expect(sample[0].usdValue).toBeGreaterThanOrEqual(1)
        // second should be scaled but not below 1
        expect(sample[1].usdValue).toBeGreaterThanOrEqual(1)
        // scaled proportionally (rough check)
        expect(sample[1].usdValue).toBeCloseTo(50 * SAMPLE_SCALE, 2)
    })

    it('returns empty array for falsy input', () => {
        expect(createSampleBasket(null as any)).toEqual([])
        expect(createSampleBasket([])).toEqual([])
    })
})
