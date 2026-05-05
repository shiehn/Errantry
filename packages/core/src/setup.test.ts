import { describe, expect, it, vi } from 'vitest';
import { runScenario } from './run.js';
import { MockProvider } from './agent/mock.js';
import { CliSurface } from './surfaces/cli.js';
import type { AppBridge, Scenario } from './types.js';

function makeBridge(): AppBridge & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    health: vi.fn(async () => ({ ok: true })),
    applyConfig: vi.fn(async (config) => {
      calls.push(`applyConfig:${JSON.stringify(config)}`);
    }),
    mountFixture: vi.fn(async (name) => {
      calls.push(`mountFixture:${name}`);
      return { projectId: `p-${name}`, projectPath: `/tmp/${name}` };
    }),
    reset: vi.fn(async () => {
      calls.push('reset');
    }),
    dbQuery: vi.fn(async () => ({ rows: [] })),
    smoke: vi.fn(async () => ({ ready: true, checks: {} })),
  };
}

const baseScenario = (extra: Partial<Scenario> = {}): Scenario => ({
  name: 's',
  surface: 'cli',
  goal: 'Echo done',
  agent: { provider: 'openai', model: 'mock', maxTurns: 2 },
  assertions: [],
  ...extra,
});

describe('runScenario setup wiring', () => {
  it('mounts fixture and applies appConfig before agent runs', async () => {
    const bridge = makeBridge();
    const scenario = baseScenario({
      setup: {
        fixture: 'blank-project',
        appConfig: { providerKeys: { openai: 'sk-test' } },
      },
    });
    await runScenario({
      scenario,
      provider: new MockProvider(['echo done']),
      surface: new CliSurface({ cwd: process.cwd() }),
      bridge,
      apiKey: 'unused',
    });
    expect(bridge.calls).toEqual([
      'applyConfig:{"providerKeys":{"openai":"sk-test"}}',
      'mountFixture:blank-project',
    ]);
  });

  it('skips setup steps when scenario.setup is absent', async () => {
    const bridge = makeBridge();
    await runScenario({
      scenario: baseScenario(),
      provider: new MockProvider(['echo done']),
      surface: new CliSurface({ cwd: process.cwd() }),
      bridge,
      apiKey: 'unused',
    });
    expect(bridge.calls).toEqual([]);
  });
});
