# Forklift: Investigation Rules

## Agent Personas
- **Forklift Expert** (`.cursor/rules/agents/forklift-expert.mdc`): Migration
  patterns, provider behavior, CRD semantics, domain-specific constraints

## Blast Radius
- Apply the **Architect** persona (`.cursor/rules/agents/architect.mdc`)
- Load frontend knowledge files from `.cursor/rules/frontend/`
- Use the blast-radius checklist from `providers.mdc` when the ticket touches
  provider types

## Backend PR Discovery
- Backend repo: configured in `github.backendRepo` (kubev2v/forklift)
- Check `customfield_10875` (Git Pull Request field), linked issues, parent
  ticket, children via JQL — up to 3 levels deep
