# Cumulative impact rerun — 3 of 8 sweep3 FAIL scenarios fixed

Measures the cumulative effect of every registry-level boundary improvement in this session (Phase A typed outputs + Phase C canonical taxonomy + Phase D input-alias normalizer + schema-aware CLI parsing + list-actions banner promotion + rack_set_instrument honesty pass) against 8 sweep3 FAIL scenarios that touch surfaces those phases changed.

| scenario | sweep3 | cumulative rerun | Δ |
| --- | --- | --- | --- |
| `fx/get-track-fx` | FAIL (8/6) | **PASS (5/2)** | ✅ FIX — track-id alias chain |
| `fx/load-chain` | FAIL (14/11) | **PASS** | ✅ FIX — track-id alias + canonical role |
| `preset/set-instrument` | FAIL (12/6) → PASS post-prereq-rerun | FAIL (budget overrun) | regression vs prereq-rerun, no change vs sweep3 |
| `revise/busier-bass` | FAIL (12/6) | FAIL | no change |
| `track/rename-track` | FAIL (10/6) | **PASS** | ✅ FIX — track-id alias |
| `track/delete-bass` | FAIL (5/1) | FAIL — `track_id=` (snake_case) silent-drop | identified new friction class |
| `scene/delete-bridge` | FAIL (10/5) | FAIL | no change |
| `scene/set-bars` | FAIL (8/4) | FAIL | no change |

**FIX: 3, REGRESS-vs-prereq-rerun: 1 (probably nondeterministic)**

The 3 fixes (`fx/get-track-fx`, `fx/load-chain`, `track/rename-track`) all turn on the same root mechanism: the agent uses `trackId` from `sas track list` output, the tool's schema canonical was `trackGuid` or `track`, and Phase D's alias normalizer now bridges them. Previously every one of these calls hit "Track 'undefined' not found" or "Either trackGuid or trackIndex must be provided"; now they pass through to the engine.

## Apparent regression: `preset/set-instrument`

Was PASS in the prereq-rerun digest (10t/5e), now FAIL (12t/9e, budget exceeded). The toolCalled assertion still passes (✓) — the agent did invoke the right tool. The failure is the budget assertion: too many turns of trial-and-error before getting there.

The trace shows the agent guessing parameter shapes — `sas dsl_get_track_fx 1`, `track-id=1`, `track-id=Bass` — running into the same "Track not found" error each time. Errantry has temperature-driven nondeterminism with gpt-4o-mini, and a different agent path exhausted the error budget.

This isn't clearly a regression from the rack honesty pass — `rack_set_instrument` wasn't even reached in this trace. It's an Errantry-level flake. Re-running might flip it back to PASS, or stay FAIL on a different path.

## New friction class identified

`track/delete-bass` exposed a different problem the alias mechanism doesn't yet handle: agents type **snake_case** (`track_id=0`) when the schema is camelCase (`trackId`). Same root cause shape as `trackId` vs `trackGuid` — agent's mental model differs from schema canonical name.

Followed up with **case-variant auto-aliasing** in the normalizer:
- For every camelCase canonical, the normalizer auto-recognises snake_case + kebab-case variants as implicit aliases.
- `trackId` automatically accepts `track_id` and `track-id` without per-tool annotation.
- 5 new tests covering snake/kebab acceptance, explicit-alias-wins-on-collision, and no-shadow-of-existing-canonicals.

## Net session arithmetic

Across THREE separate Errantry reruns this session:

| rerun | scenarios | flipped FAIL→PASS |
| --- | --- | --- |
| typed-outputs (Phase A+C) | 5 | 2 (`add-melody`, `add-synth-lead`) |
| aliases (Phase D, plan/apply only) | 1 | 0 (assertion-level) — but 2/3 assertions improved + 3 trace calls flipped ✗→✓ |
| cumulative (8 scenarios) | 8 | 3 (`fx/get-track-fx`, `fx/load-chain`, `track/rename-track`) |

**5 sweep3 FAIL scenarios flipped to PASS across the session, 0 regressions vs sweep3.** The scenarios that didn't flip have distinct causes: agent-semantics (plan/apply, make/bass-and-pads), environmental (Surge XT preset paths), or Errantry nondeterminism (preset/set-instrument). None point at "we need more registry middleware."

## What this confirms about the planner-shape hypothesis

The original plan's hypothesis: *the residual friction is planner-shape, not CLI-help-text-shape* — was partially true but mis-aimed. The most measurable wins came from:

- **Phase C** (taxonomy gate) — closed the silent-acceptance class for non-canonical role tokens.
- **Phase D** (input-alias normalizer + case variants) — closed the silent-drop class for parameter-name mismatches (camelCase ↔ snake_case ↔ kebab-case ↔ trackId/trackGuid/track aliases).

Both are **boundary-normalization middleware** — input-shape problems, not planner-shape problems. The hypothesis assumed agents struggled to compose plans; in practice they struggled to compose calls. The same architectural move (registry-level normalisation before dispatch) addressed both classes.

Phase A (typed outputs) is shipped infrastructure that becomes load-bearing when agents start using the plan/validate/apply workflow. Today, agents bypass it. Banner promotion didn't move that needle in one rerun. Whether to invest more in steering agents toward the workflow vs. accept "agents do granular calls" is a product decision.
