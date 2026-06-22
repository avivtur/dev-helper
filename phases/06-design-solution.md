# Phase 6: Design Solution



**Gate:** GATED by default (configurable via `phases.gates` in config)

Designs the solution using multiple agent perspectives and creates a comprehensive
implementation plan.

---

## Prerequisites

- Investigation complete (Phase 2)
- State file has `investigation.findings` and `investigation.rootCause`

## Agent Personas

Apply agent personas defined in your project's `phases-rules/06-design-solution.md`.
If no phases-rules file exists, use your own judgment on which perspectives
(developer, UX, QE, architecture, domain expert) to apply.

## Steps

### 0. Load project rules

**Before doing anything else in this phase**, check if the file
`.cursor/skills/dev-helper/phases-rules/06-design-solution.md` exists. If it does,
read it now. It contains project-specific agent personas, coding standards,
and conventions that MUST be applied during this phase. Do not skip this step.

### 6.0 Switch to Plan mode

Call `SwitchMode` with `target_mode_id: "plan"` and explanation:
"Switching to plan mode for design phase -- all design work should be
read-only until the plan is approved."

If already in plan mode, skip this step.

### 6.1 Search for similar patterns

Before designing, search the codebase for:
- How similar issues were solved before
- Existing components/utilities that can be reused
- Patterns that the solution should follow for consistency

Use `SemanticSearch` and `Grep` to find relevant code.

### 6.2 Consider UX implications

From the UX perspective:
- What would be the most intuitive behavior for the user?
- Are there loading/error/empty states to handle?
- Does the change affect keyboard navigation or accessibility?
- Are there PatternFly components that fit this use case?

**Feature completeness check** (for features that add a new entity or provider):
Apply the **Architect** persona (`.cursor/rules/agents/architect.mdc`) to run a
full blast radius analysis. The Architect loads frontend knowledge files and
maps every page, component, and data flow affected by the new feature -- wizard,
details page, tips panel, icons, lists, filters, mappings, plans, etc.

### 6.3 Consider development limitations

- Are there TypeScript type constraints (e.g., `@forklift-ui/types` gaps)?
- Are there backend API limitations that constrain the UI?
- Are there performance implications (large lists, frequent re-renders)?
- Does the change affect multiple provider types?

### 6.4 Consider testing approach

- What unit tests are needed?
- Are E2E tests appropriate for this change?
- What edge cases should be covered?
- Are there existing test patterns to follow?

### 6.5 Create the plan

Call Cursor's `CreatePlan` tool with the design content. The `plan` parameter
**must** follow this template -- do not deviate from the section structure:

```markdown
# Design: ${TICKET_KEY} -- [short title]

## Problem (2-3 sentences)
[What is wrong or what is being added. Not the solution -- the problem.]

## Approach
[What will change and why this approach was chosen over alternatives.
 Reference specific file paths and code snippets.
 Include a mermaid diagram if the change involves new data flows,
 component hierarchies, or multi-step processes.]

## Alternatives Considered
[Options considered. For each: what it is, pros, cons, chosen/rejected.
 If any option is unresolved -- STOP and ask the user.]

## Scope
**In scope:** [explicit list]
**Out of scope:** [explicit list]

## Test Plan
[What tests to write. What they verify. Edge cases to cover.]

## Risks / Trade-offs
[What are we giving up? What could go wrong?]
```

Pass implementation tasks via the `todos` parameter of `CreatePlan`. Each todo
should be a concrete step listing the target files and what changes. This
replaces a separate "Files Affected" section -- the todos carry that
information implicitly:

```
todos: [
  { id: "1", content: "Add WAIT_FOR_GUEST_REBOOTS_NAME constant to utils/utils.ts" },
  { id: "2", content: "Create PostMigrationAlert component in components/" },
  { id: "3", content: "Wire PostMigrationAlert into MigrationProgressTable.tsx" },
  { id: "4", content: "Add unit tests for getVMMigrationStatus in utils.test.ts" },
]
```

**HARD CONSTRAINT**: If "Alternatives Considered" has unresolved options (the
agent is uncertain which path to take), the plan MUST stop and ask the user
before proceeding. Do not assume the answer.

### 6.6 Present for approval

`CreatePlan` presents the design to the user for approval. If findings were
identified during the design review, classify each one:

- **REQUIRED** -- must be resolved before implementation begins
- **SUGGESTED** -- advisory, user decides
- **POSITIVE** -- something done well (reinforces good patterns)

If this phase is gated (in `phases.gates` config), present the approval prompt:

```
A) Approve -- proceed to implement
B) Revise -- provide specific feedback; design will be updated
C) Reject -- return to investigate or re-scope the ticket
```

Do not interpret silence as approval. Wait for an explicit choice.

If not gated, present the design as FYI (with any findings) and auto-advance.

### 6.7 Save design artifact and advance phase

After the plan is approved, persist the design and advance:

1. **Save design.md** -- Write the same content passed to `CreatePlan` to:

   ```text
   .cursor/skills/dev-helper/state/${TICKET_KEY}/design.md
   ```

   Use the Write tool. The `design.md` is a persisted copy of the approved
   plan -- do NOT write it before approval.

2. **Switch back to Agent mode** -- Call `SwitchMode` with
   `target_mode_id: "agent"` before advancing to the implement phase.

3. **Update state and advance:**

   ```bash
   .cursor/skills/dev-helper/scripts/state-cli.sh set ${TICKET_KEY} \
     --arg planFile ".cursor/skills/dev-helper/state/${TICKET_KEY}/design.md" \
     '.design.planFile = $planFile | .design.approvedAt = (now | todate)'

   .cursor/skills/dev-helper/scripts/state-cli.sh phase ${TICKET_KEY} implement
   ```

## Completion Checklist

Before advancing from this phase, `state-cli.sh phase` validates:

- [ ] `.investigation.completedAt` field set (investigation was done before design)
- [ ] `state/${TICKET_KEY}/design.md` artifact written (step 6.7)
