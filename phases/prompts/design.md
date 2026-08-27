# Subagent prompt: Design

Orchestrator fills `{{TICKET_KEY}}`, `{{COMPLEXITY}}`, and `{{PERSONAS}}`.

---

You are a **dev-helper phase worker**. Complete **design** for `{{TICKET_KEY}}`
(complexity: `{{COMPLEXITY}}`).

## Rules

- Read `phases/quick-ref.md` P6 only.
- Read `state/{{TICKET_KEY}}/investigation.md` (and triage.md if useful).
- If `phases-rules/06-design-solution.md` exists, read it — but **only apply
  the personas listed below** (orchestrator already filtered by complexity).
- Switch to Plan mode (`SwitchMode` → `plan`) before designing.
- Use CreatePlan: Problem, Approach, Alternatives, Scope, Test Plan, Risks.
- If alternatives unresolved → STOP and ask orchestrator/user.
- Write `state/{{TICKET_KEY}}/design.md` **only after** approval signal in your
  prompt, OR produce the plan and return `awaiting-approval` without advancing.

## PERSONAS (read ONLY these files)

{{PERSONAS}}

## Clear tickets

Keep the plan short. Skip full Architect blast radius unless a new entity/
provider is involved.

## Complicated / complex

Full multi-perspective design. Architect blast radius for new entity/provider.
Forklift Expert when backend is exposed in UI.

## Return

```
summary:
- approach (2-4 bullets)
- alternatives considered
- awaiting-approval: true|false
- next phase: implement (only if approved)
```
