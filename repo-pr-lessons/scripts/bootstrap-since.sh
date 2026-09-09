#!/usr/bin/env bash
# Bootstrap --since date from latest (YYYY-MM-DD) in lessons/*.md bullets.
# Prints ISO date (YYYY-MM-DD) or empty if none found.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LESSONS_DIR="${SCRIPT_DIR}/../../lessons"

if [[ ! -d "$LESSONS_DIR" ]]; then
  exit 0
fi

# Match (MTV-1234, 2026-06-09) or (PR#2600, 2026-06-09)
latest=""
shopt -s nullglob
for f in "$LESSONS_DIR"/*.md; do
  while IFS= read -r date; do
    [[ -z "$date" ]] && continue
    if [[ -z "$latest" || "$date" > "$latest" ]]; then
      latest="$date"
    fi
  done < <(grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' "$f" 2>/dev/null || true)
done

echo -n "$latest"
