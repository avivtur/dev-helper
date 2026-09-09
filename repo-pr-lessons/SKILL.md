---
name: repo-pr-lessons
description: >-
  Batch-extract greppable lessons from merged PRs across the whole console
  plugin repo (not only your tickets). Use when the user says run repo pr
  lessons, learn from merged PRs, repo-pr-lessons, or catch up lessons since
  last run. Complements dev-helper Phase 11b when learn was skipped after
  manual merges.
---

# Repo PR Lessons

On-demand skill: scan **merged PRs** for the configured GitHub repo since a
checkpoint, propose lessons under `lessons/pending/`, wait for human review,
then append to theme files. Suggests frontend/backend analyzers when paths match.

Does **not** replace per-ticket learn (dev-helper P11b) or analyzer skills.

## Invoke

- `run repo pr lessons`
- `learn from merged PRs last 30 days`
- `repo-pr-lessons --since 5d`
- `approve lessons batch` / `reject lessons batch`

## Setup

```bash
# Lessons templates (if missing)
cp -r .cursor/skills/dev-helper/examples/lessons.example/ \
      .cursor/skills/dev-helper/lessons/
mkdir -p .cursor/skills/dev-helper/lessons/pending
```

Config via parent `dev-helper.config.json` (`github.repo`). Scripts source
`../scripts/_config.sh`.

## Orchestrator loop (parent stays thin)

1. Resolve `--since`:
   - User override (`5d`, `30d`, `1m`, `3m`, or `YYYY-MM-DD`)
   - Else `repo-pr-lessons/state.json` → `lastProcessedMergeAt`
   - Else run `scripts/bootstrap-since.sh` (latest date in `lessons/*.md`)
2. Run `scripts/list-merged-prs.sh --since <ISO-or-relative>` → JSON list.
3. Filter: keep PRs touching `src/`, `testing/`, `.cursor/rules/`, `locales/`;
   skip bot-only / pure chore with no those paths.
4. Batch PRs (e.g. 5 per Task). Dispatch **Task** subagents (`composer-2.5`
   default): for each PR, `gh pr view` / diff summary → propose 0–2 lesson
   bullets using [docs/LESSONS.md](../docs/LESSONS.md) schema.
5. For each candidate: `scripts/lessons-dedupe.sh` → `duplicate` (drop),
   `conflict` (include both sides for user), or `none` (include).
6. Write `lessons/pending/YYYY-MM-DD-batch.md`. **STOP for review.**
7. On `approve lessons batch`: append approved bullets to theme files; move
   conflicts per user decision; update `state.json` checkpoint; suggest analyzers.
8. On reject: update checkpoint anyway if user says skip window; do not append.

### Analyzer suggestions (after apply)

| Paths in batch | Suggest |
|----------------|---------|
| `src/` | Run **frontend-analyzer** (`analyze frontend` / incremental refresh) |
| `.cursor/rules/backend/` or backend PR links | Run **backend-analyzer** |

## State file

`repo-pr-lessons/state.json` (gitignored):

```json
{
  "lastRunAt": "2026-09-09T12:00:00Z",
  "lastProcessedMergeAt": "2026-09-08T18:00:00Z",
  "lastProcessedPrNumber": 2600
}
```

Copy shape from [state.example.json](state.example.json).

## Scripts

| Script | Role |
|--------|------|
| `scripts/list-merged-prs.sh` | Merged PRs since date |
| `scripts/bootstrap-since.sh` | First-run date from lessons bullets |
| `scripts/lessons-dedupe.sh` | duplicate / conflict / none |
| `../scripts/lessons-grep.sh` | Shared keyword search |

## Subagent prompt (paste into Task)

```
CRITICAL: Do NOT read SKILL.md, SETUP.md, AGENTS.md.

Extract 0–2 greppable lessons from these merged PRs for the forklift console
plugin. Schema (docs/LESSONS.md):
- [Theme] observed -> action -> why (MTV-XXXX or PR#N, YYYY-MM-DD)

Themes: Architecture, Implementation, UI patterns, Process, Security, Communication.
Skip trivial chore/CI-only with no durable lesson. Prefer process/UI/QE/i18n/
types pitfalls useful for future tickets.

PRs JSON:
{{PRS_JSON}}

Return:
summary:
- candidates: [ { theme, bullet, pr, dedupeHintKeywords: [] } ]
- pathsTouched: [src|testing|rules|locales|backend]
```

## Related

- [docs/LESSONS.md](../docs/LESSONS.md)
- Dev-helper P11b in [phases/quick-ref.md](../phases/quick-ref.md)
- frontend-analyzer / backend-analyzer skills in the project
