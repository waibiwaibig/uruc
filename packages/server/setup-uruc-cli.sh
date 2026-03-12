#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
WRAPPER_PATH="$ROOT_DIR/uruc"
GLOBAL_LINK="/usr/local/bin/uruc"

cd "$ROOT_DIR"

echo "[uruc-cli] installing workspace dependencies"
npm install --ignore-scripts --no-audit --no-fund

echo "[uruc-cli] verifying repo-local wrapper"
./uruc help >/dev/null

if [ -w "$(dirname "$GLOBAL_LINK")" ]; then
  ln -sf "$WRAPPER_PATH" "$GLOBAL_LINK"
  echo "[uruc-cli] installed global command: $GLOBAL_LINK"
elif [ "$(id -u)" -eq 0 ]; then
  ln -sf "$WRAPPER_PATH" "$GLOBAL_LINK"
  echo "[uruc-cli] installed global command: $GLOBAL_LINK"
else
  echo "[uruc-cli] global install skipped (no permission for $GLOBAL_LINK)"
fi

echo ""
echo "[uruc-cli] ready. You can now use either:"
echo "  ./uruc configure"
echo "  npm run uruc -- configure"
if [ -x "$GLOBAL_LINK" ]; then
  echo "  uruc configure"
fi
