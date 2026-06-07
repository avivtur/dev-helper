import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import type { JiraCreds } from '../types.js';

const CREDS_FILE = path.join(os.homedir(), '.jira-creds');

export function parseJiraCreds(): JiraCreds | null {
  if (!fs.existsSync(CREDS_FILE)) {
    console.warn(`[dev-helper] Jira creds file not found: ${CREDS_FILE}`);
    return null;
  }

  try {
    const content = fs.readFileSync(CREDS_FILE, 'utf8');
    const vars: Record<string, string> = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Handle: export KEY="value", export KEY='value', export KEY=value
      const withExport = trimmed.match(/^export\s+(\w+)=(.+)$/);
      // Handle: KEY="value", KEY='value', KEY=value (no export)
      const withoutExport = trimmed.match(/^(\w+)=(.+)$/);

      const match = withExport ?? withoutExport;
      if (match) {
        let value = match[2].trim();
        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        vars[match[1]] = value;
      }
    }

    const baseUrl = vars['JIRA_BASE_URL'];
    const email = vars['JIRA_EMAIL'];
    const token = vars['JIRA_API_TOKEN'];

    if (!baseUrl || !email || !token) {
      console.warn('[dev-helper] Jira creds file missing required variables. Found keys:', Object.keys(vars).join(', '));
      return null;
    }

    console.log(`[dev-helper] Jira creds loaded for ${email}`);

    return {
      JIRA_BASE_URL: baseUrl,
      JIRA_EMAIL: email,
      JIRA_API_TOKEN: token,
      JIRA_ASSIGNEE_ID: vars['JIRA_ASSIGNEE_ID'],
    };
  } catch (e) {
    console.error('[dev-helper] Failed to parse Jira creds:', e);
    return null;
  }
}
