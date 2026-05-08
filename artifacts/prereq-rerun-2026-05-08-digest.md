# Prereq-graph exposure rerun — 4 of 12 fixed

Compares 12 multi-step / prereq-relevant scenarios from sweep3 before/after the dependency-graph CLI exposure (commits 92764743, 872278c3, c4262329).

| scenario | sweep3 | prereq-rerun | Δ |
| --- | --- | --- | --- |
| `fx/get-track-fx` | FAIL (8/6) | FAIL (8/7) | no change |
| `fx/load-chain` | FAIL (14/11) | FAIL (14/12) | no change |
| `plan/apply` | FAIL (12/8) | FAIL (14/8) | no change |
| `plan/validate-plan` | FAIL (12/10) | PASS (4/4) | ✅ FIX |
| `preset/set-instrument` | FAIL (12/6) | PASS (10/5) | ✅ FIX |
| `process/audio-chain` | FAIL (8/9) | FAIL (8/12) | no change |
| `scene/delete-bridge` | FAIL (10/5) | FAIL (10/6) | no change |
| `scene/set-bars` | FAIL (8/4) | FAIL (8/4) | no change |
| `track/delete-bass` | FAIL (5/1) | FAIL (5/1) | no change |
| `track/mute-kick` | FAIL (10/9) | PASS (10/5) | ✅ FIX |
| `track/pan-bass-left` | FAIL (10/12) | PASS (5/1) | ✅ FIX |
| `track/rename-track` | FAIL (10/6) | FAIL (10/6) | no change |

**FIX: 4, REGRESS: 0** — every flip went the right direction.
