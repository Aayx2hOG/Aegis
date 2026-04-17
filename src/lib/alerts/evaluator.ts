import { AlertDirection, AlertMetric } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getSolanaProtocols } from '@/lib/api/defillama';
import { resolveProtocolFromList } from '@/lib/protocol/slug-resolver';

const EVENT_DEDUP_MS = 1000 * 60 * 60 * 6;

function isTriggered(currentValue: number, threshold: number, direction: AlertDirection): boolean {
    return direction === AlertDirection.BELOW ? currentValue <= threshold : currentValue >= threshold;
}

function getMetricValue(metric: AlertMetric, change1d: number | null | undefined, change7d: number | null | undefined): number | null {
    if (metric === AlertMetric.CHANGE_1D) return typeof change1d === 'number' ? change1d : null;
    if (metric === AlertMetric.CHANGE_7D) return typeof change7d === 'number' ? change7d : null;
    return null;
}

export async function evaluateAlertsForWallet(walletAddress: string) {
    if (!prisma) {
        throw new Error('DATABASE_URL is not configured.');
    }

    const [rules, protocols] = await Promise.all([
        prisma.alertRule.findMany({
            where: { walletAddress, enabled: true },
            orderBy: { createdAt: 'desc' },
        }),
        getSolanaProtocols(),
    ]);

    let triggered = 0;
    let skipped = 0;

    for (const rule of rules) {
        const market = resolveProtocolFromList(rule.protocolSlug, protocols);
        const currentValue = getMetricValue(rule.metric, market?.change_1d, market?.change_7d);

        if (currentValue == null) {
            skipped++;
            continue;
        }

        if (!isTriggered(currentValue, rule.threshold, rule.direction)) {
            continue;
        }

        const lastEvent = await prisma.alertEvent.findFirst({
            where: { ruleId: rule.id },
            orderBy: { triggeredAt: 'desc' },
            select: { triggeredAt: true },
        });

        const recentlyTriggered =
            lastEvent && Date.now() - new Date(lastEvent.triggeredAt).getTime() < EVENT_DEDUP_MS;

        if (recentlyTriggered) {
            skipped++;
            continue;
        }

        await prisma.alertEvent.create({
            data: {
                ruleId: rule.id,
                walletAddress: rule.walletAddress,
                protocolSlug: rule.protocolSlug,
                metric: rule.metric,
                threshold: rule.threshold,
                direction: rule.direction,
                currentValue,
            },
        });

        await prisma.alertRule.update({
            where: { id: rule.id },
            data: { lastTriggeredAt: new Date() },
        });

        triggered++;
    }

    return {
        totalRules: rules.length,
        triggered,
        skipped,
    };
}
