#!/usr/bin/env bash
set -euo pipefail

bundle="${TMPDIR:-/tmp}/eterno-fc-game-test.mjs"
node_modules/.bin/esbuild app/game.ts --bundle --platform=node --format=esm --log-level=warning --outfile="$bundle"
node scripts/verify-game-simulation.mjs "$bundle"
