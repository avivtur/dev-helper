export type TicketState = {
  version: number;
  ticket: string;
  ticketUrl: string;
  type: 'Bug' | 'Story' | 'Task' | 'Epic' | string;
  phase: string;
  branch: string | null;
  prUrl: string | null;
  prNumber: number | null;
  startedAt: string;
  investigation: {
    completedAt: string;
    findings: string;
    rootCause: string;
    affectedFiles: string[];
  } | null;
  design: {
    planFile: string | null;
    approvedAt: string | null;
  } | null;
  pr: {
    createdAt: string;
    mergedAt: string | null;
    ciStatus: string | null;
    lastChecked: string | null;
  } | null;
  history: { phase: string; at: string }[];
  skippedPhases: string[];
  waiting: {
    active: boolean;
    reason: string;
    since: string;
  } | null;
  learn?: { status: 'learned' | 'skipped' | 'none'; committedAt: string | null };
};

export type ReviewStatus = 'needs-your-review' | 'waiting-for-author' | 'you-approved';

export type YourPrStatus = 'awaiting-review' | 'changes-requested' | 'approved';

export type CiStatus = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED';

export type PrInfo = {
  number: number;
  title: string;
  author?: string;
  createdAt: string;
  url: string;
  reviewDecision: string;
  mergeable?: string;
  behindBy?: number;
  ciStatus?: CiStatus;
  reviewStatus?: ReviewStatus;
  yourPrStatus?: YourPrStatus;
  humanReviewCount?: number;
  botCommentCount?: number;
  unresolvedHumanThreads?: number;
  repliedHumanThreads?: number;
  learnStatus?: 'learned' | 'skipped' | 'none';
  ticketKey?: string;
  ticketPhase?: string;
  ticketWaitingSince?: string;
};

export type JiraTicket = {
  key: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  fixVersions: string[];
  storyPoints: number | null;
  sprint: string | null;
};

export type JiraCreds = {
  JIRA_BASE_URL: string;
  JIRA_EMAIL: string;
  JIRA_API_TOKEN: string;
  JIRA_ASSIGNEE_ID?: string;
};

export type RefreshSectionSource = 'yourPrs' | 'prsToReview' | 'jiraBacklog';

export type SetupCheck = {
  id: string;
  label: string;
  passed: boolean;
  setupRef: string;
};

// IPC: Extension -> Webview
export type ExtToWebview =
  | { type: 'state'; data: TicketState[] }
  | { type: 'yourPrs'; data: PrInfo[] }
  | { type: 'prsToReview'; data: PrInfo[] }
  | { type: 'jiraBacklog'; data: JiraTicket[] }
  | { type: 'error'; source: string; message: string }
  | {
      type: 'refreshStatus';
      source: RefreshSectionSource;
      loading: boolean;
      lastUpdated?: string;
      changes?: string[];
    }
  | { type: 'reconcileStatus'; loading: boolean }
  | { type: 'setupStatus'; checks: SetupCheck[] };

// IPC: Webview -> Extension
export type AgentActionType = 'monitor-pr' | 'monitor-all' | 'review-pr';

export type WebviewToExt =
  | { type: 'refresh'; source: 'prs' | 'jira' | 'all'; assignedToMe?: boolean }
  | { type: 'openUrl'; url: string }
  | { type: 'workOnTicket'; ticket: string; mode: 'start' | 'resume' }
  | { type: 'agentAction'; action: AgentActionType; prNumber?: number }
  | { type: 'reconcile' }
  | { type: 'copyToClipboard'; text: string }
  | { type: 'ready' };
