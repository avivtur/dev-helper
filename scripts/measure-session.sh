#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: measure-session.sh <transcript.jsonl> [--json]

Analyzes a dev-helper agent transcript and outputs metrics.
Use --json for machine-readable output.

Batch mode:
  measure-session.sh --batch <dir> [--json]
  Scans all dev-helper transcripts in <dir> and outputs aggregate stats.
USAGE
  exit 1
}

JSON_OUTPUT=false
BATCH_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) JSON_OUTPUT=true; shift ;;
    --batch) BATCH_MODE=true; shift; BATCH_DIR="${1:?Missing directory}"; shift ;;
    -h|--help) usage ;;
    *) TRANSCRIPT="$1"; shift ;;
  esac
done

analyze_transcript() {
  local file="$1"
  local uuid
  uuid=$(basename "$file" .jsonl)

  [[ -f "$file" ]] || { echo "ERROR: File not found: $file" >&2; return 1; }

  local size_bytes size_human lines
  size_bytes=$(wc -c < "$file" | tr -d ' ')
  size_human=$(du -h "$file" | cut -f1 | tr -d ' ')
  lines=$(wc -l < "$file" | tr -d ' ')

  local skill_reads phase_reads rule_reads shell_calls jira_calls
  skill_reads=$(rg -c 'dev-helper/SKILL\.md' "$file" 2>/dev/null || echo 0)
  phase_reads=$(rg -c 'phases/[0-9]' "$file" 2>/dev/null || echo 0)
  rule_reads=$(rg -c '\.cursor/rules/' "$file" 2>/dev/null || echo 0)
  shell_calls=$(rg -c '"Shell"' "$file" 2>/dev/null || echo 0)
  jira_calls=$(rg -c 'atlassian\.net' "$file" 2>/dev/null || echo 0)

  local tickets phases
  tickets=$(rg -o 'MTV-[0-9]{4,}' "$file" 2>/dev/null | sort -u | tr '\n' ' ' | sed 's/ $//')
  phases=$(rg -o 'state-cli\.sh phase[^"\\]*MTV-[0-9]+ [a-z-]+' "$file" 2>/dev/null \
    | rg -o '[a-z-]+$' | awk '!seen[$0]++' | tr '\n' ' → ' | sed 's/ → $//')

  if [[ "$JSON_OUTPUT" == "true" ]]; then
    jq -n \
      --arg uuid "$uuid" \
      --arg size "$size_human" \
      --argjson sizeBytes "$size_bytes" \
      --argjson lines "$lines" \
      --argjson skillReads "$skill_reads" \
      --argjson phaseReads "$phase_reads" \
      --argjson ruleReads "$rule_reads" \
      --argjson shellCalls "$shell_calls" \
      --argjson jiraCalls "$jira_calls" \
      --arg tickets "$tickets" \
      --arg phases "$phases" \
      '{session: $uuid, size: $size, sizeBytes: $sizeBytes, lines: $lines,
        skillReads: $skillReads, phaseReads: $phaseReads, ruleReads: $ruleReads,
        shellCalls: $shellCalls, jiraCalls: $jiraCalls,
        tickets: $tickets, phases: $phases}'
  else
    echo "Session: ${uuid}"
    echo "Ticket: ${tickets:-none}"
    echo "Size: ${size_human} (${size_bytes} bytes)"
    echo "Lines: ${lines}"
    echo "SKILL.md reads: ${skill_reads}"
    echo "Phase file reads: ${phase_reads}"
    echo "Rule file reads: ${rule_reads}"
    echo "Shell calls: ${shell_calls}"
    echo "Jira API calls: ${jira_calls}"
    echo "Phases: ${phases:-none}"
    echo "---"
  fi
}

if [[ "$BATCH_MODE" == "true" ]]; then
  [[ -d "$BATCH_DIR" ]] || { echo "ERROR: Not a directory: $BATCH_DIR" >&2; exit 1; }

  results=()
  count=0
  total_size=0
  total_skill=0
  total_phase=0
  total_rule=0
  total_shell=0
  total_jira=0

  for dir in "$BATCH_DIR"/*/; do
    uuid=$(basename "$dir")
    f="${dir}${uuid}.jsonl"
    [[ -f "$f" ]] || continue
    rg -q 'dev-helper/SKILL\.md' "$f" 2>/dev/null || continue

    if [[ "$JSON_OUTPUT" == "true" ]]; then
      result=$(analyze_transcript "$f")
      results+=("$result")
    else
      analyze_transcript "$f"
    fi

    size_bytes=$(wc -c < "$f" | tr -d ' ')
    total_size=$((total_size + size_bytes))
    total_skill=$((total_skill + $(rg -c 'dev-helper/SKILL\.md' "$f" 2>/dev/null || echo 0)))
    total_phase=$((total_phase + $(rg -c 'phases/[0-9]' "$f" 2>/dev/null || echo 0)))
    total_rule=$((total_rule + $(rg -c '\.cursor/rules/' "$f" 2>/dev/null || echo 0)))
    total_shell=$((total_shell + $(rg -c '"Shell"' "$f" 2>/dev/null || echo 0)))
    total_jira=$((total_jira + $(rg -c 'atlassian\.net' "$f" 2>/dev/null || echo 0)))
    count=$((count + 1))
  done

  if [[ "$JSON_OUTPUT" == "true" ]]; then
    printf '%s\n' "${results[@]}" | jq -s --argjson count "$count" \
      --argjson totalSize "$total_size" \
      --argjson totalSkill "$total_skill" \
      --argjson totalPhase "$total_phase" \
      --argjson totalRule "$total_rule" \
      --argjson totalShell "$total_shell" \
      --argjson totalJira "$total_jira" \
      '{summary: {sessions: $count, totalSizeBytes: $totalSize,
        avgSkillReads: (if $count > 0 then ($totalSkill / $count | . * 10 | round / 10) else 0 end),
        avgPhaseReads: (if $count > 0 then ($totalPhase / $count | . * 10 | round / 10) else 0 end),
        avgRuleReads: (if $count > 0 then ($totalRule / $count | . * 10 | round / 10) else 0 end),
        avgShellCalls: (if $count > 0 then ($totalShell / $count | . * 10 | round / 10) else 0 end),
        avgJiraCalls: (if $count > 0 then ($totalJira / $count | . * 10 | round / 10) else 0 end)},
       sessions: .}'
  else
    echo "=== BASELINE SUMMARY ==="
    echo "Sessions analyzed: ${count}"
    echo "Total size: $((total_size / 1024)) KB"
    if [[ "$count" -gt 0 ]]; then
      echo "Avg SKILL.md reads: $((total_skill / count))"
      echo "Avg phase file reads: $((total_phase / count))"
      echo "Avg rule file reads: $((total_rule / count))"
      echo "Avg shell calls: $((total_shell / count))"
      echo "Avg Jira API calls: $((total_jira / count))"
    fi
  fi
else
  [[ -n "${TRANSCRIPT:-}" ]] || usage
  analyze_transcript "$TRANSCRIPT"
fi
