#!/usr/bin/env bash
# List merged PRs since a date (YYYY-MM-DD or relative like 30d / 1m).
# Usage: list-merged-prs.sh --since <date|Nd|Nm>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/../../scripts/_config.sh"

SINCE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since) SINCE="${2:?}"; shift 2 ;;
    --json) shift ;;
    --plain) shift ;;
    -h|--help)
      echo "Usage: list-merged-prs.sh --since <YYYY-MM-DD|Nd|Nm>"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

[[ -n "$SINCE" ]] || { echo "ERROR: --since required" >&2; exit 1; }

if [[ "$SINCE" =~ ^([0-9]+)d$ ]]; then
  days="${BASH_REMATCH[1]}"
  SINCE=$(date -u -v-"${days}"d +%Y-%m-%d 2>/dev/null || date -u -d "${days} days ago" +%Y-%m-%d)
elif [[ "$SINCE" =~ ^([0-9]+)m$ ]]; then
  months="${BASH_REMATCH[1]}"
  SINCE=$(date -u -v-"${months}"m +%Y-%m-%d 2>/dev/null || date -u -d "${months} months ago" +%Y-%m-%d)
fi

raw=$(gh pr list --repo "$GH_REPO" --state merged --limit 200 \
  --json number,title,mergedAt,author,url)

echo "$raw" | jq --arg since "${SINCE}T00:00:00Z" \
  '[.[] | select(.mergedAt != null and .mergedAt >= $since)]'
