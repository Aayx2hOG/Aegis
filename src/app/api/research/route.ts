import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { runResearchAgent } from '@/server/ai/aegis-research-agent';
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

import { z } from 'zod';

const ResearchRequestSchema = z.object({
  protocol: z.string().min(1, 'protocol name required'),
  walletAddress: z.string().optional().nullable(),
  chainType: z.nativeEnum(ChainType),
});

// POST /api/research
// Body: { protocol: string, chainType: ChainType, walletAddress?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ResearchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid parameters', details: parsed.error.format() }, { status: 400 });
    }

    const { protocol, walletAddress, chainType } = parsed.data;


    const normalizedProtocol = normalizeProtocolSlug(protocol);
    const brief = await runResearchAgent(normalizedProtocol, chainType);

    if (prisma) {
      try {
        await prisma.researchRun.create({
          data: {
            walletAddress: walletAddress?.trim() || null,
            protocolSlug: normalizedProtocol,
            briefMarkdown: brief.brief,
            toolCalls: brief.toolCalls as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (persistErr) {
        console.error('[/api/research] failed to persist run', persistErr);
      }
    }

    return Response.json(brief);
  } catch (err) {
    console.error('[/api/research]', err);
    return Response.json({ error: compactError(err) }, { status: 500 });
  }
}
