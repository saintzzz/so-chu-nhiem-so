#!/usr/bin/env bash
# preflight.sh - deterministic gate for a project. Runs whatever checks the
# stack actually has; fails loudly. This is the "deterministic layer" behind
# the conventions - skills advise, this enforces.
#
# Install once per project (bootstrap-harness.sh copies it):
#   scripts/preflight.sh             # full check
#   scripts/preflight.sh --staged    # secrets scan limited to staged diff (pre-commit)
#
# Checks (skips cleanly when the tool/script doesn't exist):
#   node:  npm run typecheck | lint | build | test  (whichever exist)
#   py:    pytest / mypy / ruff (whichever installed + configured)
#   go:    go vet + go build
#   secrets: staged diff or src/ scan for key/token patterns
#   sdlc:  if docs/INTENT.md exists, docs/MEMORY.md must also exist

set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
STAGED=0; [ "${1:-}" = "--staged" ] && STAGED=1
fail=0
run() { echo "-- $*"; "$@" >/dev/null 2>&1 && echo "   ok" || { echo "   FAIL"; fail=1; }; }
has_script() { [ -f package.json ] && grep -q "\"$1\"" package.json; }

# --- secrets scan (always) ---
echo "-- secrets scan"
if [ "$STAGED" -eq 1 ]; then
  # exclude preflight.sh itself - the script literally contains the secret
  # patterns, so staging it self-matches (first bootstrap commit always hit
  # this). Pathspec-exclude mirrors the --exclude on the src-scan path.
  DIFF="$(git diff --cached -U0 -- . ':(exclude)scripts/preflight.sh' ':(exclude)scripts/check-package.mjs' ':(exclude)evals/' 2>/dev/null || true)"
else
  # Scan tracked files only - the working tree can hold gitignored local
  # material (secret backups, scratch dirs) that must never reach git anyway.
  DIFF="$(git ls-files -z 2>/dev/null | xargs -0 grep -InE 'sk-[a-zA-Z0-9_-]{20,}|sk-ant-[a-zA-Z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|github_pat_[0-9A-Za-z_]{20,}|-----BEGIN .*PRIVATE KEY' 2>/dev/null \
    | grep -vE '^(preflight\.sh|scripts/preflight\.sh|scripts/check-package\.mjs|check-package\.mjs):' || true)"
fi
if [ -n "$DIFF" ] && echo "$DIFF" | grep -qE 'sk-[a-zA-Z0-9_-]{20,}|sk-ant-|AIza|github_pat_|BEGIN .*PRIVATE KEY'; then
  echo "   FAIL - possible secret in code/diff:"; echo "$DIFF" | grep -oE '^[^:]+' | sort -u | head -5
  fail=1
else
  echo "   ok"
fi

# --- SDLC artifact check ---
if [ -f docs/INTENT.md ] && [ ! -f docs/MEMORY.md ]; then
  echo "-- sdlc: docs/INTENT.md exists but docs/MEMORY.md missing (see templates/MEMORY.md)"; fail=1
fi

# --- node ---
if [ -f package.json ] && [ -d node_modules ]; then
  for s in typecheck lint build test; do
    has_script "$s" && run npm run "$s" --if-present --silent
  done
  # dependency vuln scan (CR-2026-01 WS-1): prod deps only - dev-dep CVEs do
  # not ship to users and would drown the signal.
  if [ -f package-lock.json ]; then
    run npm audit --omit=dev --audit-level=high
  elif [ -f pnpm-lock.yaml ]; then
    run pnpm audit --prod --audit-level=high
  elif [ -f yarn.lock ] || [ -f bun.lockb ]; then
    echo "-- dep audit skipped: yarn/bun lockfile - run 'osv-scanner' manually or migrate lockfile"
  fi
fi

# --- RTM gate (CR-2026-01 WS-1): every AC-x.y declared in docs/ must appear
# in at least one test file. check-rtm.mjs skips cleanly pre-BA.
if [ -f scripts/check-rtm.mjs ]; then
  run node scripts/check-rtm.mjs
fi

# --- post-deploy headers (CR-2026-01 WS-4): only when a live URL is provided
# via DEPLOY_URL - preflight itself runs on source, not a deployment.
if [ -n "${DEPLOY_URL:-}" ] && [ -f scripts/check-headers.mjs ]; then
  run node scripts/check-headers.mjs "$DEPLOY_URL"
fi

# --- python ---
if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  command -v ruff >/dev/null && run ruff check .
  { [ -d tests ] || ls test_*.py >/dev/null 2>&1; } && command -v pytest >/dev/null && run pytest -x -q
fi

# --- go ---
if [ -f go.mod ]; then
  run go vet ./...
  run go build ./...
fi

# --- reliability gate (reliability classes: unchecked-read, unbounded-read,
# action-loss, cas-transition). Neu project co scripts/check-reliability.mjs
# thi day la check bat buoc - khong duoc skip.
if [ -f scripts/check-reliability.mjs ]; then
  run node scripts/check-reliability.mjs
  # scanner self-test (fixtures): .selftest.mjs so vitest/jest do not
  # auto-pick it - node --test runs it by explicit path only.
  if [ -f tests/reliability-scanner.selftest.mjs ]; then
    run node --test tests/reliability-scanner.selftest.mjs
  fi
fi

# --- repo laws (copy/keys/migrations/logging) - slideforge r2/r3 laws.
if [ -f scripts/check-repo-laws.mjs ]; then
  run node scripts/check-repo-laws.mjs
fi

# --- vercel.json lint (CR-2026-03): skips cleanly on non-Vercel projects.
# Secrets/invalid config FAIL; Pro-capability gaps are warnings.
if [ -f scripts/check-vercel-config.mjs ]; then
  run node scripts/check-vercel-config.mjs
fi

# --- spec lint (CR-2026-05): skips cleanly when docs/ has no PRD/SRS/spec
# artifacts. Number-less NFRs and vague terms FAIL; open markers WARN.
if [ -f scripts/check-spec.mjs ]; then
  run node scripts/check-spec.mjs
fi

# --- uiux source lint (CR-2026-06): grep-able web-interface-guidelines
# subset + AI-slop tells. Skips cleanly on non-UI repos.
if [ -f scripts/check-uiux.mjs ]; then
  run node scripts/check-uiux.mjs
fi

echo "== preflight: $([ "$fail" -eq 0 ] && echo PASS || echo FAIL) =="
exit $fail
