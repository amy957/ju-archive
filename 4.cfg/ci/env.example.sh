#!/usr/bin/env sh
# ============================================================================
# JU reproducible environment bootstrap  (Release path B / stage S1 / OP-12)
# POSIX variant for *nix runners / dev boxes.  SOURCE it (not execute) so the
# exports persist in the current shell:
#
#   $ . "8.发布与CI/ci/env.example.sh"
#   $ cd "6.P0-T3基线/step9"
#   $ node scripts/verify.js all
#
# Requires : node on PATH, and JU_CHROMIUM_PATH pointing at a Chrome/Chromium
#            binary (no bundled browser cache in this repo).
# Safety   : READ-ONLY. Exports only; writes no file. The current baseline is
#            recorded in 1.冻结版本/HEAD.json; this script never embeds product
#            bytes or any user-specific path.
# ============================================================================

# node must be resolvable as a bare `node` (verify.js spawns it).
if ! command -v node >/dev/null 2>&1; then
  if [ -n "${JU_NODE_DIR:-}" ] && [ -x "${JU_NODE_DIR}/node" ]; then
    PATH="${JU_NODE_DIR}:${PATH}"; export PATH
  else
    echo "Error: node not found on PATH and JU_NODE_DIR is unset/invalid (refusing to continue)." >&2
    return 1
  fi
fi

# Electron-provided node must run in plain Node mode.
export ELECTRON_RUN_AS_NODE=1

# Resolve Chromium for Playwright / bench.
if [ -z "${JU_CHROMIUM_PATH:-}" ]; then
  for c in \
    /usr/bin/google-chrome /usr/bin/chromium /usr/bin/chromium-browser \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
    if [ -x "$c" ]; then JU_CHROMIUM_PATH="$c"; break; fi
  done
fi
if [ -z "${JU_CHROMIUM_PATH:-}" ]; then
  echo "Error: JU_CHROMIUM_PATH is unset and no Chrome/Chromium binary was auto-detected (refusing to continue)." >&2
  return 1
fi
export JU_CHROMIUM_PATH

# Deterministic, machine-readable output.
export NO_COLOR=1

# Derive JU_APP_URL from the repo root (this file lives in <root>/8.*/ci/).
JU_CI_DIR=$(cd "$(dirname "$0")" && pwd)
JU_REPO_ROOT=$(cd "${JU_CI_DIR}/../.." && pwd)
JU_APP_FILE=$(ls "${JU_REPO_ROOT}"/6.*/step9/v2.0-t3.html 2>/dev/null | head -n 1)
# Fail fast: never continue with an empty JU_APP_URL (it would surface later as
# confusing test failures instead of a clear bootstrap error).
if [ -z "${JU_APP_FILE:-}" ] || [ ! -f "${JU_APP_FILE}" ]; then
  echo "Error: app artifact not found: ${JU_REPO_ROOT}/6.*/step9/v2.0-t3.html (refusing to continue with empty JU_APP_URL)." >&2
  return 1
fi
export JU_APP_URL="file://${JU_APP_FILE}"

echo "JU_ENV_NODE=$(command -v node)"
echo "JU_ENV_CHROMIUM_PATH=${JU_CHROMIUM_PATH}"
echo "JU_ENV_ELECTRON_RUN_AS_NODE=${ELECTRON_RUN_AS_NODE}"
echo "JU_ENV_JU_APP_URL=${JU_APP_URL:-}"
echo "JU_ENV_READY=1"
