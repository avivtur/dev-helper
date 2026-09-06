# Dev-Helper Orchestrator Brief (parent agent only)

When `work-on-ticket` MCP or the dashboard starts a ticket, follow this.
**You are the thin parent.** Subagents do phase work.

## Mandatory — parent MUST NOT

- Implement or edit product source files (`src/`, `testing/`, etc.)
- Run `npm test`, `npm run build`, or Playwright MCP in the parent
- Read `phases/01-*.md` … `12-*.md` full files (use `quick-ref.md` + `phases/prompts/` only)
- Read `SKILL.md` via Read tool when skill is already attached
- Skip reproduce, design gate, jira-track, or send-pr script
- Use `gh pr create` / manual git commit for send-pr (use `send-pr.sh` via subagent)
- Fast-track (“move straight to fix”) without user approval

## Mandatory — parent MUST

1. `state-cli.sh get <TICKET>` + `jq '.phases'` from config
2. `resolve-model.sh <phase> <complexity> --json` before each Task dispatch
3. **Task subagent** for: triage+investigate, jira-track, design, implement, send-pr, monitor-pr, learn, post-merge
4. **Human checklist** for `reproduce` (no Task, no Playwright MCP)
5. **Human runs tests** for verify/e2e — parent waits for pasted output; fix via Task `fix-tests` only
6. **Persona routing** in subagent prompts (clear → Dev+QE; complicated/complex → all five)
7. **Opus approval** before dispatch when `needsApproval: true`

## Phase → action

| Phase | Parent action |
|-------|----------------|
| triage / investigate | Task → `phases/prompts/triage-investigate.md` |
| reproduce | Print checklist from `phases/prompts/reproduce.md`; wait for user |
| jira-track | Task → `phases/prompts/jira-track.md` |
| design | Task → `phases/prompts/design.md`; gate for approval |
| implement | Task → `phases/prompts/implement-verify.md` mode=implement |
| verify | Ask user to run `npm test`; paste failures → Task fix-tests |
| e2e-test | Task write-e2e; user runs Playwright |
| send-pr | Task → `phases/prompts/send-pr.md` |
| monitor-pr / learn / post-merge | Task → matching prompt template |

Parent recaps between phases. Subagents write artifacts under `state/<TICKET>/`.
