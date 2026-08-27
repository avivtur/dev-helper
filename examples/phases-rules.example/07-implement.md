# Forklift: Implementation Rules

## Rules to Follow
Load and follow these rules during implementation:

- `AGENTS.md` — Project coding standards (always applied)
- `.cursor/rules/i18n.mdc` — Translation patterns
- `.cursor/rules/react-components.mdc` — PatternFly and Console SDK patterns
- `.cursor/rules/styles.mdc` — SCSS guidelines
- `.cursor/rules/typescript.mdc` — TypeScript guidelines
- `.cursor/rules/workflows/new-component.mdc` — If creating new components

Prefer Cursor glob auto-loading; do not force-read all of the above unless needed.

## Agent Personas (complexity-routed)
Orchestrator injects the set to load:

### `clear`
- **Developer** (`.cursor/rules/agents/developer.mdc`): Code quality, patterns
- **QE** (`.cursor/rules/agents/qe-agent.mdc`): When writing unit tests

### `complicated` / `complex`
- **Developer** + **QE** + **UX** (`.cursor/rules/agents/ux-reviewer.mdc`)
  + **Architect** (`.cursor/rules/agents/architect.mdc`)
  + **Forklift Expert** (`.cursor/rules/agents/forklift-expert.mdc`) when
  backend behavior is exposed in the UI

## Tests
Write unit tests during implement; human runs `npm test` in verify.
