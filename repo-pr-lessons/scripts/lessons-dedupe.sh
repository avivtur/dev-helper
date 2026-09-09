#!/usr/bin/env bash
# Classify a proposed lesson bullet against existing lessons.
# Usage: lessons-dedupe.sh "<proposed bullet text>"
# Prints: STATUS|matching lines
# STATUS = duplicate | conflict | none
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREP="${SCRIPT_DIR}/../../scripts/lessons-grep.sh"
PROPOSED="${1:-}"

if [[ -z "$PROPOSED" ]]; then
  echo "Usage: lessons-dedupe.sh \"<proposed bullet>\"" >&2
  exit 1
fi

# Extract keywords: Theme tag + significant words from observed clause
theme=$(echo "$PROPOSED" | grep -oE '\[[^]|]+' | head -1 | tr -d '[' || true)
observed=$(echo "$PROPOSED" | sed -n 's/.*][[:space:]]*\(.*\)[[:space:]]*->.*/\1/p' | head -1)
# Take up to 4 words longer than 3 chars from observed
keywords=$(echo "$observed $theme" | tr '[:upper:]' '[:lower:]' | grep -oE '[a-z0-9-]{4,}' | head -6 | tr '\n' ' ')

if [[ -z "${keywords// /}" ]]; then
  echo "none|"
  exit 0
fi

# shellcheck disable=SC2086
hits=$("$GREP" $keywords 2>/dev/null || true)

if [[ "$hits" == *"(no matching lessons)"* ]] || [[ "$hits" == *"(no lessons/"* ]] || [[ -z "$hits" ]]; then
  echo "none|"
  exit 0
fi

# Duplicate: high overlap of observed phrase (first 40 chars of observed)
needle=$(echo "$observed" | tr '[:upper:]' '[:lower:]' | cut -c1-40)
if echo "$hits" | tr '[:upper:]' '[:lower:]' | grep -qF "$needle" && [[ ${#needle} -ge 12 ]]; then
  echo "duplicate|${hits}"
  exit 0
fi

# Same theme + overlapping keywords but different action → conflict
echo "conflict|${hits}"
exit 0
