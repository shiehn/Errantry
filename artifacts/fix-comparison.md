| scenario | before | turns | errs | → | after | turns | errs | delta |
| --- | --- | ---:| ---:| --- | --- | ---:| ---:| --- |
| `diagnostic/check-surge-xt` | FAIL | 8 | 5 | → | FAIL | 8 | 8 | — |
| `fx/load-chain` | FAIL | 14 | 15 | → | FAIL | 14 | 8 | — |
| `fx/random-fx` | FAIL | 10 | 7 | → | PASS | 10 | 5 | ✅ FIX |
| `generate/add-melody` | FAIL | 5 | 2 | → | FAIL | 6 | 2 | — |
| `history/checkpoint` | FAIL | 8 | 6 | → | FAIL | 7 | 5 | — |
| `history/undo` | FAIL | 6 | 2 | → | FAIL | 10 | 4 | — |
| `inspect/musical-context` | FAIL | 4 | 1 | → | FAIL | 3 | 0 | — |
| `inspect/project-snapshot` | FAIL | 2 | 15 | → | PASS | 2 | 2 | ✅ FIX |
| `musical-context/set-key` | FAIL | 8 | 3 | → | PASS | 8 | 4 | ✅ FIX |
| `plan/apply` | FAIL | 14 | 10 | → | FAIL | 14 | 10 | — |
| `plan/build-plan` | FAIL | 3 | 0 | → | FAIL | 3 | 0 | — |
| `plan/validate-plan` | FAIL | 12 | 10 | → | PASS | 5 | 5 | ✅ FIX |
| `preset/set-instrument` | FAIL | 12 | 12 | → | FAIL | 12 | 8 | — |
| `project/status` | FAIL | 1 | 0 | → | FAIL | 1 | 0 | — |
| `revise/busier-bass` | FAIL | 7 | 3 | → | FAIL | 12 | 9 | — |
| `sample/fit-to-scene` | FAIL | 10 | 14 | → | FAIL | 10 | 6 | — |
| `sample/search-samples` | FAIL | 6 | 5 | → | PASS | 3 | 0 | ✅ FIX |
| `scene/add-track` | FAIL | 10 | 9 | → | FAIL | 4 | 3 | — |
| `scene/delete-bridge` | FAIL | 9 | 3 | → | FAIL | 10 | 6 | — |
| `scene/get-tracks-in-verse` | FAIL | 8 | 6 | → | PASS | 8 | 4 | ✅ FIX |
| `scene/move-track` | FAIL | 12 | 6 | → | FAIL | 10 | 2 | — |

**Summary:** 6 fixed, 0 regressed, 15 unchanged (of 21 re-run).
