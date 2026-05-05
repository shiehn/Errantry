import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentProvider,
  AgentRunOutput,
  AgentRunRequest,
  AgentTurn,
  SurfaceInvocation,
  TracedInvocation,
} from '../types.js';

/**
 * Anthropic provider — Claude tool-use loop via the Messages API.
 *
 * Same shape as OpenAIProvider so scenarios can swap providers without
 * structural changes. Useful for cross-provider self-tests of the
 * framework: if a scenario passes on one provider but fails on another,
 * either the CLI is overfitted to one model's instruction-following or
 * the framework has a provider-specific bug.
 */
export class AnthropicProvider implements AgentProvider {
  readonly kind = 'anthropic' as const;

  async run(req: AgentRunRequest): Promise<AgentRunOutput> {
    const client = new Anthropic({ apiKey: req.apiKey });
    const tools = req.surface.tools().map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Record<string, unknown>,
    }));

    const messages: Anthropic.Messages.MessageParam[] = [
      { role: 'user', content: req.userPrompt },
    ];
    const turns: AgentTurn[] = [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: req.userPrompt },
    ];
    const invocations: TracedInvocation[] = [];
    let finishReason: AgentRunOutput['finishReason'] = 'max_turns';

    for (let turn = 1; turn <= req.maxTurns; turn += 1) {
      const response = await client.messages.create({
        model: req.model,
        max_tokens: 1024,
        system: req.systemPrompt,
        messages,
        tools: tools as Anthropic.Messages.Tool[],
      });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
      );
      const textContent = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      const turnRecord: AgentTurn = {
        role: 'assistant',
        content: textContent,
      };
      if (toolUseBlocks.length > 0) {
        turnRecord.toolCalls = toolUseBlocks.map((tu) => ({
          tool: tu.name,
          args: (tu.input ?? {}) as Record<string, unknown>,
        }));
      }
      turns.push(turnRecord);

      messages.push({ role: 'assistant', content: response.content });

      if (toolUseBlocks.length === 0 || response.stop_reason !== 'tool_use') {
        finishReason = 'completed';
        break;
      }

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const tu of toolUseBlocks) {
        const call: SurfaceInvocation = {
          tool: tu.name,
          args: (tu.input ?? {}) as Record<string, unknown>,
        };
        const startedAt = Date.now();
        const result = await req.surface.invoke(call);
        invocations.push({ turn, call, result, startedAt });

        const toolResultText = formatToolResult(result);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: toolResultText,
          is_error: !result.ok,
        });
        turns.push({
          role: 'tool',
          content: toolResultText,
          toolCallId: tu.id,
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    return { finishReason, turns, invocations };
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
