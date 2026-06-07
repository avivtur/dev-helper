import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { handleToolCall } from './tools.js';

const server = new McpServer({
  name: 'dev-helper',
  version: '0.1.0',
});

const ticketParam = { ticket: z.string().describe('Jira ticket key (e.g. MTV-5300)') };

async function call(name: string, args: Record<string, unknown>): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const result = await handleToolCall(name, args);
    return { content: [{ type: 'text', text: result }] };
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${(e as Error).message}` }], isError: true };
  }
}

server.tool(
  'work-on-ticket',
  'Initialize or resume work on a Jira ticket. Returns the current state and phase routing information.',
  ticketParam,
  async ({ ticket }) => call('work-on-ticket', { ticket }),
);

server.tool(
  'state-get',
  'Get the current state of a tracked ticket.',
  ticketParam,
  async ({ ticket }) => call('state-get', { ticket }),
);

server.tool(
  'state-list',
  'List all tracked tickets with their current phase and status.',
  {},
  async () => call('state-list', {}),
);

server.tool(
  'state-waiting',
  'List all tickets currently in a waiting state.',
  {},
  async () => call('state-waiting', {}),
);

server.tool(
  'state-phase',
  'Advance a ticket to a new phase.',
  {
    ticket: z.string().describe('Jira ticket key'),
    phase: z.string().describe('Target phase (e.g. implement, verify, send-pr)'),
  },
  async ({ ticket, phase }) => call('state-phase', { ticket, phase }),
);

server.tool(
  'reconcile',
  'Run reconciliation to sync state files with actual PR/Jira status.',
  {},
  async () => call('reconcile', {}),
);

server.tool(
  'refresh-data',
  'Refresh cached PR and Jira data.',
  {},
  async () => call('refresh-data', {}),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error('MCP server failed to start:', e);
  process.exit(1);
});
