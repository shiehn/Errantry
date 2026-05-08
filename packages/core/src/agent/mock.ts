import type {
  AgentProvider,
  AgentRunOutput,
  AgentRunRequest,
  AgentTurn,
  SurfaceInvocation,
  TracedInvocation,
} from '../types.js';

/**
 * Scripted provider for tests — replays a fixed sequence of tool calls
 * against the surface. No LLM call. Useful for validating the framework
 * end-to-end without burning tokens, and for the framework's own self-tests.
 *
 * For backward compat: if the script entry is a string, it's wrapped as
 * `{ tool: 'bash', args: { command: <string> } }` so existing CLI-surface
 * tests keep working. Pass `SurfaceInvocation` objects directly to drive
 * non-bash surfaces (e.g. the chat surface).
 */
export type MockScriptEntry = string | SurfaceInvocation;

export class MockProvider implements AgentProvider {
  readonly kind = 'openai' as const; // pretends to be openai for ScenarioAgent compat

  constructor(private readonly script: MockScriptEntry[]) {}

  async run(req: AgentRunRequest): Promise<AgentRunOutput> {
    const turns: AgentTurn[] = [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: req.userPrompt },
    ];
    const invocations: TracedInvocation[] = [];

    for (let i = 0; i < this.script.length && i < req.maxTurns; i += 1) {
      const entry = this.script[i]!;
      const call: SurfaceInvocation =
        typeof entry === 'string'
          ? { tool: 'bash', args: { command: entry } }
          : entry;
      const startedAt = Date.now();
      const result = await req.surface.invoke(call);
      const turn = i + 1;
      invocations.push({ turn, call, result, startedAt });
      turns.push({
        role: 'assistant',
        content: '',
        toolCalls: [call],
      });
      turns.push({
        role: 'tool',
        content: `exit=${result.exitCode}`,
      });
    }

    return { finishReason: 'completed', turns, invocations };
  }
}
