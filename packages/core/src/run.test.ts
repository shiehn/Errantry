import { describe, expect, it } from 'vitest';
import { runScenario } from './run.js';
import { MockProvider } from './agent/mock.js';
import { CliSurface } from './surfaces/cli.js';
import type { Scenario } from './types.js';

const baseScenario: Scenario = {
  name: 'self-test-help',
  surface: 'cli',
  agent: { provider: 'openai', model: 'mock', maxTurns: 5 },
  goal: 'Run echo to test the loop.',
  assertions: [
    { matcher: 'helpInvoked', args: {} },
    { matcher: 'toolCalled', args: { contains: 'echo' } },
  ],
};

describe('runScenario (with mock provider)', () => {
  it('runs the scripted agent loop and applies assertions', async () => {
    const provider = new MockProvider(['echo --help', 'echo done']);
    const surface = new CliSurface({ cwd: process.cwd() });

    const result = await runScenario({
      scenario: baseScenario,
      provider,
      surface,
      apiKey: 'unused',
    });

    expect(result.passed).toBe(true);
    expect(result.invocations).toHaveLength(2);
    expect(result.metrics.helpInvocations).toBe(1);
    expect(result.metrics.toolCalls).toBe(2);
    expect(result.assertions.every((a) => a.passed)).toBe(true);
  });

  it('reports assertion failures cleanly', async () => {
    const provider = new MockProvider(['echo no-help-here']);
    const surface = new CliSurface({ cwd: process.cwd() });

    const result = await runScenario({
      scenario: baseScenario,
      provider,
      surface,
      apiKey: 'unused',
    });

    expect(result.passed).toBe(false);
    const helpAssertion = result.assertions.find((a) => a.matcher === 'helpInvoked');
    expect(helpAssertion?.passed).toBe(false);
  });
});
