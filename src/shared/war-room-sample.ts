import { PortfolioPosition } from './types'

// Create a smaller, safer sample basket from live positions
// - scales down USD values
// - caps per-position USD to avoid misleading large balances

export const SAMPLE_SCALE = 0.02 // 2% of original values by default
export const SAMPLE_MAX_PER_POSITION_USD = 2000

export function createSampleBasket(positions: PortfolioPosition[]): PortfolioPosition[] {
    if (!positions || positions.length === 0) return []

    return positions.map((p) => {
        const scaledUsd = Math.min(Math.max(p.usdValue * SAMPLE_SCALE, 1), SAMPLE_MAX_PER_POSITION_USD)
        return {
            ...p,
            usdValue: Number(scaledUsd.toFixed(2)),
        }
    })
}

export default createSampleBasket
