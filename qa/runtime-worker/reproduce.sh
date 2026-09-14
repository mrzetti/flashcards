#!/usr/bin/env bash
# Re-run the deployed-site runtime verification for the seven cards.
#
# Requirements: node + the playwright package installed in qa/node_modules
# (Playwright 1.58.2, Chromium in /root/.cache/ms-playwright).
#
# Usage:
#   ./reproduce.sh              # all seven cards
#   ./reproduce.sh 2009-lifad   # one card
set -euo pipefail
cd "$(dirname "$0")"

CARDS=(
  2003-lichtspielhaus
  2004-reise-reise
  2005-keine-lust
  2005-mann-gegen-mann
  2005-rosenrot
  2006-voelkerball
  2009-lifad
)

if [[ $# -gt 0 ]]; then
  node verify-cards.cjs --cards "$(IFS=,; echo "$*")"
else
  node verify-cards.cjs --cards "$(IFS=,; echo "${CARDS[*]}")"
fi

# Optional per-card targets that were validated manually (uncomment to rerun):
# node targeted-click.cjs --card 2009-lifad --fx 0.88 --fy 0.92 --label zur-website --settle 25000

python3 analyze-runs.py
echo "Artifacts: $(pwd)/out/<card>/ (run.json, screenshots, contact-sheet.png)"
