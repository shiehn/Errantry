import type {
  AgentProvider,
  AgentRunOutput,
  AgentRunRequest,
  AgentTurn,
  SurfaceInvocation,
  TracedInvocation,
} from '../types.js';

/**
 * Scripted provider for tests — replays a fixed sequence of bash commands
 * against the surface. No LLM call. Useful for validating the framework
 * end-to-end without burning tokens, and for the framework's own self-tests.
 */
export class MockProvider implements AgentProvider {
  readonly kind = 'openai' as const; // pretends to be openai for ScenarioAgent compat

  constructor(private readonly script: string[]) {}

  async run(req: AgentRunRequest): Promise<AgentRunOutput> {
    const turns: AgentTurn[] = [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: req.userPrompt },
    ];
    const invocations: TracedInvocation[] = [];

    for (let i = 0; i < this.script.length && i < req.maxTurns; i += 1) {
      const command = this.script[i]!;
      const call: SurfaceInvocation = { tool: 'bash', args: { command } };
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
