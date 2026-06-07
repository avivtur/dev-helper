# Dev Helper

A Cursor AI skill that automates the full ticket lifecycle — from picking up a
Jira ticket to merged PR and post-merge cleanup. Includes a dashboard extension
for visual mission control.

## Quick Start

```bash
# Clone into your project
cd your-project
git clone https://github.com/avivtur/dev-helper .cursor/skills/dev-helper

# Copy and fill in your config (start with minimal or full)
cp .cursor/skills/dev-helper/examples/config.minimal.json \
   .cursor/skills/dev-helper/dev-helper.config.json
# Edit dev-helper.config.json with your project's Jira + GitHub values

# (Optional) Copy project-specific phase rules
cp -r .cursor/skills/dev-helper/examples/phases-rules.example/ \
      .cursor/skills/dev-helper/phases-rules/

# (Optional) Copy lesson templates
cp -r .cursor/skills/dev-helper/examples/lessons.example/ \
      .cursor/skills/dev-helper/lessons/

# (Optional) Install the dashboard extension
cd .cursor/skills/dev-helper/dashboard && npm install && npm run build
ln -s "$(pwd)" ~/.cursor/extensions/dev-helper-dashboard
```

Then in Cursor, say: **"work on MTV-5300"**

## Prerequisites

- `jq`, `gh` (GitHub CLI), `git`, `curl`
- `~/.jira-creds` with your Jira API token
- See [SETUP.md](SETUP.md) for the full guide

## How It Works

13-phase pipeline with configurable gates:

1. **Triage** — claim ticket, validate, classify complexity
2. **Investigate** — root cause, backend PRs, blast radius
3. **Ask More Info** — post Jira comment if blocked (optional)
4. **Reproduce** — Playwright screenshots, reproduction script (mandatory for bugs)
5. **Jira Track** — sprint, story points, fix version
6. **Design** — multi-perspective plan (gated by default)
7. **Implement** — code on branch, build/lint/i18n
8. **Verify** — unit tests
9. **E2E Test** — Playwright (skip if no cluster)
10. **Send PR** — atomic 8-step PR creation
11. **Monitor PR** — CI, rebase, review replies, auto-merge (6 criteria)
11b. **Learn** — mandatory review, rule/lesson updates
12. **Post-Merge Jira** — transitions, QA, story points, epic closure

## Project-Specific Rules

Each project can inject its own context per phase via `phases-rules/`:

```
phases-rules/
  06-design-solution.md  # "Use these agent personas..."
  07-implement.md        # "Load these coding standards..."
```

See `examples/phases-rules.example/` for a reference (Forklift Console Plugin).

## Config

Two config examples:
- `examples/config.minimal.json` — 3 required fields
- `examples/config.full.json` — all fields with documentation

See [SETUP.md](SETUP.md) for field-by-field documentation.

## License

Apache-2.0
