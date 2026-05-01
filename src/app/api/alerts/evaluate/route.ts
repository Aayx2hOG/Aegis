import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { evaluateAlertsForWallet } from '@/server/alerts/evaluator';

export async function POST(req: NextRequest) {
    if (!prisma) {
        return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
    }

    const body = (await req.json()) as Partial<{ walletAddress: string }>;
    const walletAddress = body.walletAddress?.trim();

    if (!walletAddress) {
        return Response.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    try {
        const summary = await evaluateAlertsForWallet(walletAddress);
        return Response.json(summary);
    } catch (err) {
        return Response.json({ error: String(err) }, { status: 500 });
    }
}
