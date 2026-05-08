# Errantry sweep digest — 73 scenarios processed

- **PASS**: 33 / 73
- **FAIL**: 23 / 73
- **incomplete/unknown**: 17

## Per-scenario (sorted by failure → friction desc)

| status | friction | turns | errs | scenario |
| --- | --- | --- | --- | --- |
| FAIL | 0.0 | 8 | 5 | `diagnostic/check-surge-xt` |
| FAIL | 0.0 | 14 | 15 | `fx/load-chain` |
| FAIL | 0.0 | 10 | 7 | `fx/random-fx` |
| FAIL | 0.0 | 5 | 2 | `generate/add-melody` |
| FAIL | 0.0 | 8 | 6 | `history/checkpoint` |
| FAIL | 0.0 | 6 | 2 | `history/undo` |
| FAIL | 0.0 | 4 | 1 | `inspect/musical-context` |
| FAIL | 0.0 | 2 | 15 | `inspect/project-snapshot` |
| FAIL | 0.0 | 5 | 2 | `make/bass-and-pads` |
| FAIL | 0.0 | 8 | 3 | `musical-context/set-key` |
| FAIL | 0.0 | 14 | 10 | `plan/apply` |
| FAIL | 0.0 | 3 | 0 | `plan/build-plan` |
| FAIL | 0.0 | 12 | 10 | `plan/validate-plan` |
| FAIL | 0.0 | 12 | 12 | `preset/set-instrument` |
| FAIL | 0.0 | 1 | 0 | `project/status` |
| FAIL | 0.0 | 7 | 3 | `revise/busier-bass` |
| FAIL | 0.0 | 10 | 14 | `sample/fit-to-scene` |
| FAIL | 0.0 | 6 | 5 | `sample/search-samples` |
| FAIL | 0.0 | 10 | 9 | `scene/add-track` |
| FAIL | 0.0 | 9 | 3 | `scene/delete-bridge` |
| FAIL | 0.0 | 8 | 6 | `scene/get-tracks-in-verse` |
| FAIL | 0.0 | 12 | 6 | `scene/move-track` |
| FAIL | 0.0 | 8 | 5 | `scene/queue` |
| PASS | 0.0 | 6 | 3 | `discover/tool-search` |
| PASS | 0.0 | 6 | 0 | `fx/get-preset-categories` |
| PASS | 0.0 | 9 | 2 | `fx/get-random-fx-chain` |
| PASS | 0.0 | 8 | 3 | `fx/get-track-fx` |
| PASS | 0.0 | 4 | 0 | `fx/scene-fx` |
| PASS | 0.0 | 6 | 1 | `fx/set-track-fx` |
| PASS | 0.0 | 7 | 2 | `generate/add-drums` |
| PASS | 0.0 | 6 | 4 | `generate/add-synth-lead` |
| PASS | 0.0 | 4 | 0 | `history/delete-checkpoint` |
| PASS | 0.0 | 6 | 3 | `history/inspect-history` |
| PASS | 0.0 | 3 | 0 | `history/list-checkpoints` |
| PASS | 0.0 | 3 | 0 | `history/prune` |
| PASS | 0.0 | 5 | 1 | `inspect/list-scenes` |
| PASS | 0.0 | 5 | 3 | `inspect/list-tracks` |
| PASS | 0.0 | 5 | 1 | `inspect/scene-snapshot` |
| PASS | 0.0 | 3 | 0 | `inspect/track-snapshot` |
| PASS | 0.0 | 5 | 3 | `process/audio-chain` |
| PASS | 0.0 | 2 | 0 | `project/list-projects` |
| PASS | 0.0 | 7 | 3 | `render/export-wav` |
| PASS | 0.0 | 8 | 3 | `render/preview` |
| PASS | 0.0 | 10 | 4 | `render/to-performance` |
| PASS | 0.0 | 4 | 1 | `revise/darker-scene` |
| PASS | 0.0 | 8 | 1 | `sample/add-track` |
| PASS | 0.0 | 5 | 2 | `sample/import` |
| PASS | 0.0 | 6 | 3 | `scene/collapse` |
| PASS | 0.0 | 7 | 2 | `scene/duplicate-verse` |
| PASS | 0.0 | 6 | 2 | `scene/find-by-name` |
| PASS | 0.0 | 6 | 2 | `scene/get-bars` |
| PASS | 0.0 | 4 | 1 | `scene/happy-path-create` |
| PASS | 0.0 | 4 | 1 | `scene/missing-required-arg` |
| PASS | 0.0 | 10 | 4 | `scene/mute-bridge` |
| PASS | 0.0 | 4 | 1 | `scene/name-collision` |
| PASS | 0.0 | 8 | 3 | `scene/recovery-from-error` |
| ? | - | - | - | `scene/set-bars` |
| ? | - | - | - | `scene/switch-to-chorus` |
| ? | - | - | - | `scene/wrong-project-bound` |
| ? | - | - | - | `summarize/describe` |
| ? | - | - | - | `track/delete-bass` |
| ? | - | - | - | `track/lower-bass` |
| ? | - | - | - | `track/mute-kick` |
| ? | - | - | - | `track/pan-bass-left` |
| ? | - | - | - | `track/rename-track` |
| ? | - | - | - | `track/solo-bass` |
| ? | - | - | - | `transition/create` |
| ? | - | - | - | `transition/delete` |
| ? | - | - | - | `transport/get-bpm` |
| ? | - | - | - | `transport/play-on-cue` |
| ? | - | - | - | `transport/play` |
| ? | - | - | - | `transport/set-bpm` |
| ? | - | - | - | `transport/stop` |

## Failure summaries

### `diagnostic/check-surge-xt`
- **budget** — budget exceeded: errors 5 > budget 4

### `fx/load-chain`
- **toolCalled** — toolCalled did not match — agent never invoked a call that matches matches=/(load_fx_chain|RfxChain|chain)/
- **budget** — budget exceeded: errors 15 > budget 7

### `fx/random-fx`
- **budget** — budget exceeded: errors 7 > budget 5

### `generate/add-melody`
- **dbQuery** — dbQuery failed: expected at least 1 rows, got 0

### `history/checkpoint`
- **toolCalled** — toolCalled did not match — agent never invoked a call that matches contains="checkpoint"
- **budget** — budget exceeded: errors 6 > budget 4

### `history/undo`
- **dbQuery** — dbQuery failed: expected exactly 0 rows, got 1

### `inspect/musical-context`
- **toolCalled** — toolCalled did not match — agent never invoked a call that matches matches=/(musical_context|context|inspect|scene)/

### `inspect/project-snapshot`
- **budget** — budget exceeded: errors 15 > budget 3

### `make/bass-and-pads`
- **dbQuery** — dbQuery failed: expected at least 1 rows, got 0

### `musical-context/set-key`
- **toolCalled** — toolCalled did not match — agent never invoked a call that matches matches=/(musical_context|context|key)/

### `plan/apply`
- **toolCalled** — toolCalled did not match — agent never invoked a call that matches contains="apply"
- **dbQuery** — dbQuery failed: expected at least 1 rows, got 0
- **budget** — budget exceeded: errors 10 > budget 7

### `plan/build-plan`
- **toolCalled** — toolCalled did not match — agent never invoked a call that matches contains="plan"

### `plan/validate-plan`
- **budget** — budget exceeded: errors 10 > budget 6

### `preset/set-instrument`
- **budget** — budget exceeded: errors 12 > budget 6

### `project/status`
- **toolCalled** — toolCalled did not match — agent never invoked a call that matches matches=/(project|inspect|status)/

### `revise/busier-bass`
- **toolCalled** — toolCalled did not match — agent never invoked a call that matches contains="revise"

### `sample/fit-to-scene`
- **budget** — budget exceeded: errors 14 > budget 5

### `sample/search-samples`
- **budget** — budget exceeded: errors 5 > budget 3

### `scene/add-track`
- **toolCalled** — toolCalled did not match — agent never invoked a call that matches matches=/(add_track|move_track|scene)/
- **budget** — budget exceeded: errors 9 > budget 5

### `scene/delete-bridge`
- **dbQuery** — dbQuery failed: expected exactly 0 rows, got 1

### `scene/get-tracks-in-verse`
- **budget** — budget exceeded: errors 6 > budget 4

### `scene/move-track`
- **toolCalled** — toolCalled did not match — agent never invoked a call that matches matches=/(move_track|add_track)/

### `scene/queue`
- **toolCalled** — toolCalled did not match — agent never invoked a call that matches matches=/(queue|activate)/
- **budget** — budget exceeded: errors 5 > budget 4

