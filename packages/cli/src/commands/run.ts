import { readFileSync } from 'node:fs';
import {
  HttpAppBridge,
  MockProvider,
  NullAppBridge,
  parseScenarioFile,
  runScenario,
  type AgentProvider,
  type ScenarioResult,
} from '@errantry/core';
import kleur from 'kleur';
import { renderMarkdown } from '../report/markdown.js';

interface RunOpts {
  cwd: string;
  bridge?: string;
  json?: boolean;
  mock?: string;
}

export async function runCommand(scenarioPath: string, opts: RunOpts): Promise<void> {
  const scenario = parseScenarioFile(scenarioPath);
  const bridge = opts.bridge ? new HttpAppBridge(opts.bridge) : new NullAppBridge();
  const provider = opts.mock ? loadMockProvider(opts.mock) : undefined;
  const apiKey = opts.mock ? 'unused-mock' : undefined;

  if (opts.bridge) {
    try {
      const health = await bridge.health();
      if (!health.ok) {
        throw new Error('Bridge reported not healthy.');
      }
    } catch (err) {
      console.error(
        kleur.red(`Bridge ${opts.bridge} is unreachable: ${err instanceof Error ? err.message : err}`),
      );
      process.exit(2);
    }
  }

  const result = await runScenario({
    scenario,
    bridge,
    cwd: opts.cwd,
    ...(provider && { provider }),
    ...(apiKey && { apiKey }),
  });

  if (opts.json) {
    console.log(JSON.stringify(serializeResult(result), null, 2));
  } else {
    console.log(renderMarkdown(result));
  }

  process.exit(result.passed ? 0 : 1);
}

function loadMockProvider(path: string): AgentProvider {
  const raw = readFileSync(path, 'utf8');
  const commands = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  if (commands.length === 0) {
    throw new Error(`Mock script at ${path} has no commands (empty or all comments).`);
  }
  return new MockProvider(commands);
}

function serializeResult(result: ScenarioResult): unknown {
  return {
    name: result.scenario.name,
    passed: result.passed,
    finishReason: result.finishReason,
    metrics: result.metrics,
    assertions: result.assertions,
    invocations: result.invocations.map((i) => ({
      turn: i.turn,
      tool: i.call.tool,
      args: i.call.args,
      ok: i.result.ok,
      exitCode: i.result.exitCode,
      durationMs: i.result.durationMs,
    })),
    durationMs: result.finishedAt - result.startedAt,
  };
}
