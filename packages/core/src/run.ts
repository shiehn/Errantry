import { CliSurface } from './surfaces/cli.js';
import { OpenAIProvider } from './agent/openai.js';
import { computeMetrics } from './metrics.js';
import { runAssertions } from './assertions/index.js';
import { NullAppBridge } from './app-bridge.js';
import type {
  AgentProvider,
  AppBridge,
  Scenario,
  ScenarioResult,
  Surface,
} from './types.js';

export interface RunScenarioOptions {
  scenario: Scenario;
  surface?: Surface;
  bridge?: AppBridge;
  provider?: AgentProvider;
  apiKey?: string;
  /** Working directory for the bash subprocess (only used if a default CLI surface is built). */
  cwd?: string;
}

const DEFAULT_SYSTEM_PROMPT = [
  'You are testing a CLI tool you have never used before.',
  'A binary is available on PATH and its name will be in the user message.',
  'You may invoke `--help`, `tool_search`, dry-runs, or any other discovery command the CLI exposes.',
  'You have NO other documentation. Read error messages carefully and use them to recover.',
  'Run one bash command per tool call. Do not chain unrelated commands.',
  'When the goal is satisfied or you are confident no further action is possible, respond without calling a tool.',
].join('\n');

export async function runScenario(opts: RunScenarioOptions): Promise<ScenarioResult> {
  const { scenario } = opts;
  const startedAt = Date.now();

  const provider = opts.provider ?? buildDefaultProvider(scenario);
  const surface = opts.surface ?? buildDefaultSurface(scenario, opts.cwd);
  const bridge = opts.bridge ?? new NullAppBridge();
  const apiKey = opts.apiKey ?? requiredEnv(providerEnvKey(scenario.agent.provider));

  await applySetup(scenario, bridge);

  const agentOutput = await provider.run({
    model: scenario.agent.model,
    systemPrompt: scenario.agent.system ?? DEFAULT_SYSTEM_PROMPT,
    userPrompt: scenario.goal,
    surface,
    maxTurns: scenario.agent.maxTurns,
    apiKey,
  });

  const metrics = computeMetrics(agentOutput.invocations);
  const partialResult: ScenarioResult = {
    scenario,
    startedAt,
    finishedAt: Date.now(),
    finishReason: agentOutput.finishReason,
    turns: agentOutput.turns,
    invocations: agentOutput.invocations,
    assertions: [],
    metrics,
    passed: false,
  };

  const outcomes = await runAssertions(scenario.assertions, {
    result: partialResult,
    bridge,
  });

  return {
    ...partialResult,
    finishedAt: Date.now(),
    assertions: outcomes,
    passed: outcomes.every((o) => o.passed),
  };
}

async function applySetup(scenario: Scenario, bridge: AppBridge): Promise<void> {
  const setup = scenario.setup;
  if (!setup) return;

  if (setup.appConfig) {
    await bridge.applyConfig(setup.appConfig);
  }
  if (setup.fixture) {
    await bridge.mountFixture(setup.fixture);
  }
  if (setup.smokeWaitFor && setup.smokeWaitFor.length > 0) {
    await waitForSmoke(bridge, setup.smokeWaitFor);
  }
}

async function waitForSmoke(bridge: AppBridge, required: string[]): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const smoke = await bridge.smoke();
    if (required.every((k) => smoke.checks[k] === true)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Smoke checks not ready within 30s. Required: ${required.join(', ')}`,
  );
}

function buildDefaultProvider(scenario: Scenario): AgentProvider {
  if (scenario.agent.provider === 'openai') return new OpenAIProvider();
  throw new Error(
    `Provider "${scenario.agent.provider}" is not yet implemented. Add it to runScenario opts or use openai.`,
  );
}

function buildDefaultSurface(scenario: Scenario, cwd?: string): Surface {
  if (scenario.surface === 'cli') {
    return new CliSurface({ cwd: cwd ?? process.cwd() });
  }
  throw new Error(
    `Surface "${scenario.surface}" requires an explicit Surface instance until phase 2 (mcp) lands.`,
  );
}

function providerEnvKey(provider: 'openai' | 'anthropic'): string {
  return provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
}

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. Errantry never reads keys from scenario YAML.`,
    );
  }
  return value;
}
