# Errantry

E2E testing for agent-facing CLIs. Define an ask, let an AI agent use only your CLI, help pages, and error messages, then assert whether it completed the task.

## Why

Most CLI tests answer "does this command work." Errantry answers "can an agent **discover** how to make it work, given only `--help`, error messages, and tool-search?" — which is the question that actually matters when the user of your CLI is an LLM, not a human.

## Status

Phase 1 in progress — see [phasing](#phasing) below.

## Packages

| Package | Status | Role |
|---------|--------|------|
| `@errantry/core` | scaffolding | Agent loop, scenario format, matchers. Test-runner-agnostic. |
| `@errantry/cli` | scaffolding | `errantry run scenario.yaml` standalone CLI. |
| `@errantry/electron-bridge` | scaffolding | Drop-in for Electron-TS apps; exposes assertion endpoints. |
| `@errantry/playwright` | scaffolding | First-class Playwright extension with `errantry` + `app` fixtures. |
| `@errantry/jest` | not started | Secondary adapter for Jest. |

## Try it in 30 seconds (no LLM required)

A bundled "todo" CLI lets you exercise the full pipeline without an OpenAI key:

```bash
npm install
npx tsc -b packages/core packages/cli packages/electron-bridge packages/playwright
bash scripts/mock-todo-test.sh
```

You should see a markdown report with green assertions, a turn count, and a
trace of the bash commands the (mock) agent ran. To run the same scenario
with a real LLM, drop `--mock ...` and set `OPENAI_API_KEY`.

## Programmatic API

```typescript
import { runScenarioFile } from '@errantry/core';

const result = await runScenarioFile('scenarios/todo/happy-path-add.yaml', {
  cwd: workdir,
});
expect(result.passed).toBe(true);
```

## Quick start (Playwright extension, planned)

```typescript
// errantry-tests/scene-create.spec.ts
import { test, expect } from '@errantry/playwright';

test('agent creates a scene from --help discovery alone', async ({ errantry, app }) => {
  await app.bindFixture('blank-project');

  const result = await errantry.run({
    surface: 'cli',
    goal: 'Create a new scene called "Verse" in the currently-bound project.',
    maxTurns: 12,
    model: 'gpt-4o-mini',
  });

  await expect(result).toolCalled('scene_create');
  await expect(app.db).toHaveRow(
    "SELECT name FROM scenes WHERE project_id = $1 AND name = 'Verse'",
    [app.projectId],
  );
  await expect(result).budgetRespected({ turns: 6, errors: 2 });
});
```

## Phasing

- **Phase 1 (current)** — Playwright + CLI surface, deterministic (Tier 1) assertions only.
- **Phase 2** — MCP surface, structural (Tier 2) assertions for generative ops, Jest adapter.
- **Phase 3** — Validate `electron-bridge` against a second app; trace-only mode for pure CLIs.
- **Phase 4** — Cross-run diffing, optional LLM-judge (Tier 3) matcher.

## Development

```bash
nvm use
npm install
npm run build
npm test
```

## License

MIT.
