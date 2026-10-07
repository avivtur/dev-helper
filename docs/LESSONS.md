# Lessons

Local, grep-friendly notes that improve future tickets. Durable team truth
still lands in `.cursor/rules/` via learn / rule PRs.

## Setup

```bash
cp -r .cursor/skills/dev-helper/examples/lessons.example/ \
      .cursor/skills/dev-helper/lessons/
```

`lessons/` is gitignored. Theme files:

| File | Theme |
|------|--------|
| `architecture.md` | Design / blast radius |
| `implementation.md` | TS, hooks, tests, types |
| `ui-patterns.md` | PatternFly / UX |
| `process.md` | Workflow / gates |
| `security.md` | Secrets / auth |
| `communication.md` | Jira / PR comments |

Pending review queue (repo-pr-lessons): `lessons/pending/` (also gitignored).

## Entry schema (mandatory)

One bullet per lesson, under `## Lessons` (never under `## Superseded` until replaced):

```
- [Theme] Pattern observed -> What to do differently -> Why it matters (MTV-XXXX, YYYY-MM-DD)
```

Rules:

- **Theme** must match the file theme label (`Implementation`, `Architecture`, …).
- Use ` -> ` (space-arrow-space) between the three clauses.
- End with `(TICKET-or-PR, YYYY-MM-DD)`.
- Keep bullets short; do not paste large code blocks.
- Before appending: `scripts/lessons-grep.sh "<keywords>"` — skip duplicates;
  if a conflict exists, ask the user (or use `## Superseded`).

Optional tag for search (sparingly):

```
- [Implementation|tag:ova-casing] …
```

## Search

```bash
.cursor/skills/dev-helper/scripts/lessons-grep.sh "OVA" "casing"
```

Skips `## Superseded` sections. Max 20 hits. Used by investigate (P2),
**personal-reviewer** (Prior lessons in `gather-context.sh`), and
`repo-pr-lessons` dedupe.

## Who writes lessons

| Source | When |
|--------|------|
| **dev-helper P11b learn** | After your ticket/PR (often skipped if you merge manually) |
| **repo-pr-lessons** | On-demand batch from **all** merged repo PRs since checkpoint |
| **personal-reviewer** | **Read:** every review (`lessons-grep` via `gather-context.sh`). **Write:** after user corrects the proposed review before post, after self-review code fixes, or from external PR comments on post (see personal-reviewer SKILL § Learn from review) |

## Approve pending batch (repo-pr-lessons)

1. Review `lessons/pending/YYYY-MM-DD-batch.md` or `lessons/pending/review-<PR>-<date>.md`
   (personal-reviewer conflict queue)
2. Say `approve lessons batch` (or reject / revise)
3. Agent appends approved bullets to theme files and updates
   `repo-pr-lessons/state.json`

## Related

- [personal-reviewer/SKILL.md](../../personal-reviewer/SKILL.md) (read/write during PR review)
- [repo-pr-lessons/SKILL.md](../repo-pr-lessons/SKILL.md)
- [GOLD-EVAL.md](GOLD-EVAL.md)
- Phase P11b in [phases/quick-ref.md](../phases/quick-ref.md)
