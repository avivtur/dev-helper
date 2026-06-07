# Forklift: Design Rules

## Agent Personas
Apply these perspectives during design:

- **Developer** (`.cursor/rules/agents/developer.mdc`): Architecture, code
  quality, patterns
- **UX** (`.cursor/rules/agents/ux-reviewer.mdc`): User experience,
  accessibility, states
- **QE** (`.cursor/rules/agents/qe-agent.mdc`): Testability, edge cases,
  coverage
- **Architect** (`.cursor/rules/agents/architect.mdc`): Blast radius analysis,
  component maps, cross-feature impact
- **Forklift Expert** (`.cursor/rules/agents/forklift-expert.mdc`): Apply when
  the ticket exposes backend functionality in the UI (migration patterns,
  provider behavior, CRD semantics)

## Feature Completeness
Apply the **Architect** persona to run a full blast radius analysis for
features that add a new entity or provider type. The Architect loads frontend
knowledge files and maps every page, component, and data flow affected.

## TypeScript Constraints
- Check for `@forklift-ui/types` gaps when working with CRD types
