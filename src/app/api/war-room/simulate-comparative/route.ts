import { NextRequest } from 'next/server'
import { runComparativeSimulation } from '@/server/ai/comparative-war-room-engine'
import { MultiChainPortfolioSchema, ChainScenarioConfigSchema } from '@/shared/types'
import { z } from 'zod'

const ComparativeSimulationRequestSchema = z.object({
    portfolio: MultiChainPortfolioSchema,
    scenario: ChainScenarioConfigSchema,
})

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const parsed = ComparativeSimulationRequestSchema.safeParse(body)
        if (!parsed.success) {
            return Response.json(
                { error: 'Invalid request body', details: parsed.error.format() },
                { status: 400 }
            )
        }

        const result = runComparativeSimulation(parsed.data.portfolio, parsed.data.scenario)
        return Response.json(result)
    } catch (err) {
        console.error('[/api/war-room/simulate-comparative]', err)
        return Response.json({ error: String(err) }, { status: 500 })
    }
}
