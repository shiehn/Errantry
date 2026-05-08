import { describe, expect, it } from 'vitest';
import { runScenario } from './run.js';
import { MockProvider } from './agent/mock.js';
import { CliSurface } from './surfaces/cli.js';
import { ChatSurface } from './surfaces/chat.js';
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

  it('drives a chat-surface scenario through the mock provider', async () => {
    const chatScenario: Scenario = {
      name: 'chat-create-scene',
      surface: 'chat',
      agent: { provider: 'openai', model: 'mock', maxTurns: 3 },
      goal: 'Create a scene called Verse via the chat assistant.',
      assertions: [{ matcher: 'toolCalled', args: { contains: 'chat' } }],
    };

    // Stub fetch so the ChatSurface returns a structured success without
    // hitting an actual bridge. This is a wiring test, not an integration
    // test — see /errantry/chat handler tests for the bridge contract.
    const stubFetch = (async () =>
      new Response(JSON.stringify({ text: 'Created scene "Verse".', events: [], iterationLimitHit: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;

    const surface = new ChatSurface({ bridgeUrl: 'http://127.0.0.1:9999', fetchImpl: stubFetch });
    const provider = new MockProvider([
      { tool: 'chat', args: { message: 'Create a scene called Verse.' } },
    ]);

    const result = await runScenario({
      scenario: chatScenario,
      provider,
      surface,
      apiKey: 'unused',
    });

    expect(result.passed).toBe(true);
    expect(result.invocations).toHaveLength(1);
    expect(result.invocations[0]?.call.tool).toBe('chat');
    expect(result.invocations[0]?.result.ok).toBe(true);
  });

  it('throws a clear error when chat surface is built without a bridgeUrl', async () => {
    const chatScenario: Scenario = {
      name: 'chat-missing-bridge',
      surface: 'chat',
      agent: { provider: 'openai', model: 'mock', maxTurns: 1 },
      goal: 'g',
      assertions: [{ matcher: 'toolCalled', args: { contains: 'chat' } }],
    };
    const provider = new MockProvider([]);
    // Save and clear ERRANTRY_BRIDGE_URL so the env fallback doesn't mask the error.
    const saved = process.env.ERRANTRY_BRIDGE_URL;
    delete process.env.ERRANTRY_BRIDGE_URL;
    try {
      await expect(
        runScenario({ scenario: chatScenario, provider, apiKey: 'unused' }),
      ).rejects.toThrow(/bridge URL/);
    } finally {
      if (saved !== undefined) process.env.ERRANTRY_BRIDGE_URL = saved;
    }
  });
});
