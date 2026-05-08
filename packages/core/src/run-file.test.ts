/**
 * Programmatic API smoke: drop the bundled todo CLI into a temp dir,
 * run the happy-path scenario via runScenarioFile + MockProvider,
 * verify all assertions pass.
 *
 * This is the test users would model their own integration after.
 */
import { mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runScenarioFile } from './run.js';
import { CliSurface } from './surfaces/cli.js';
import { ChatSurface } from './surfaces/chat.js';
import { MockProvider } from './agent/mock.js';
import { parseScenarioFile } from './scenario/parser.js';

const TODO_BIN = resolve(__dirname, '../../../scenarios/fixtures/todo-cli/todo.mjs');
const HAPPY_PATH = resolve(__dirname, '../../../scenarios/todo/happy-path-add.yaml');

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'errantry-run-file-'));
  // Make `todo` available on PATH within workdir.
  const binDir = join(workdir, 'bin');
  mkdirSync(binDir);
  symlinkSync(TODO_BIN, join(binDir, 'todo'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe('runScenarioFile', () => {
  it('runs the bundled todo happy-path scenario via mock provider and passes', async () => {
    const result = await runScenarioFile(HAPPY_PATH, {
      cwd: workdir,
      provider: new MockProvider([
        'bin/todo --help',
        'bin/todo add "Buy milk"',
      ]),
      surface: new CliSurface({
        cwd: workdir,
        env: { PATH: `${join(workdir, 'bin')}:${process.env.PATH ?? ''}` },
      }),
      apiKey: 'unused-mock',
    });

    expect(result.passed).toBe(true);
    const failed = result.assertions.filter((a) => !a.passed);
    expect(failed).toEqual([]);
    expect(result.metrics.helpInvocations).toBe(1);
    expect(result.metrics.errorsEncountered).toBe(0);
  });

  it('parses the SAS chat-surface scenario and runs it with a stubbed ChatSurface', async () => {
    const chatScenario = resolve(
      __dirname,
      '../../../scenarios/sas/scene/happy-path-create-chat.yaml',
    );
    // Sanity: the YAML actually round-trips through the parser.
    const parsed = parseScenarioFile(chatScenario);
    expect(parsed.surface).toBe('chat');
    expect(parsed.goal).toMatch(/Verse/);

    // Stub fetch so the ChatSurface returns a structured success — we're
    // testing the wiring, not the real bridge. dbQuery assertion will fail
    // (no NullAppBridge exec) so we filter that one out.
    const stubFetch = (async () =>
      new Response(
        JSON.stringify({
          text: 'Created scene "Verse".',
          events: [{ type: 'tool_call_done', toolName: 'scene_create', result: { success: true } }],
          iterations: 2,
          iterationLimitHit: false,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;

    // Stub bridge that no-ops the setup ops the YAML asks for. We're
    // testing parser+ChatSurface wiring, not the real bridge plumbing.
    const stubBridge = {
      health: async () => ({ ok: true }),
      applyConfig: async () => undefined,
      mountFixture: async () => ({ projectId: 'stub', projectPath: '/tmp/stub' }),
      reset: async () => undefined,
      dbQuery: async () => ({ rows: [{ name: 'Verse' }] }),
      smoke: async () => ({
        ready: true,
        checks: { audioEngine: true, mainWindow: true, chatPlugin: true },
      }),
    };

    const result = await runScenarioFile(chatScenario, {
      provider: new MockProvider([
        { tool: 'chat', args: { message: 'Create a scene called "Verse".' } },
      ]),
      surface: new ChatSurface({ bridgeUrl: 'http://127.0.0.1:9999', fetchImpl: stubFetch }),
      bridge: stubBridge,
      apiKey: 'unused-mock',
    });

    // toolCalled assertion should pass (chat was called).
    const toolCalled = result.assertions.find((a) => a.matcher === 'toolCalled');
    expect(toolCalled?.passed).toBe(true);
    expect(result.invocations).toHaveLength(1);
    expect(result.invocations[0]?.call.tool).toBe('chat');
  });
});
