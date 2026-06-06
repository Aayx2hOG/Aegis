import createSampleBasket, { SAMPLE_SCALE, SAMPLE_MAX_PER_POSITION_USD } from '../src/shared/war-room-sample'

describe('createSampleBasket', () => {
    it('keeps actual USD values without scaling or capping', () => {
        const positions = [
            { id: '1', label: 'A', protocol: 'X', kind: 'token', usdValue: 100000, volatility: 10 },
            { id: '2', label: 'B', protocol: 'Y', kind: 'token', usdValue: 50, volatility: 5 },
        ] as any

        const sample = createSampleBasket(positions)

        expect(sample.length).toBe(2)
        expect(sample[0].usdValue).toBe(100000)
        expect(sample[1].usdValue).toBe(50)
    })

    it('returns empty array for falsy input', () => {
        expect(createSampleBasket(null as any)).toEqual([])
        expect(createSampleBasket([])).toEqual([])
    })
})
