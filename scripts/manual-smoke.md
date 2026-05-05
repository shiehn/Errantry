# Manual smoke run — full Errantry pipeline against sas-assistant

This document covers the **OpenAI-backed end-to-end run** that the in-repo
vitest suite intentionally skips (it would burn tokens on every CI run).
After running this once and confirming the report makes sense, you have
verified the full vertical: Errantry runner → OpenAI → bash → sas CLI →
ToolRegistry → DB → bridge → assertions.

## Prerequisites

1. `OPENAI_API_KEY` exported in your shell.
2. `sas-assistant` built and the `sas` CLI binary on `PATH`:
   ```bash
   cd ~/sas-platform/sas-assistant
   npm run build
   npm link              # or add ./dist/cli to PATH
   ```
3. Errantry built:
   ```bash
   cd ~/sas-platform/Errantry
   npm install
   npx tsc -b packages/core packages/cli packages/electron-bridge packages/playwright
   ```
4. Latest dist staged so the file: dep in sas-assistant resolves:
   ```bash
   cd ~/sas-platform/sas-assistant
   npm install --prefer-offline    # picks up Errantry's dist via file://
   ```

## Stage at least one fixture project

The bridge's `onFixtureMount(name)` hook resolves to `${ERRANTRY_FIXTURES_DIR}/${name}.sasproj`.
Default `ERRANTRY_FIXTURES_DIR` is `${userData}/errantry-fixtures` — drop a real
sas project file there with the matching name. For the included scenarios, you
need a `blank-project.sasproj`. Easiest way: open S&S, create an empty project,
"Save As" into the fixtures dir as `blank-project.sasproj`, quit, then reopen
under test.

```bash
# example fixtures path on macOS
mkdir -p "$HOME/Library/Application Support/Signals & Sorcery/errantry-fixtures"
cp /path/to/your-blank-project.sasproj \
  "$HOME/Library/Application Support/Signals & Sorcery/errantry-fixtures/blank-project.sasproj"
```

## Boot sas-assistant with the Errantry bridge enabled

```bash
cd ~/sas-platform/sas-assistant
ERRANTRY_TEST=1 ENABLE_TEST_SERVER=true npm run electron:dev
```

The bridge listens on **port 7656** (not 7654 — that's the legacy test server).
Confirm it's up:

```bash
curl -s http://127.0.0.1:7656/errantry/health
# → {"ok":true}

curl -s http://127.0.0.1:7656/errantry/smoke
# → {"ready":true,"checks":{}}
```

## Run a scenario

In a separate terminal:

```bash
cd ~/sas-platform/Errantry
node packages/cli/dist/bin/errantry.js run \
  scenarios/sas/scene/happy-path-create.yaml \
  --bridge http://127.0.0.1:7656
```

You should see:

- A markdown report with metrics (turns, errors, friction)
- A trace of the agent's last 10 bash invocations
- Per-assertion pass/fail status

If `passed: true`, the agent successfully discovered `sas scene create` from
`--help` alone and the DB confirms the new scene exists. If any assertion
fails, the trace tells you which help page or error message let the agent
down — that's the entire point of the framework.

## Iterate on help-text or error messages

1. Run the scenario; record metrics (especially `frictionScore`).
2. Edit the relevant help text or error message in `sas-cli/`.
3. Rebuild + re-run.
4. Compare: did the friction drop? Did `helpInvocations` change?

This is the workflow Errantry exists to support.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Bridge ... is unreachable` | sas-assistant not booted with `ERRANTRY_TEST=1` | Re-launch with the env var set |
| `Missing required environment variable: OPENAI_API_KEY` | unset in current shell | `export OPENAI_API_KEY=sk-...` |
| `Cannot find module '@errantry/electron-bridge'` | sas-assistant didn't pick up the file: link | `cd sas-assistant && npm install` |
| `dbQuery → 501` | bridge installed without a `db` handle | check `src/main/index.ts` install call passed `db: getDatabase()` |
| `Errantry fixture not found: ...` | scenario `setup.fixture: blank-project` but no file at `${ERRANTRY_FIXTURES_DIR}/blank-project.sasproj` | stage the fixture file (see "Stage at least one fixture project" above) |
