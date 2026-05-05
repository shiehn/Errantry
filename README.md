# Errantry

Agent-CLI usability testing — drive an LLM through your CLI using only `--help`, error messages, and discovery commands, then assert state. Tests whether your CLI is **legible to an agent**, not just whether commands work.

<p align="center">
  <img src="assets/errantry.png" alt="Errantry" width="420" />
</p>

> Part of the **[Signals & Sorcery](https://signalsandsorcery.com)** ecosystem.

Most CLI tests answer "does this command work." Errantry answers "can an agent **discover** how to make it work, given only the surface your CLI exposes?" — the question that matters when the user of your CLI is an LLM, not a human. Closest neighbors are Terminal-Bench and Inspect AI; both test agent capability on tasks. Errantry inverts the frame: the CLI is the unit under test, the agent is the probe.

## Try it in 30 seconds (no LLM key required)

```bash
git clone git@github.com:shiehn/Errantry.git
cd Errantry
npm install
npx tsc -b packages/core packages/cli packages/electron-bridge packages/playwright
bash scripts/mock-todo-test.sh
```

You'll see a markdown report with green assertions, turn count, and a trace of the bash commands the (mock) agent ran against the bundled `todo` CLI. Real-LLM run: drop `--mock`, set `OPENAI_API_KEY`, same command.

## Why

> If your CLI is organized well enough, and your error messages are contextual enough, an agent should be able to recover from wrong turns and still complete the original ask.

That hypothesis is testable. Define the user's ask in plain English, hand the agent the CLI binary on `PATH`, let it use `--help` / errors / dry-runs, and assert the resulting state. If the assertion fails, your help text or error message is the weak link — and the trace tells you which one.

## Packages

| Package | Role |
|---------|------|
| `@errantry/core` | Agent loop, scenario format (YAML), assertion matchers. OpenAI + Anthropic + Mock providers. Test-runner-agnostic. |
| `@errantry/cli` | `errantry run scenario.yaml` standalone runner with `--mock` for tokenless dry-runs. |
| `@errantry/electron-bridge` | Drop-in HTTP bridge for Electron-TS apps under test — exposes `/errantry/{health,smoke,db/query,fixture,reset,app-config}` from your main process. Read-only SQL guard. |
| `@errantry/playwright` | First-class Playwright extension with `errantry` and `app` fixtures, custom `expect` matchers (`toolCalled`, `budgetRespected`, `toHaveRow`). |

## Scenario format

```yaml
name: happy-path-create-scene
surface: cli

setup:
  fixture: blank-project

agent:
  provider: openai
  model: gpt-4o-mini
  max_turns: 8

goal: |
  Create a new scene called "Verse" in the currently-bound project.

assertions:
  - dbQuery:
      sql: "SELECT name FROM scenes WHERE name = ?"
      args: ["Verse"]
      toHaveAtLeast: 1
  - toolCalled: { contains: scene }
  - helpInvoked: null
  - budget: { turns: 6, errors: 2 }
```

API keys are read from env (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) — never from scenario YAML.

## Programmatic API

For users dropping scenarios into existing Jest / Vitest suites:

```typescript
import { runScenarioFile } from '@errantry/core';

const result = await runScenarioFile('scenarios/todo/happy-path-add.yaml', {
  cwd: workdir,
});
expect(result.passed).toBe(true);
expect(result.metrics.frictionScore).toBeLessThan(0.3);
```

## Playwright extension (first-class for Electron-TS apps)

```typescript
import { test, expect } from '@errantry/playwright';

test('agent creates a scene from --help discovery alone', async ({ errantry, app }) => {
  await app.bindFixture('blank-project');
  const result = await errantry.run({
    surface: 'cli',
    goal: 'Create a new scene called "Verse".',
    maxTurns: 12,
  });
  await expect(result).toolCalled({ contains: 'scene' });
  await expect(app.db).toHaveRow("SELECT name FROM scenes WHERE name = 'Verse'");
  await expect(result).budgetRespected({ turns: 6, errors: 2 });
});
```

## Built-in matchers (Tier 1)

| Matcher | Asserts on |
|---------|------------|
| `dbQuery(sql, args).toHaveRows` / `toHaveAtLeast` / `toMatch` | DB state via the bridge |
| `file(path).toExist` / `.toContain` / `.toMatchRegex` | Filesystem (paths resolve against scenario `cwd`) |
| `audioDuration(path, expectedSeconds, toleranceSeconds)` | Audio length via ffprobe |
| `toolCalled({ contains, matches, tool })` | Trace |
| `helpInvoked` | Agent ran `--help`, `-h`, or `tool_search` |
| `errorRecovered` | Agent hit an error and recovered with a successful retry |
| `budget({ turns, errors, frictionScore })` | Hard budgets, not soft metrics |

Tier 2 (structural, for generative output) and Tier 3 (LLM-judged, for subjective goals) land in later phases.

## Metrics

Every run reports `turns`, `toolCalls`, `helpInvocations`, `errorsEncountered`, `errorsRecovered`, and a `frictionScore` (`(errors − recovered) / completedSubgoals`). Use them to A/B test help-text and error-message changes — "we rewrote the `scene_create` error and friction dropped from 0.4 to 0.1" is a concrete claim Errantry can substantiate.

## Adopting in an Electron-TS app

Three lines in your main process:

```typescript
// src/main/index.ts
import { installErrantryBridge } from '@errantry/electron-bridge';

if (process.env.ERRANTRY_TEST === '1') {
  installErrantryBridge({
    db: getSharedDatabase(),
    onFixtureMount: async (name) => mountFixtureProject(name),
    onReset: async () => resetEphemeralState(),
  });
}
```

Then write scenarios as Playwright tests or YAML — the bridge serves the assertion endpoints `runScenario` calls during setup and verification.

## Status

| Phase | What | State |
|-------|------|-------|
| 1 | Playwright + CLI surface, Tier 1 matchers, sas-assistant adoption | **shipping** |
| 2 | MCP surface, Tier 2 (structural) matchers, `errorRecovered` correlated to remediation, Jest adapter | next |
| 3 | Validate `electron-bridge` against a second app; trace-only mode for pure CLIs | planned |
| 4 | Cross-run diffing, optional Tier 3 (LLM-judge) matcher, HTML reports | planned |

## Development

```bash
npm install
npx tsc -b packages/core packages/cli packages/electron-bridge packages/playwright
npm test           # 40 tests across 4 packages
npm run typecheck
```

## License

MIT.
