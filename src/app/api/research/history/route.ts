import { NextRequest } from 'next/server';
import { getDatabaseSetupErrorMessage } from '@/lib/db/prisma-errors';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
    if (!prisma) {
        return Response.json({ error: 'Database is not configured. Set DATABASE_URL or POSTGRES_PRISMA_URL.' }, { status: 503 });
    }

    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('walletAddress')?.trim();
    const limitRaw = Number(url.searchParams.get('limit') ?? '10');
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 10;

    try {
        const runs = await prisma.researchRun.findMany({
            where: walletAddress ? { walletAddress } : undefined,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                walletAddress: true,
                protocolSlug: true,
                briefMarkdown: true,
                createdAt: true,
            },
        });

        return Response.json({ runs });
    } catch (err) {
        const setupError = getDatabaseSetupErrorMessage(err);
        if (setupError) {
            return Response.json({ error: setupError }, { status: 503 });
        }

        return Response.json({ error: 'Research history unavailable.' }, { status: 500 });
    }
}
