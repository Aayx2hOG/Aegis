import { NextRequest } from 'next/server';
import { runResearchAgent } from '@/lib/ai/aegis-research-agent';

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
    const { protocol } = await req.json();
    if (!protocol || typeof protocol !== 'string') {
      return Response.json({ error: 'protocol name required' }, { status: 400 });
    }

    const brief = await runResearchAgent(protocol.trim().toLowerCase());
    return Response.json(brief);
  } catch (err) {
    console.error('[/api/research]', err);
    return Response.json({ error: compactError(err) }, { status: 500 });
  }
}
