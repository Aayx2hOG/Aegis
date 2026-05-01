import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/prisma';

export async function PATCH(req: NextRequest, context: { params: Promise<{ ruleId: string }> }) {
    if (!prisma) {
        return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
    }

    const { ruleId } = await context.params;
    const body = (await req.json()) as Partial<{ enabled: boolean }>;

    if (typeof body.enabled !== 'boolean') {
        return Response.json({ error: 'enabled(boolean) is required' }, { status: 400 });
    }

    const rule = await prisma.alertRule.update({
        where: { id: ruleId },
        data: { enabled: body.enabled },
    });

    return Response.json({ rule });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ ruleId: string }> }) {
    if (!prisma) {
        return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
    }

    const { ruleId } = await context.params;

    await prisma.alertRule.delete({ where: { id: ruleId } });

    return new Response(null, { status: 204 });
}
