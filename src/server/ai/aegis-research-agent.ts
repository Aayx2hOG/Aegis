import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'groq-sdk/resources/chat/completions';
import { TOOLS, executeTool } from './aegis-tools';
import { SYSTEM_PROMPT } from './aegis-prompts';
import type { ResearchBrief } from '@/shared/types/research';

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set. Configure it in your deployment environment.');
  }
  return new Groq({ apiKey });
}

const MODEL = 'llama-3.3-70b-versatile';

const MAX_ITERATIONS = 6;

function safeJsonParse(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function summarizeValue(value: unknown): string {
  if (value == null) return 'Unavailable';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'Unavailable';
  if (typeof value === 'string') return value || 'Unavailable';
  return 'Unavailable';
}

function usd(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'Unavailable';
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function text(value: unknown): string {
  if (value == null) return 'Unavailable';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'Unavailable';
  if (typeof value === 'string') return value.trim() ? value : 'Unavailable';
  return 'Unavailable';
}

async function buildFallbackBrief(protocol: string, toolCalls: ResearchBrief['toolCalls']): Promise<ResearchBrief> {
  const [snapshot, tvl] = await Promise.allSettled([
    executeTool('get_protocol_snapshot', { slug: protocol }),
    executeTool('get_protocol_tvl', { slug: protocol }),
  ]);

  const snapshotOutput = snapshot.status === 'fulfilled' ? snapshot.value : { error: String(snapshot.reason) };
  const tvlOutput = tvl.status === 'fulfilled' ? tvl.value : { error: String(tvl.reason) };

  toolCalls.push(
    {
      tool: 'get_protocol_snapshot',
      input: { slug: protocol },
      output: snapshotOutput,
      durationMs: 0,
      error: snapshot.status === 'rejected' ? String(snapshot.reason) : undefined,
    },
    {
      tool: 'get_protocol_tvl',
      input: { slug: protocol },
      output: tvlOutput,
      durationMs: 0,
      error: tvl.status === 'rejected' ? String(tvl.reason) : undefined,
    }
  );

  const s = snapshot.status === 'fulfilled' ? (snapshot.value as Record<string, unknown>) : {};
  const t = tvl.status === 'fulfilled' ? (tvl.value as Record<string, unknown>) : {};
  const tokenPrice = (s.tokenPrice ?? {}) as Record<string, unknown>;
  const marketFallback = (s.marketFallback ?? {}) as Record<string, unknown>;
  const recentTransactions = Array.isArray(s.recentTransactions)
    ? (s.recentTransactions as Record<string, unknown>[])
    : [];
  const txFallback = (s.txFallback ?? {}) as Record<string, unknown>;

  const resolvedPrice = tokenPrice.price ?? marketFallback.price;
  const resolvedVolume = tokenPrice.volume24h ?? marketFallback.volume24h;
  const resolvedMarketCap = tokenPrice.marketCap ?? marketFallback.marketCap;
  const resolvedPriceChange = tokenPrice.priceChange24h ?? marketFallback.priceChange24h;

  const txSummary =
    recentTransactions.length > 0
      ? recentTransactions
        .slice(0, 3)
        .map((tx) => `- ${summarizeValue(tx.type)} | ${summarizeValue(tx.signature)} | fee: ${summarizeValue(tx.fee)}`)
        .join('\n')
      : `- No parsed Helius tx available; fallback activity proxy (TVL trend 1d): ${text(txFallback.delta1dPct)}%`;

  const fallback = [
    '### Overview',
    `${text(s.name) || protocol} is a Solana DeFi protocol. ${text(s.description)}`,
    '',
    '### Key Metrics',
    '| Metric | Value |',
    '| --- | --- |',
    `| TVL | ${usd(t.tvl)} |`,
    `| 24h TVL Change | ${text(t.change1d)} |`,
    `| Token Price | ${usd(resolvedPrice)} |`,
    `| 24h Price Change | ${text(resolvedPriceChange)} |`,
    `| 24h Volume | ${usd(resolvedVolume)} |`,
    `| Market Cap | ${usd(resolvedMarketCap)} |`,
    '',
    '### On-Chain Activity',
    txSummary,
    '',
    '### Risk & Opportunity',
    '- Risk: Missing or stale metrics can reduce confidence in short-term signals.',
    '- Opportunity: Strong TVL and trading activity can indicate durable protocol traction.',
    '',
    '### Summary Verdict',
    'Use this as a baseline brief; verify critical entries with independent sources before execution.',
  ].join('\n');

  return {
    protocol,
    brief: fallback,
    toolCalls,
  };
}

export async function runResearchAgent(protocol: string): Promise<ResearchBrief> {
  const groq = getGroqClient();
  const toolCalls: ResearchBrief['toolCalls'] = [];

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Generate a research brief for the Solana DeFi protocol: "${protocol}". Use your tools to gather live data first.`,
    },
  ];

  let iterations = 0;
  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await groq.chat.completions.create({
        model: MODEL,
        messages,
        tools: TOOLS as ChatCompletionTool[],
        tool_choice: 'auto',
      });

      const choice = response.choices[0];
      const msg = choice.message;

      messages.push(msg as ChatCompletionMessageParam);

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return { protocol, brief: msg.content ?? '', toolCalls };
      }

      for (const call of msg.tool_calls) {
        const name = call.function.name;
        const input = safeJsonParse(call.function.arguments);

        const start = Date.now();
        let output: unknown;
        let error: string | undefined;

        try {
          output = await executeTool(name, input);
        } catch (err) {
          error = String(err);
          output = { error };
        }

        toolCalls.push({
          tool: name,
          input,
          output,
          durationMs: Date.now() - start,
          error,
        });

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(output),
        });
      }
    }
  } catch (err) {
    console.error('[runResearchAgent] tool loop failed, using fallback brief', err);
    return buildFallbackBrief(protocol, toolCalls);
  }

  return buildFallbackBrief(protocol, toolCalls);
}