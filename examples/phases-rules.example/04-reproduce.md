# Forklift: Reproduction Rules

## Screenshots
- **Read and follow `.cursor/rules/taking-screenshots.mdc`** before taking
  any screenshots
- Save to `~/Downloads/${TICKET_KEY}/` with prefixes: `repro-`, `before-`, `after-`

## Playwright MCP
- MCP server name is workspace-specific (e.g.
  `project-0-forklift-console-plugin-playwright`)
- Use `CallMcpTool` with the workspace-specific server name

## Console URLs
- Overview: `http://localhost:9000/mtv/overview`
- Plans: `http://localhost:9000/mtv/plans`
- Providers: `http://localhost:9000/mtv/providers`
- Network Maps: `http://localhost:9000/mtv/networkMaps`
- Storage Maps: `http://localhost:9000/mtv/storageMaps`
