import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { runResearchAgent } from '@/lib/ai/aegis-research-agent';
import { prisma } from '@/lib/db/prisma';
import { normalizeProtocolSlug } from '@/lib/protocol/slug-resolver';

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

// POST /api/research
// Body: { protocol: string }
export async function POST(req: NextRequest) {
  try {
    const { protocol, walletAddress } = (await req.json()) as Partial<{ protocol: string; walletAddress: string }>;
    if (!protocol || typeof protocol !== 'string') {
      return Response.json({ error: 'protocol name required' }, { status: 400 });
    }

    const normalizedProtocol = normalizeProtocolSlug(protocol);
    const brief = await runResearchAgent(normalizedProtocol);

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
