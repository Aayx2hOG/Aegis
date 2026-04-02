import { NextRequest } from 'next/server';
import { runResearchAgent } from '@/lib/ai/gemini';

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
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
