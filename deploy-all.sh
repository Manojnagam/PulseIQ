#!/bin/sh
ROOT="$(git rev-parse --show-toplevel)"

echo "Deploying all Vercel projects..."

(cd "$ROOT"          && npx vercel --prod --yes 2>&1 | grep -E "Aliased|Error|READY" | sed 's/^/  [app]      /') &
(cd "$ROOT/pulsezen" && npx vercel --prod --yes 2>&1 | grep -E "Aliased|Error|READY" | sed 's/^/  [pulsezen] /') &
(cd "$ROOT/coaches"  && npx vercel --prod --yes 2>&1 | grep -E "Aliased|Error|READY" | sed 's/^/  [coaches]  /') &
(cd "$ROOT/clients"  && npx vercel --prod --yes 2>&1 | grep -E "Aliased|Error|READY" | sed 's/^/  [clients]  /') &
(cd "$ROOT/dharanis" && npx vercel --prod --yes 2>&1 | grep -E "Aliased|Error|READY" | sed 's/^/  [dharanis] /') &
(cd "$ROOT/bksprime" && npx vercel --prod --yes 2>&1 | grep -E "Aliased|Error|READY" | sed 's/^/  [bksprime] /') &

wait
echo "Done."
