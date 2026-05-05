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

## Quick start (planned)

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
