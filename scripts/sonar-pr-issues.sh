#!/usr/bin/env bash
set -euo pipefail

PR="${1:?Usage: sonar-pr-issues.sh <PR_NUMBER>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# SONAR_PROJECT_KEY from env overrides config
source "$SCRIPT_DIR/_config.sh"
SONAR_PROJECT_KEY="${SONAR_PROJECT_KEY:-$SONAR_PROJECT_KEY_CONFIG}"
if [[ -z "$SONAR_PROJECT_KEY" ]]; then
  echo "ERROR: Set sonar.projectKey in dev-helper.config.json or export SONAR_PROJECT_KEY" >&2
  exit 1
fi

PS="${SONAR_ISSUES_PAGE_SIZE:-50}"

query_url="https://sonarcloud.io/api/issues/search?pullRequest=${PR}&componentKeys=${SONAR_PROJECT_KEY}&resolved=false&ps=${PS}"
response=$(curl -fsS "$query_url")
total=$(echo "$response" | jq -r '.total // 0')

dashboard_url="https://sonarcloud.io/project/issues?pullRequest=${PR}&resolved=false&id=${SONAR_PROJECT_KEY}"

echo "--- SonarCloud open issues (PR #${PR}) ---"
echo "Project: ${SONAR_PROJECT_KEY} | Total open: ${total}"
echo "Dashboard: ${dashboard_url}"
echo ""

if [[ "$total" == "0" ]]; then
  echo "(no open issues returned by API — check may still be red until analysis finishes)"
  exit 0
fi

echo "$response" | jq -r '.issues[] |
  "[\(.severity)] \(.component | split(":")[1] // .component):\(.line // "?") | \(.rule) | \(.message)"'
