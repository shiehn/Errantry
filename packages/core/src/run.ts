import { CliSurface } from './surfaces/cli.js';
import { OpenAIProvider } from './agent/openai.js';
import { AnthropicProvider } from './agent/anthropic.js';
import { computeMetrics } from './metrics.js';
import { runAssertions } from './assertions/index.js';
import { NullAppBridge } from './app-bridge.js';
import { parseScenarioFile } from './scenario/parser.js';
import type {
  AgentProvider,
  AppBridge,
  Scenario,
  ScenarioResult,
  Surface,
  TracedInvocation,
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

  // Run scenario setup.preCommands BEFORE the agent loop. Output is captured
  // as synthetic turn-0 invocations so --show-trace surfaces them in reports.
  const preInvocations = await runPreCommands(scenario, surface);

  const agentOutput = await provider.run({
    model: scenario.agent.model,
    systemPrompt: scenario.agent.system ?? DEFAULT_SYSTEM_PROMPT,
    userPrompt: scenario.goal,
    surface,
    maxTurns: scenario.agent.maxTurns,
    apiKey,
  });

  // Combine preCommand invocations with agent invocations so the trace
  // shows the full picture (preCommands at turn 0; agent commands at turn 1+).
  const allInvocations = [...preInvocations, ...agentOutput.invocations];
  const metrics = computeMetrics(agentOutput.invocations); // metrics scoped to agent only — preCommands aren't agent friction
  const partialResult: ScenarioResult = {
    scenario,
    startedAt,
    finishedAt: Date.now(),
    finishReason: agentOutput.finishReason,
    turns: agentOutput.turns,
    invocations: allInvocations,
    assertions: [],
    metrics,
    passed: false,
  };

  const outcomes = await runAssertions(scenario.assertions, {
    result: partialResult,
    bridge,
    cwd: opts.cwd ?? process.cwd(),
  });

  return {
    ...partialResult,
    finishedAt: Date.now(),
    assertions: outcomes,
    passed: outcomes.every((o) => o.passed),
  };
}

/**
 * Convenience wrapper for users who want to drop a YAML scenario into an
 * existing test suite (jest, vitest, etc.) without our CLI runner. Loads,
 * parses, and runs the scenario in one call.
 */
export async function runScenarioFile(
  path: string,
  opts: Omit<RunScenarioOptions, 'scenario'> = {},
): Promise<ScenarioResult> {
  const scenario = parseScenarioFile(path);
  return runScenario({ scenario, ...opts });
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

async function runPreCommands(
  scenario: Scenario,
  surface: Surface,
): Promise<TracedInvocation[]> {
  const preCommands = scenario.setup?.preCommands ?? [];
  if (preCommands.length === 0) return [];
  const invocations: TracedInvocation[] = [];
  for (const command of preCommands) {
    const startedAt = Date.now();
    const result = await surface.invoke({ tool: 'bash', args: { command } });
    invocations.push({
      turn: 0,
      call: { tool: 'bash', args: { command } },
      result,
      startedAt,
    });
    if (!result.ok) {
      throw new Error(
        `Scenario preCommand failed (exit=${result.exitCode ?? 'null'}): ${command}\n` +
        `STDOUT: ${result.stdout?.slice(-500) ?? ''}\n` +
        `STDERR: ${result.stderr?.slice(-500) ?? ''}`,
      );
    }
  }
  return invocations;
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
  if (scenario.agent.provider === 'anthropic') return new AnthropicProvider();
  throw new Error(
    `Provider "${scenario.agent.provider}" is not implemented. Pass a provider via runScenario opts or use openai/anthropic.`,
  );
}

function buildDefaultSurface(scenario: Scenario, cwd?: string): Surface {
  if (scenario.surface === 'cli') {
    const opts: { cwd: string; timeoutMs?: number } = { cwd: cwd ?? process.cwd() };
    if (scenario.agent.commandTimeoutMs !== undefined) {
      opts.timeoutMs = scenario.agent.commandTimeoutMs;
    }
    return new CliSurface(opts);
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
