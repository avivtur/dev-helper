# Prompt templates for phase subagents

The parent orchestrator (SKILL.md) fills placeholders and dispatches a Task
subagent with one of these templates. Each subagent starts with a **fresh**
context — inject only what that phase needs.

| File | Phase(s) | Runner |
|------|----------|--------|
| [triage-investigate.md](triage-investigate.md) | triage → investigate | Subagent |
| [reproduce.md](reproduce.md) | reproduce | **Human** (orchestrator prints checklist) |
| [jira-track.md](jira-track.md) | jira-track | Subagent |
| [design.md](design.md) | design | Subagent |
| [implement-verify.md](implement-verify.md) | implement / fix-tests / write-e2e | Subagent |
| [send-pr.md](send-pr.md) | send-pr | Subagent |
| [monitor-pr-learn.md](monitor-pr-learn.md) | monitor-pr / learn | Subagent |
| [post-merge.md](post-merge.md) | track-jira-merged | Subagent |

## Common placeholders

- `{{TICKET_KEY}}` — e.g. `MTV-5300`
- `{{COMPLEXITY}}` — `clear` | `complicated` | `complex`
- `{{PERSONAS}}` — bullet list of persona files to Read (orchestrator-routed)
- `{{MODE}}` — mode within a multi-mode template
- `{{PR_NUMBER}}`, `{{TEST_OUTPUT}}`, `{{COMMENTS_JSON}}` — as needed

## Persona injection examples

**clear:**
```
- Developer: .cursor/rules/agents/developer.mdc
- QE: .cursor/rules/agents/qe-agent.mdc
```

**complicated / complex:**
```
- Developer: .cursor/rules/agents/developer.mdc
- QE: .cursor/rules/agents/qe-agent.mdc
- Architect: .cursor/rules/agents/architect.mdc
- UX: .cursor/rules/agents/ux-reviewer.mdc
- Forklift Expert: .cursor/rules/agents/forklift-expert.mdc
```
