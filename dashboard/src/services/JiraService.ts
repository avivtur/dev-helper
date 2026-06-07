import type { JiraCreds, JiraTicket } from '../types.js';

const DEFAULT_ASSIGNEE_ID = '5e9ff58b1f32260c13f717ca';
const MAX_DESCRIPTION_LENGTH = 200;

function truncateDescription(desc: unknown): string {
  if (!desc) return '';
  // Jira API v3 returns ADF (Atlassian Document Format) as an object
  if (typeof desc === 'object') {
    const text = extractAdfText(desc as AdfNode);
    return text.length > MAX_DESCRIPTION_LENGTH ? text.slice(0, MAX_DESCRIPTION_LENGTH) + '...' : text;
  }
  const str = String(desc);
  return str.length > MAX_DESCRIPTION_LENGTH ? str.slice(0, MAX_DESCRIPTION_LENGTH) + '...' : str;
}

type AdfNode = { type?: string; text?: string; content?: AdfNode[] };

function extractAdfText(node: AdfNode): string {
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(extractAdfText).join(' ').trim();
}

export class JiraService {
  private readonly boardId: string;
  private readonly projectKey: string;
  private readonly componentName: string;
  private cache: { data: JiraTicket[]; lastUpdated: string } | null = null;

  constructor(
    private readonly creds: JiraCreds,
    config?: { jira?: { boardId?: string; projectKey?: string; componentName?: string } },
  ) {
    this.boardId = config?.jira?.boardId ?? '11806';
    this.projectKey = config?.jira?.projectKey ?? 'MTV';
    this.componentName = config?.jira?.componentName ?? 'User Interface';
  }

  getCached(): JiraTicket[] {
    return this.cache?.data ?? [];
  }

  getLastUpdated(): string | null {
    return this.cache?.lastUpdated ?? null;
  }

  async fetchBacklog(assignedToMe = true): Promise<JiraTicket[]> {
    const assigneeClause = assignedToMe
      ? `AND assignee = "${this.creds.JIRA_ASSIGNEE_ID ?? DEFAULT_ASSIGNEE_ID}"`
      : `AND component = "${this.componentName}"`;
    const jql = `project = ${this.projectKey} ${assigneeClause} AND status not in (Closed, Verified, "Release Pending") ORDER BY priority ASC, created ASC`;

    const searchUrl = `${this.creds.JIRA_BASE_URL}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=key,summary,description,status,priority,issuetype,fixVersions,customfield_10028&maxResults=100`;

    const result = await this.jiraFetch<JiraSearchResponse>(searchUrl);

    const sprintMap = await this.fetchSprintMap();

    const tickets: JiraTicket[] = (result.issues ?? []).map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary?.toString() ?? '',
      description: truncateDescription(issue.fields.description),
      status: issue.fields.status?.name ?? '',
      priority: issue.fields.priority?.name ?? '',
      type: issue.fields.issuetype?.name ?? '',
      fixVersions: (issue.fields.fixVersions ?? []).map((v: { name: string }) => v.name),
      storyPoints: issue.fields.customfield_10028 ?? null,
      sprint: sprintMap[issue.key] ?? null,
    }));

    this.cache = { data: tickets, lastUpdated: new Date().toISOString() };
    return tickets;
  }

  private async fetchSprintMap(): Promise<Record<string, string>> {
    const map: Record<string, string> = {};

    try {
      const sprintsUrl = `${this.creds.JIRA_BASE_URL}/rest/agile/1.0/board/${this.boardId}/sprint?state=active,future&maxResults=5`;
      const sprintsResult = await this.jiraFetch<{ values: { id: number; name: string }[] }>(sprintsUrl);

      for (const sprint of sprintsResult.values ?? []) {
        try {
          const issuesUrl = `${this.creds.JIRA_BASE_URL}/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=200&fields=key`;
          const issuesResult = await this.jiraFetch<{ issues: { key: string }[] }>(issuesUrl);

          for (const issue of issuesResult.issues ?? []) {
            map[issue.key] = sprint.name;
          }
        } catch {
          // Skip individual sprint fetch failures
        }
      }
    } catch (e) {
      console.warn('[dev-helper] Sprint fetch failed:', (e as Error).message);
    }

    return map;
  }

  private async jiraFetch<T>(url: string): Promise<T> {
    const auth = Buffer.from(`${this.creds.JIRA_EMAIL}:${this.creds.JIRA_API_TOKEN}`).toString('base64');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Jira API ${response.status}: ${body.slice(0, 200)}`);
    }

    return (await response.json()) as T;
  }
}

type JiraSearchResponse = {
  issues: {
    key: string;
    fields: {
      summary: string;
      description: unknown;
      status: { name: string };
      priority: { name: string };
      issuetype: { name: string };
      fixVersions: { name: string }[];
      customfield_10028: number | null;
    };
  }[];
};
