import { PortfolioPosition } from './types'

// Returns the live positions without scaling or capping, keeping the actual value of each protocol in USD

export const SAMPLE_SCALE = 1.0
export const SAMPLE_MAX_PER_POSITION_USD = Infinity

export function createSampleBasket(positions: PortfolioPosition[]): PortfolioPosition[] {
    if (!positions || positions.length === 0) return []

    return positions.map((p) => {
        return {
            ...p,
            usdValue: Math.round(p.usdValue),
        }
    })
}

export default createSampleBasket
