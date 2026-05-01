import { NextRequest } from 'next/server'
import { runWarRoomSimulation } from '@/server/ai/war-room-engine'
import type { SimulationRequest } from '@/shared/types/war-room'

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as Partial<SimulationRequest>
        if (!body.positions || !Array.isArray(body.positions) || !body.scenario) {
            return Response.json({ error: 'positions[] and scenario are required' }, { status: 400 })
        }

        const result = runWarRoomSimulation(body.positions, body.scenario)
        return Response.json(result)
    } catch (err) {
        console.error('[/api/war-room/simulate]', err)
        return Response.json({ error: String(err) }, { status: 500 })
    }
}
