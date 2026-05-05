import { test as baseTest, expect as baseExpect } from '@playwright/test';
import {
  CliSurface,
  HttpAppBridge,
  OpenAIProvider,
  computeMetrics,
  type AgentProvider,
  type AppBridge,
  type Scenario,
  type ScenarioResult,
  type Surface,
} from '@errantry/core';
import { runAssertions } from '@errantry/core/assertions';
import { applyMatchers } from './matchers.js';

export interface ErrantryRunOptions {
  surface?: 'cli' | 'mcp';
  goal: string;
  systemPrompt?: string;
  model?: string;
  provider?: 'openai' | 'anthropic';
  maxTurns?: number;
  cwd?: string;
}

export interface ErrantryFixture {
  run(opts: ErrantryRunOptions): Promise<ScenarioResult>;
}

export interface AppFixture {
  bridge: AppBridge;
  db: AppBridge;
  projectId: string | null;
  bindFixture(name: string): Promise<void>;
  applyConfig(config: Record<string, unknown>): Promise<void>;
  reset(): Promise<void>;
}

interface ErrantryFixtures {
  errantryBridgeUrl: string;
  app: AppFixture;
  errantry: ErrantryFixture;
}

/**
 * The bridge URL is configurable per-project via Playwright's
 * `use: { errantryBridgeUrl: '...' }` block. Default matches the
 * @errantry/electron-bridge default (port 7654 on localhost).
 */
export const test = baseTest.extend<ErrantryFixtures>({
  errantryBridgeUrl: ['http://127.0.0.1:7654', { option: true }],

  app: async ({ errantryBridgeUrl }, use) => {
    const bridge = new HttpAppBridge(errantryBridgeUrl);
    const fixture: AppFixture = {
      bridge,
      db: bridge,
      projectId: null,
      bindFixture: async (name: string) => {
        const result = await bridge.mountFixture(name);
        fixture.projectId = result.projectId;
      },
      applyConfig: async (config: Record<string, unknown>) => {
        await bridge.applyConfig(config);
      },
      reset: async () => {
        await bridge.reset();
        fixture.projectId = null;
      },
    };
    await use(fixture);
    await fixture.reset().catch(() => {
      /* best-effort cleanup */
    });
  },

  errantry: async ({ app }, use) => {
    const fixture: ErrantryFixture = {
      run: async (opts) => runErrantry(opts, app.bridge),
    };
    await use(fixture);
  },
});

const DEFAULT_SYSTEM_PROMPT = [
  'You are testing a CLI tool you have never used before.',
  'A binary is available on PATH and its name will be in the user prompt.',
  'You may invoke `--help`, `tool_search`, dry-runs, or any other discovery command the CLI exposes.',
  'You have NO other documentation. Read error messages carefully and use them to recover.',
  'Run one bash command per tool call.',
  'When the goal is satisfied or you are confident no further action is possible, respond without calling a tool.',
].join('\n');

async function runErrantry(opts: ErrantryRunOptions, bridge: AppBridge): Promise<ScenarioResult> {
  const surface: Surface = new CliSurface({ cwd: opts.cwd ?? process.cwd() });
  const provider: AgentProvider = new OpenAIProvider();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY — Errantry never reads keys from scenarios or fixtures.');
  }

  const scenario: Scenario = {
    name: 'inline-playwright-scenario',
    surface: opts.surface ?? 'cli',
    goal: opts.goal,
    agent: {
      provider: opts.provider ?? 'openai',
      model: opts.model ?? 'gpt-4o-mini',
      maxTurns: opts.maxTurns ?? 12,
      ...(opts.systemPrompt !== undefined && { system: opts.systemPrompt }),
    },
    assertions: [],
  };

  const startedAt = Date.now();
  const agentOutput = await provider.run({
    model: scenario.agent.model,
    systemPrompt: scenario.agent.system ?? DEFAULT_SYSTEM_PROMPT,
    userPrompt: scenario.goal,
    surface,
    maxTurns: scenario.agent.maxTurns,
    apiKey,
  });

  const metrics = computeMetrics(agentOutput.invocations);
  const result: ScenarioResult = {
    scenario,
    startedAt,
    finishedAt: Date.now(),
    finishReason: agentOutput.finishReason,
    turns: agentOutput.turns,
    invocations: agentOutput.invocations,
    assertions: [],
    metrics,
    passed: true,
  };

  // Programmatic users assert via the playwright matchers — return the result
  // so they can chain `await expect(result).toolCalled(...)` etc.
  // We still expose runAssertions for users who want to drive it from a YAML
  // scenario through the playwright fixture.
  void runAssertions; // Re-exported via core; not used directly here.

  return result;
}

export const expect = applyMatchers(baseExpect);
