# Phase 5: Jira Track

> **Project rules:** If `.cursor/skills/dev-helper/phases-rules/05-jira-track.md`
> exists, read it first — it contains project-specific instructions for this phase.


**Gate:** Auto-recap (present what was set, continue)

Sets Jira fields that require investigation context: story points, sprint, fix
version. Transitions Stories/Tasks to In Progress; Bug tickets stay at ASSIGNED
since their status progression is tied to PR lifecycle (POST at PR creation,
MODIFIED at merge).

---

## Prerequisites

- Investigation complete (Phase 2)
- Reproduction complete for bugs (Phase 4)
- Agent has full understanding of the work scope

## Steps

### 5.1 Transition to In Progress (Stories and Tasks only)

Transition behavior depends on ticket type:

**Bug tickets — skip status change:**
Bugs follow the Bugzilla-style lifecycle: ASSIGNED → POST (PR created) →
MODIFIED (PR merged). At this phase the bug is correctly at ASSIGNED, which
already communicates "being worked on". Do not change the status here.

**Story/Task tickets — transition to In Progress:**

```bash
TYPE=$(.cursor/skills/dev-helper/scripts/state-cli.sh field ${TICKET_KEY} '.type')

if [[ "$TYPE" != "Bug" && "$TYPE" != "Epic" ]]; then
  .cursor/skills/dev-helper/scripts/jira-transition.sh ${TICKET_KEY} "In Progress"
  echo "Transitioned ${TICKET_KEY} to In Progress"
else
  echo "Bug/Epic: skipping In Progress transition (managed by PR lifecycle)"
fi
```

**WARNING:** Do NOT use POST here. POST is reserved for Phase 10 (Send PR).

### 5.2 Calculate and set story points

Based on investigation findings and reproduction results, estimate the work:

| Points | Duration | Complexity |
|--------|----------|------------|
| 2 (XS) | Hours to half a day | Trivial change |
| 5 (S) | 1-2 days | Simple, clear criteria |
| 8 (M) | 2-4 days | Some research, moderate complexity |
| 13 (L) | 4-7 days | Complex, new area, significant research |
| 21 (XL) | >1 week | Should have been broken into smaller tasks |

Consider: number of affected files, investigation depth, design complexity,
testing requirements, and whether backend changes are involved.

```bash
.cursor/skills/dev-helper/scripts/jira-track.sh set-story-points ${TICKET_KEY} <POINTS>
```

### 5.3 Determine and set sprint

```bash
.cursor/skills/dev-helper/scripts/sprint-lookup.sh
```

The script recommends active or next sprint based on capacity and timing.
Present the recommendation and attach the ticket.

### 5.4 Set fix version

```bash
FIX_VERSION=$(grep '^RVERSION=' build/release.conf | cut -d= -f2)
.cursor/skills/dev-helper/scripts/jira-track.sh set-fix-version ${TICKET_KEY} "${FIX_VERSION}"
```

### 5.5 Transition parent Epic (stories only)

If the ticket is a Story and has a parent Epic, check if the Epic is In Progress.
If not, transition it:

```bash
source .cursor/skills/dev-helper/scripts/_config.sh
source ~/.jira-creds

if [[ "$TYPE" == "Story" ]]; then
  PARENT_KEY=$(curl -s -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
    "${JIRA_BASE_URL}/rest/api/2/issue/${TICKET_KEY}?fields=parent" \
    | jq -r '.fields.parent.key // empty')

  if [[ -n "$PARENT_KEY" ]]; then
    EPIC_STATUS=$(curl -s -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
      "${JIRA_BASE_URL}/rest/api/2/issue/${PARENT_KEY}?fields=status" \
      | jq -r '.fields.status.name')

    if [[ "$EPIC_STATUS" != "In Progress" && "$EPIC_STATUS" != "POST" ]]; then
      .cursor/skills/dev-helper/scripts/jira-transition.sh "${PARENT_KEY}" "In Progress" 2>/dev/null || true
      echo "Transitioned parent Epic ${PARENT_KEY} to In Progress"
    else
      echo "Parent Epic ${PARENT_KEY} already at ${EPIC_STATUS} — skipping"
    fi
  fi
fi
```

### 5.6 Recap and advance

Present a summary of what was set:

```text
## Jira Tracking: ${TICKET_KEY}

**Status:** ASSIGNED (Bug) / In Progress (Story/Task)
**Story Points:** <points>
**Sprint:** <sprint name>
**Fix Version:** <version>
```

Advance to next phase. If fast-tracking (design was skipped) AND design is NOT
gated, go directly to implement. **Gates always take precedence over fast-track.**

```bash
SKIPPED=$(.cursor/skills/dev-helper/scripts/state-cli.sh field ${TICKET_KEY} '.skippedPhases // [] | join(",")')
GATES=$(jq -r '.phases.gates // [] | join(",")' .cursor/skills/dev-helper/dev-helper.config.json)

if [[ "$SKIPPED" == *"design"* && "$GATES" != *"design"* ]]; then
  # Fast-track AND design is not gated -- skip to implement
  .cursor/skills/dev-helper/scripts/state-cli.sh phase ${TICKET_KEY} implement
else
  # Design is gated or not skipped -- always run design
  .cursor/skills/dev-helper/scripts/state-cli.sh phase ${TICKET_KEY} design
fi
```

## Completion Checklist

No hard validation for this phase -- the Jira fields are set via
`jira-track.sh` commands. Verify these were called:

- [ ] Story points set (`jira-track.sh set-story-points`)
- [ ] Sprint assigned (`sprint-lookup.sh`)
- [ ] Fix version set (`jira-track.sh set-fix-version`)
- [ ] Jira status: Bug stays at ASSIGNED; Story/Task transitioned to In Progress
- [ ] Parent Epic transitioned to In Progress if this is a Story (step 5.5)

**IMPORTANT:** Do NOT transition to POST here. POST happens in Phase 10 (Send PR).
Bugs stay at ASSIGNED until the PR is created.
