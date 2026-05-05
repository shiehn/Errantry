import OpenAI from 'openai';
import type {
  AgentProvider,
  AgentRunOutput,
  AgentRunRequest,
  AgentTurn,
  TracedInvocation,
} from '../types.js';

/**
 * OpenAI provider — uses the chat.completions API in tool-calling mode.
 *
 * We deliberately use chat.completions (not the newer responses API) for now
 * because it has the broadest model coverage and most stable tool semantics.
 * Switching to responses later is a contained change inside this file.
 */
export class OpenAIProvider implements AgentProvider {
  readonly kind = 'openai' as const;

  async run(req: AgentRunRequest): Promise<AgentRunOutput> {
    const client = new OpenAI({ apiKey: req.apiKey });
    const tools = req.surface.tools().map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as Record<string, unknown>,
      },
    }));

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: req.userPrompt },
    ];
    const turns: AgentTurn[] = [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: req.userPrompt },
    ];
    const invocations: TracedInvocation[] = [];
    let finishReason: AgentRunOutput['finishReason'] = 'max_turns';

    for (let turn = 1; turn <= req.maxTurns; turn += 1) {
      const completion = await client.chat.completions.create({
        model: req.model,
        messages,
        tools,
        tool_choice: 'auto',
      });

      const choice = completion.choices[0];
      if (!choice) {
        finishReason = 'error';
        break;
      }
      const msg = choice.message;
      const toolCalls = msg.tool_calls ?? [];

      const assistantContent = msg.content ?? '';
      const turnRecord: AgentTurn = {
        role: 'assistant',
        content: assistantContent,
      };
      if (toolCalls.length > 0) {
        turnRecord.toolCalls = toolCalls.map((tc) => ({
          tool: tc.function.name,
          args: safeJsonParse(tc.function.arguments),
        }));
      }
      turns.push(turnRecord);

      messages.push({
        role: 'assistant',
        content: assistantContent,
        ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
      });

      if (toolCalls.length === 0) {
        // Model finished without calling a tool — done.
        finishReason = 'completed';
        break;
      }

      // Run all tool calls; report results back to the model.
      for (const tc of toolCalls) {
        const args = safeJsonParse(tc.function.arguments);
        const startedAt = Date.now();
        const result = await req.surface.invoke({
          tool: tc.function.name,
          args,
        });
        invocations.push({
          turn,
          call: { tool: tc.function.name, args },
          result,
          startedAt,
        });

        const toolMessageContent = formatToolResult(result);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolMessageContent,
        });
        turns.push({
          role: 'tool',
          content: toolMessageContent,
          toolCallId: tc.id,
        });
      }
    }

    return { finishReason, turns, invocations };
  }
}

function safeJsonParse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function formatToolResult(result: {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}): string {
  const header = `exitCode: ${result.exitCode ?? 'null'} (${result.durationMs}ms)`;
  const stdout = result.stdout ? `STDOUT:\n${result.stdout}` : '';
  const stderr = result.stderr ? `STDERR:\n${result.stderr}` : '';
  return [header, stdout, stderr].filter(Boolean).join('\n\n');
}
