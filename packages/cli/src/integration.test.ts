/**
 * End-to-end integration test: full vertical without OpenAI.
 *
 *   1. Boot the @errantry/electron-bridge in-process with a stub DB.
 *   2. Run a scenario through @errantry/core's runScenario using MockProvider
 *      + a real CliSurface (real bash subprocess).
 *   3. Verify dbQuery, toolCalled, helpInvoked, and budget matchers all
 *      report correctly against the result.
 *
 * If this passes, the framework's full loop works. The remaining gap is
 * "do real LLM agents behave reasonably," which is covered by the manual
 * smoke run documented in scripts/manual-smoke.md.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CliSurface,
  HttpAppBridge,
  MockProvider,
  runScenario,
  type Scenario,
} from '@errantry/core';
import { installErrantryBridge, type InstalledBridge } from '@errantry/electron-bridge';

let bridge: InstalledBridge;
let dbCalls: Array<{ sql: string; args: unknown[] }>;

beforeEach(async () => {
  dbCalls = [];
  bridge = await installErrantryBridge({
    port: 0,
    db: {
      prepare: (sql: string) => ({
        all: (...args: unknown[]) => {
          dbCalls.push({ sql, args });
          // Stub: pretend a scene with the queried name exists.
          if (/scenes/i.test(sql)) return [{ name: 'Verse', id: 1 }];
          return [];
        },
      }),
    },
  });
});

afterEach(async () => {
  await bridge.close();
});

describe('cli integration (no OpenAI)', () => {
  it('runs the full agent loop and applies all assertion types', async () => {
    const scenario: Scenario = {
      name: 'integration-vertical',
      surface: 'cli',
      goal: 'Echo the words "scene Verse" so the test can detect intent.',
      agent: { provider: 'openai', model: 'mock', maxTurns: 3 },
      assertions: [
        {
          matcher: 'dbQuery',
          args: {
            sql: 'SELECT name FROM scenes WHERE name = ?',
            args: ['Verse'],
            toHaveAtLeast: 1,
          },
        },
        { matcher: 'toolCalled', args: { contains: 'Verse' } },
        { matcher: 'helpInvoked', args: {} },
        { matcher: 'budget', args: { turns: 5, errors: 1 } },
      ],
    };

    const provider = new MockProvider([
      'echo using --help to discover commands',
      'echo creating scene Verse',
    ]);
    const surface = new CliSurface({ cwd: process.cwd() });
    const httpBridge = new HttpAppBridge(bridge.url);

    const result = await runScenario({
      scenario,
      provider,
      surface,
      bridge: httpBridge,
      apiKey: 'unused',
    });

    expect(result.passed).toBe(true);
    expect(result.assertions.every((a) => a.passed)).toBe(true);
    expect(dbCalls).toHaveLength(1);
    expect(dbCalls[0]?.args).toEqual(['Verse']);
  });

  it('reports failure when DB returns no rows for an exact-match assertion', async () => {
    const scenario: Scenario = {
      name: 'integration-fail-no-rows',
      surface: 'cli',
      goal: 'Echo done',
      agent: { provider: 'openai', model: 'mock', maxTurns: 2 },
      assertions: [
        {
          matcher: 'dbQuery',
          args: {
            sql: "SELECT * FROM nonexistent WHERE col = 'x'",
            toHaveRows: 1,
          },
        },
      ],
    };

    const provider = new MockProvider(['echo done']);
    const surface = new CliSurface({ cwd: process.cwd() });
    const httpBridge = new HttpAppBridge(bridge.url);

    const result = await runScenario({
      scenario,
      provider,
      surface,
      bridge: httpBridge,
      apiKey: 'unused',
    });

    expect(result.passed).toBe(false);
    expect(result.assertions[0]?.passed).toBe(false);
    expect(result.assertions[0]?.message).toMatch(/expected exactly 1 rows, got 0/);
  });

  it('rejects a write SQL via the bridge guard', async () => {
    const scenario: Scenario = {
      name: 'integration-write-rejected',
      surface: 'cli',
      goal: 'Echo done',
      agent: { provider: 'openai', model: 'mock', maxTurns: 2 },
      assertions: [
        {
          matcher: 'dbQuery',
          args: { sql: 'DELETE FROM scenes', toHaveRows: 0 },
        },
      ],
    };

    const provider = new MockProvider(['echo done']);
    const surface = new CliSurface({ cwd: process.cwd() });
    const httpBridge = new HttpAppBridge(bridge.url);

    const result = await runScenario({
      scenario,
      provider,
      surface,
      bridge: httpBridge,
      apiKey: 'unused',
    });

    expect(result.passed).toBe(false);
    const dbAssertion = result.assertions[0];
    expect(dbAssertion?.passed).toBe(false);
    expect(dbAssertion?.message).toMatch(/Banned|allowed|rejected/i);
  });
});
