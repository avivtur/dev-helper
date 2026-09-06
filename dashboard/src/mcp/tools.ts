import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import type { TicketState } from '../types.js';
import {
  buildWorkOnTicketPrompt,
  orchestratorInstructions,
} from '../orchestratorPrompt.js';

export { buildWorkOnTicketPrompt, orchestratorInstructions };

const SKILL_DIR = process.env.SKILL_DIR ?? '';
const WORKSPACE_DIR = process.env.WORKSPACE_DIR ?? '';
const STATE_CLI = path.join(SKILL_DIR, 'scripts', 'state-cli.sh');
const RECONCILE = path.join(SKILL_DIR, 'scripts', 'reconcile.sh');

function exec(script: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('bash', [script, ...args], {
      timeout: 30000,
      cwd: WORKSPACE_DIR,
    }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function fetchTicketType(ticket: string): Promise<string | null> {
  try {
    const configPath = path.join(SKILL_DIR, 'dev-helper.config.json');
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const baseUrl = cfg.jira?.baseUrl;
    if (!baseUrl) return null;

    const credsPath = path.join(process.env.HOME ?? '', '.jira-creds');
    if (!fs.existsSync(credsPath)) return null;

    const credsContent = fs.readFileSync(credsPath, 'utf8');
    const creds: Record<string, string> = {};
    for (const line of credsContent.split('\n')) {
      const match = line.trim().match(/^(?:export\s+)?(\w+)=["']?([^"'\n]+)["']?$/);
      if (match) creds[match[1]] = match[2];
    }

    if (!creds.JIRA_EMAIL || !creds.JIRA_API_TOKEN) return null;

    const output = await exec('curl', [
      '-sf', '-u', `${creds.JIRA_EMAIL}:${creds.JIRA_API_TOKEN}`,
      `${baseUrl}/rest/api/2/issue/${ticket}?fields=issuetype`,
    ]);

    const data = JSON.parse(output);
    return data.fields?.issuetype?.name ?? null;
  } catch {
    return null;
  }
}

function readStateFiles(): TicketState[] {
  const stateDir = path.join(SKILL_DIR, 'state');
  if (!fs.existsSync(stateDir)) return [];
  return fs.readdirSync(stateDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      try {
        const filePath = path.join(stateDir, entry.name, 'state.json');
        return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TicketState;
      } catch { return null; }
    })
    .filter((s): s is TicketState => s !== null);
}

export const TOOL_DEFINITIONS = [
  {
    name: 'work-on-ticket',
    description:
      'Initialize or resume a Jira ticket. Returns state, phase, and orchestratorInstructions ' +
      '(subagent dispatch, human reproduce/verify, scripts — parent must NOT do phase work inline).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ticket: { type: 'string', description: 'Jira ticket key (e.g. MTV-5300)' },
      },
      required: ['ticket'],
    },
  },
  {
    name: 'state-get',
    description: 'Get the current state of a tracked ticket.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ticket: { type: 'string', description: 'Jira ticket key' },
      },
      required: ['ticket'],
    },
  },
  {
    name: 'state-list',
    description: 'List all tracked tickets with their current phase and status.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'state-waiting',
    description: 'List all tickets currently in a waiting state.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'state-phase',
    description: 'Advance a ticket to a new phase.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ticket: { type: 'string', description: 'Jira ticket key' },
        phase: { type: 'string', description: 'Target phase (e.g. implement, verify, send-pr)' },
      },
      required: ['ticket', 'phase'],
    },
  },
  {
    name: 'reconcile',
    description: 'Run reconciliation to sync state files with actual PR/Jira status. Catches stale states, external changes, and missed merges.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'refresh-data',
    description: 'Refresh cached PR and Jira data.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'work-on-ticket': {
      const ticket = args.ticket as string;
      try {
        const existing = await exec(STATE_CLI, ['get', ticket]);
        const state = JSON.parse(existing) as TicketState;
        return JSON.stringify({
          status: 'existing',
          ticket: state.ticket,
          phase: state.phase,
          branch: state.branch,
          waiting: state.waiting,
          prNumber: state.prNumber,
          complexity: (state as { complexity?: string }).complexity ?? null,
          orchestratorInstructions: orchestratorInstructions(ticket, state.phase),
          message: `Ticket ${ticket} at phase "${state.phase}". Follow orchestratorInstructions — dispatch Task subagents; do not do phase work inline.`,
        }, null, 2);
      } catch {
        const ticketType = await fetchTicketType(ticket);
        if (ticketType) {
          try {
            await exec(STATE_CLI, ['init', ticket, ticketType]);
            const initialized = await exec(STATE_CLI, ['get', ticket]);
            const state = JSON.parse(initialized) as TicketState;
            return JSON.stringify({
              status: 'initialized',
              ticket: state.ticket,
              type: state.type,
              phase: state.phase,
              orchestratorInstructions: orchestratorInstructions(ticket, state.phase),
              message: `Initialized ${ticket} (${ticketType}) at phase "triage". Follow orchestratorInstructions — dispatch Task for triage+investigate; do not work inline.`,
            }, null, 2);
          } catch (initErr) {
            return JSON.stringify({
              status: 'error',
              ticket,
              message: `Failed to init state for ${ticket}: ${(initErr as Error).message}`,
            }, null, 2);
          }
        }
        return JSON.stringify({
          status: 'new',
          ticket,
          orchestratorInstructions: orchestratorInstructions(ticket, 'triage'),
          message: `No state for ${ticket}. Run: state-cli.sh init ${ticket} <type>. Then follow orchestratorInstructions — Task subagent for triage+investigate.`,
        }, null, 2);
      }
    }

    case 'state-get': {
      const ticket = args.ticket as string;
      const output = await exec(STATE_CLI, ['get', ticket]);
      return output;
    }

    case 'state-list': {
      const states = readStateFiles();
      const summary = states.map((s) => ({
        ticket: s.ticket,
        type: s.type,
        phase: s.phase,
        waiting: s.waiting?.active ? s.waiting.reason : null,
        prNumber: s.prNumber,
      }));
      return JSON.stringify(summary, null, 2);
    }

    case 'state-waiting': {
      const states = readStateFiles().filter((s) => s.waiting?.active);
      const summary = states.map((s) => ({
        ticket: s.ticket,
        phase: s.phase,
        reason: s.waiting!.reason,
        since: s.waiting!.since,
      }));
      return summary.length > 0
        ? JSON.stringify(summary, null, 2)
        : 'No waiting tickets.';
    }

    case 'state-phase': {
      const ticket = args.ticket as string;
      const phase = args.phase as string;
      return exec(STATE_CLI, ['phase', ticket, phase]);
    }

    case 'reconcile': {
      return exec(RECONCILE, []);
    }

    case 'refresh-data': {
      const configPath = path.join(SKILL_DIR, 'dev-helper.config.json');
      let repo = process.env.GH_REPO ?? 'kubev2v/forklift-console-plugin';
      let author = process.env.GH_USER ?? 'avivtur';
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        repo = cfg.github?.repo ?? repo;
        author = cfg.github?.user ?? author;
      } catch { /* use defaults */ }
      const output = await exec('gh', [
        'pr', 'list', '--repo', repo,
        '--state', 'open', '--author', author,
        '--json', 'number,title,reviewDecision', '--limit', '10',
      ]);
      return `GitHub PRs refreshed:\n${output}`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
