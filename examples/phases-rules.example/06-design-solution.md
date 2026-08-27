# Forklift: Design Rules

## Agent Personas (complexity-routed)

The orchestrator injects which personas to load. Subagents must read **only**
the injected set:

### `clear` tickets
- **Developer** (`.cursor/rules/agents/developer.mdc`): Architecture, code
  quality, patterns
- **QE** (`.cursor/rules/agents/qe-agent.mdc`): Testability, edge cases,
  coverage

### `complicated` / `complex` tickets
- **Developer** (`.cursor/rules/agents/developer.mdc`)
- **QE** (`.cursor/rules/agents/qe-agent.mdc`)
- **UX** (`.cursor/rules/agents/ux-reviewer.mdc`): User experience,
  accessibility, states
- **Architect** (`.cursor/rules/agents/architect.mdc`): Blast radius analysis,
  component maps, cross-feature impact
- **Forklift Expert** (`.cursor/rules/agents/forklift-expert.mdc`): When the
  ticket exposes backend functionality in the UI (migration patterns,
  provider behavior, CRD semantics)

## Feature Completeness
Apply the **Architect** persona (when listed) to run a full blast radius
analysis for features that add a new entity or provider type. The Architect
loads frontend knowledge files and maps every page, component, and data flow
affected.

## TypeScript Constraints
- Check for `@forklift-ui/types` gaps when working with CRD types
