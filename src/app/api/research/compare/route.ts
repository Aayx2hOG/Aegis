import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { runComparisonAgent } from '@/server/ai/aegis-comparison-agent';
import { prisma } from '@/server/db/prisma';
import { normalizeProtocolSlug } from '@/shared/protocol/slug-resolver';
import { ChainType } from '@/lib/chain/types';

function compactError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GROQ_API_KEY')) {
    return 'Server is missing GROQ_API_KEY. Configure it in deployment environment variables.';
  }
  if (raw.toLowerCase().includes('failed to call a function') || raw.toLowerCase().includes('failed_generation')) {
    return 'AI tool-calling failed for this query. A fallback brief was generated.';
  }
  return raw.length > 240 ? `${raw.slice(0, 240)}...` : raw;
}

// POST /api/research/compare
// Body: { protocolA: string, protocolB: string, chainType: ChainType, walletAddress?: string }
export async function POST(req: NextRequest) {
  try {
    const { protocolA, protocolB, walletAddress, chainType } = (await req.json()) as Partial<{
      protocolA: string;
      protocolB: string;
      walletAddress: string;
      chainType: ChainType;
    }>;

    if (!protocolA || typeof protocolA !== 'string' || !protocolB || typeof protocolB !== 'string') {
      return Response.json({ error: 'Both protocol A and protocol B names are required' }, { status: 400 });
    }

    const normalizedA = normalizeProtocolSlug(protocolA);
    const normalizedB = normalizeProtocolSlug(protocolB);
    const combinedSlug = `compare:${normalizedA}:${normalizedB}`;

    console.log(`[/api/research/compare] Running comparison agent for ${normalizedA} and ${normalizedB} on ${chainType}`);
    const brief = await runComparisonAgent(normalizedA, normalizedB, chainType);

    if (prisma) {
      try {
        await prisma.researchRun.create({
          data: {
            walletAddress: walletAddress?.trim() || null,
            protocolSlug: combinedSlug,
            briefMarkdown: brief.brief,
            toolCalls: brief.toolCalls as unknown as Prisma.InputJsonValue,
          },
        });
        console.log(`[/api/research/compare] Persisted run for ${combinedSlug}`);
      } catch (persistErr) {
        console.error('[/api/research/compare] failed to persist comparative run', persistErr);
      }
    }

    return Response.json(brief);
  } catch (err) {
    console.error('[/api/research/compare]', err);
    return Response.json({ error: compactError(err) }, { status: 500 });
  }
}
