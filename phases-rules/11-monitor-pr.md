# Forklift: PR Monitor Rules

## Pre-merge Learn: Rule Update Targets

When capturing learnings before merge, consider these targets:

| Category | Update target |
|----------|--------------|
| New CRD or resource type | `.cursor/rules/project-context.mdc` |
| New provider type or status | `.cursor/rules/project-context.mdc`, `agents/forklift-expert.mdc` |
| New shared utility or hook | `AGENTS.md` |
| New convention or anti-pattern | `AGENTS.md` |
| New test pattern or mock | `.cursor/rules/workflows/playwright-testing.mdc` |
| New TypeScript workaround | `.cursor/rules/typescript.mdc` |
