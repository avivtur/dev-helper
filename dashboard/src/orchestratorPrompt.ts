/** Shared orchestrator text for MCP responses and dashboard Composer prompts. */

export function orchestratorInstructions(ticket: string, phase: string): string {
  return [
    'ORCHESTRATOR MODE (mandatory). You are the thin parent only.',
    'Read .cursor/skills/dev-helper/phases/orchestrator-brief.md once.',
    'Do NOT implement, npm test, or Playwright MCP in the parent.',
    'Dispatch Task subagents per phases/prompts/ + resolve-model.sh.',
    'reproduce = human checklist; verify/e2e = human runs tests.',
    'send-pr/monitor = scripts via subagents only.',
    `Ticket ${ticket} — current phase "${phase}". Execute that phase per orchestrator-brief.`,
  ].join(' ');
}

export function buildWorkOnTicketPrompt(ticket: string, mode: 'start' | 'resume'): string {
  const verb = mode === 'resume' ? 'resume work on' : 'work on';
  return [
    `${verb} ${ticket}`,
    '',
    'ORCHESTRATOR MODE (mandatory): Call work-on-ticket MCP first.',
    'Then follow orchestratorInstructions from the MCP response.',
    'Dispatch Task subagents for phase work — never implement or npm test in the parent.',
    'Attach dev-helper skill; do not Read SKILL.md when attached.',
  ].join('\n');
}
