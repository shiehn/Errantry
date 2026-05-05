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
import { MockProvider } from './agent/mock.js';

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
});
