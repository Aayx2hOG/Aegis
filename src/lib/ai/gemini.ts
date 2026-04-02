import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'groq-sdk/resources/chat/completions';
import { TOOLS, executeTool } from './tools';
import { SYSTEM_PROMPT } from './prompts';
import type { ResearchBrief } from '@/lib/types/research';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'llama-3.3-70b-versatile'; // smarter at tool use, fits now that TVL is trimmed

const MAX_ITERATIONS = 6;

export async function runResearchAgent(protocol: string): Promise<ResearchBrief> {
  const toolCalls: ResearchBrief['toolCalls'] = [];

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Generate a research brief for the Solana DeFi protocol: "${protocol}". Use your tools to gather live data first.`,
    },
  ];

  let iterations = 0;

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

    // Add assistant message to history
    messages.push(msg as ChatCompletionMessageParam);

    // No tool calls → final brief
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { protocol, brief: msg.content ?? '', toolCalls };
    }

    // Execute each tool call
    for (const call of msg.tool_calls) {
      const name = call.function.name;
      const input = JSON.parse(call.function.arguments) as Record<string, unknown>;

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

      // Feed result back into conversation
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(output),
      });
    }
  }

  throw new Error('Agent exceeded maximum tool iterations without producing a brief');
}
