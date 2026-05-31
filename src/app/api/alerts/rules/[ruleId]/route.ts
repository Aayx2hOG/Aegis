import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/prisma';

function normalizeWalletAddress(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ ruleId: string }> }) {
    if (!prisma) {
        return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
    }

    const { ruleId } = await context.params;
    const body = (await req.json()) as Partial<{ walletAddress: string; enabled: boolean }>;

    if (typeof body.enabled !== 'boolean') {
        return Response.json({ error: 'enabled(boolean) is required' }, { status: 400 });
    }

    const walletAddress = normalizeWalletAddress(body.walletAddress)
    if (!walletAddress) {
        return Response.json({ error: 'walletAddress is required' }, { status: 400 })
    }

    const rule = await prisma.alertRule.findUnique({ where: { id: ruleId } });
    if (!rule) {
        return Response.json({ error: 'Rule not found' }, { status: 404 });
    }

    if (rule.walletAddress !== walletAddress) {
        return Response.json({ error: 'Rule not found' }, { status: 404 });
    }

    const updated = await prisma.alertRule.update({
        where: { id: ruleId },
        data: { enabled: body.enabled },
    });

    return Response.json({ rule: updated });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ ruleId: string }> }) {
    if (!prisma) {
        return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
    }

    const { ruleId } = await context.params;

    const walletAddress = normalizeWalletAddress(new URL(req.url).searchParams.get('walletAddress'))
    if (!walletAddress) {
        return Response.json({ error: 'walletAddress is required' }, { status: 400 })
    }

    const rule = await prisma.alertRule.findUnique({ where: { id: ruleId } });
    if (!rule) {
        return Response.json({ error: 'Rule not found' }, { status: 404 });
    }

    if (rule.walletAddress !== walletAddress) {
        return Response.json({ error: 'Rule not found' }, { status: 404 });
    }

    await prisma.alertRule.delete({ where: { id: ruleId } });

    return new Response(null, { status: 204 });
}
