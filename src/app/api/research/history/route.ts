import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
    if (!prisma) {
        return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
    }

    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('walletAddress')?.trim();
    const limitRaw = Number(url.searchParams.get('limit') ?? '10');
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 10;

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
}
