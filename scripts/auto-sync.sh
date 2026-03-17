#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# auto-sync.sh — watches the repo for file changes and auto-commits + pushes.
#
# Usage:
#   ./scripts/auto-sync.sh            # watch and push to current branch
#   ./scripts/auto-sync.sh main       # watch and push to 'main'
#
# Requires: inotifywait (inotify-tools), git, and an authenticated remote.
# Install on Fedora/RHEL:  sudo dnf install inotify-tools
# Install on Debian/Ubuntu: sudo apt install inotify-tools
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEBOUNCE_SECS=4          # wait this many idle seconds before committing
INOTIFY_POLL_SECS=2      # inotifywait timeout; controls responsiveness
BRANCH="${1:-$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"

# Patterns to ignore (ERE syntax passed to --exclude)
EXCLUDE_PATTERN='(\.git/|node_modules/|\.next/|__pycache__/|\.pyc$|\.pyo$|pgdata/)'

# ── Preflight checks ──────────────────────────────────────────────────────────
if ! command -v inotifywait &>/dev/null; then
  echo "[auto-sync] ERROR: inotifywait not found. Install inotify-tools." >&2
  exit 1
fi

if ! git -C "$REPO_DIR" remote get-url origin &>/dev/null; then
  echo "[auto-sync] ERROR: no 'origin' remote configured." >&2
  exit 1
fi

# ── Main loop ─────────────────────────────────────────────────────────────────
echo "[auto-sync] Watching $REPO_DIR  →  origin/$BRANCH"
echo "[auto-sync] Debounce: ${DEBOUNCE_SECS}s  |  Press Ctrl+C to stop"
echo

last_change=0

while true; do
  # Block for up to INOTIFY_POLL_SECS; exit 0 = event received, 2 = timeout
  if inotifywait -r -q \
      -t "$INOTIFY_POLL_SECS" \
      -e modify,create,delete,move \
      --exclude "$EXCLUDE_PATTERN" \
      "$REPO_DIR" 2>/dev/null; then
    last_change=$(date +%s)
  fi

  # Nothing pending
  [[ $last_change -eq 0 ]] && continue

  now=$(date +%s)
  elapsed=$(( now - last_change ))
  [[ $elapsed -lt $DEBOUNCE_SECS ]] && continue

  # Debounce window expired — commit and push
  last_change=0

  git -C "$REPO_DIR" add -A

  if git -C "$REPO_DIR" diff --staged --quiet; then
    continue  # Nothing to commit
  fi

  ts="$(date '+%Y-%m-%dT%H:%M:%S')"
  git -C "$REPO_DIR" commit -m "auto: $ts"
  git -C "$REPO_DIR" push origin "$BRANCH"
  echo "[auto-sync] ✓ Pushed at $ts"
done
# auto-sync workflow
