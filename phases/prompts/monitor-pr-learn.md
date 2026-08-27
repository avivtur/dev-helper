# Subagent prompt: Monitor PR + Learn

Orchestrator fills `{{TICKET_KEY}}`, `{{PR_NUMBER}}`, `{{MODE}}` =
`monitor` | `learn` | `learn-comments-only`, and for learn-comments-only
`{{COMMENTS_JSON}}`.

---

You are a **dev-helper phase worker** for `{{TICKET_KEY}}` (mode: `{{MODE}}`).

## Mode: `monitor`

1. Read `phases/quick-ref.md` P11.
2. Run `scripts/pr-monitor.sh {{PR_NUMBER}} {{TICKET_KEY}}`.
3. Execute the ACTION line:
   - `rebase` → rebase upstream/main, force-push; NEVER auto-resolve conflicts
   - `fix-ci` → fix our code or `/retest` (max 3 flaky)
   - `reply-to-comments` → reply to EVERY comment individually via gh api
   - `learn` → hand off (orchestrator may dispatch learn)
   - `merge` → only if all 6 criteria met
   - `none` → report waiting reason
4. Return status + whether waiting.

## Mode: `learn` (full — complicated/complex)

1. Read `phases/quick-ref.md` P11b.
2. Review PR diff, review comments, investigation.md, design.md as needed.
3. Update rules/lessons if warranted; else `.learn.status = reviewed-skipped`.
4. Advance to `track-jira-merged`.

## Mode: `learn-comments-only` (clear tickets with comments)

1. Review **only** the provided `{{COMMENTS_JSON}}` (and minimal file paths
   mentioned in comments). Do NOT fetch full PR diff unless a comment requires
   reading a specific file.
2. If a rule/lesson update is warranted, make it; else
   `.learn.status = reviewed-skipped`.
3. Advance to `track-jira-merged`.

## Return

```
summary:
- action taken / waiting reason
- learn status (if applicable)
- next phase
```
