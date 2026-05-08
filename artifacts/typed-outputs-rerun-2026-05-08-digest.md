# Typed-outputs + canonical-taxonomy rerun — 2 of 5 fixed

Compares the 5 scenarios the plan named as expected flips after Phase A (typed action outputs) + Phase C (canonical taxonomy enforcement at the API boundary). Plan: `step-one-with-this-mutable-gem.md`.

| scenario | sweep3 | rerun | Δ | notes |
| --- | --- | --- | --- | --- |
| `make/bass-and-pads` | FAIL (6/2) | FAIL (8/5) | no flip | agent ran `sas generate track --role {bass,pads}` and both exit=0, but `dbQuery` still returned 0 rows — friction is upstream (project-binding/scene-active context), not a taxonomy or typed-output gap |
| `plan/apply` | FAIL (12/8) | FAIL (14/7) | no flip | agent never invoked `sas apply` — went granular (`rack_set_instrument`, `dsl_generate_midi`, `track rename`) instead. Phase A enables the plan/apply workflow but doesn't make the agent prefer it |
| `plan/validate-plan` | FAIL (12/10) → PASS post prereq-rerun | PASS (8/6) | held PASS | no regression; turn count down (12 → 8) |
| `generate/add-melody` | FAIL (4/1) | **PASS (5/2)** | **✅ FIX** | agent tried `--role melody` (legacy alias not in canonical tuple) → middleware rejected → retry with `--role keys` succeeded |
| `generate/add-synth-lead` | FAIL (3/1) | **PASS (5/3)** | **✅ FIX** | agent tried `role="synth"` → middleware rejected → retry with `role="lead"` succeeded |

**FIX: 2, REGRESS: 0** — every flip went the right direction; nothing that was passing fell over.

**Acceptance threshold (≥4 of 5) NOT MET** — 2 of 5 flipped, vs the 4 the plan called for.

## What worked

The Phase C middleware delivered both its predicted wins exactly. Sample stderr from `add-synth-lead` t4:

```
Error: invalid_taxonomy_token
       Invalid instrument type: role='synth'
  Reason: 'synth' is not a canonical instrument type.
  Fix:    Use one of: bass, keys, lead, pads, strings, brass, winds,
          bells, plucked, arp, chords, drums, kicks, snares, hats, 808s,
          perc, cymbals, atmospheres, fx, vocals.
```

The agent read the `Fix:` list and self-corrected to `role="lead"` on the next turn — exactly the closed-loop behavior the canonical-taxonomy gate was designed to produce.

Same pattern for `add-melody` (`--role melody` legacy alias → rejected → retry with `--role keys`).

## What didn't materialize, and why

The plan predicted Phase A flips for `make/bass-and-pads` and `plan/apply`. Neither happened — but for clearly-distinct reasons that aren't typed-output failures:

- **`make/bass-and-pads`**: the agent already used canonical role tokens correctly (`--role bass`, `--role pads`) and both invocations succeeded (exit=0, ~38–43s each). The `dbQuery` assertion still returned 0 rows. The friction is the test fixture's project-binding ↔ scene-context expectation, not anything Phase A or C addresses. **This scenario will not flip from any output-schema work** — it needs the agent to first bind a project / activate a scene and the rows aren't being persisted to the most-recent fixture's project_id.

- **`plan/apply`**: the agent never invoked `sas apply <plan-file>`. It went straight to granular mutations (`rack_set_instrument`, `dsl_generate_midi`, `track rename`). Phase A makes the plan→validate→apply workflow more legible by typing what each step emits, but agents can still skip the workflow entirely if they don't see a reason to take it. Surfacing `sas apply` more aggressively (or making it a recommendation in the response from `sas plan`) would do more here than typed outputs.

## Implication for the plan

The plan's hypothesis — *"the residual friction is planner-shape, not CLI/help-text shape"* — is partially confirmed. The two flips both came from Phase C (the API-boundary taxonomy gate), which is exactly the silent-token-acceptance class the plan predicted. Phase A's typed outputs land cleanly (validator catches `unknown_output_key` — verified by 19 unit tests) but didn't move the agent's behavior on the two scenarios that exercised it. The agent isn't choosing the plan/apply path even when typed outputs make it safer.

**Net**: Phase C is a load-bearing improvement (2 wins, 0 regressions, exact predicted closed-loop behavior). Phase A is shipped infrastructure that future plan-bearing scenarios will use, but isn't the bottleneck for *today's* friction. Re-evaluation point hit, per the plan: don't continue to Phase B (step-level preconditions) without first seeing whether agents actually use the plan/apply workflow.
