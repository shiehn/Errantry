#!/usr/bin/env bash
# Demonstrates the full pipeline against the bundled todo CLI without an LLM.
#
# Sets up an isolated working dir with the todo binary on PATH, provides a
# mock script that simulates an agent that read --help and added the task,
# runs the scenario, then verifies the resulting .todo.json.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKDIR="$(mktemp -d -t errantry-todo-XXXX)"
trap "rm -rf $WORKDIR" EXIT

# Wire the todo binary as `todo` on PATH inside the work dir.
ln -sf "$ROOT/scenarios/fixtures/todo-cli/todo.mjs" "$WORKDIR/todo"

# Mock script — what the agent "would have done" if it were behaving well.
cat > "$WORKDIR/mock-script.txt" <<'EOF'
./todo --help
./todo add "Buy milk"
EOF

# Run the scenario.
PATH="$WORKDIR:$PATH" node "$ROOT/packages/cli/dist/bin/errantry.js" run \
  "$ROOT/scenarios/todo/happy-path-add.yaml" \
  --cwd "$WORKDIR" \
  --mock "$WORKDIR/mock-script.txt"
