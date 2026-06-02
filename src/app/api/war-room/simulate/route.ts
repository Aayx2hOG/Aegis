import { NextRequest } from 'next/server'
import { runWarRoomSimulation } from '@/server/ai/war-room-engine'
import { SimulationRequestSchema } from '@/shared/types'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const parsed = SimulationRequestSchema.safeParse(body)
        if (!parsed.success) {
            return Response.json({ error: 'Invalid request body', details: parsed.error.format() }, { status: 400 })
        }

        const result = runWarRoomSimulation(parsed.data.positions, parsed.data.scenario)
        return Response.json(result)
    } catch (err) {
        console.error('[/api/war-room/simulate]', err)
        return Response.json({ error: String(err) }, { status: 500 })
    }
}
