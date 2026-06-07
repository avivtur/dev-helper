import { useState, useCallback, useEffect, type FC } from 'react';

import { useIpc } from './hooks/useIpc.ts';
import { getVsCodeApi } from './hooks/useVsCodeApi.ts';
import ActiveTickets from './components/ActiveTickets.tsx';
import JiraBacklog from './components/JiraBacklog.tsx';
import MyPrs from './components/MyPrs.tsx';
import PrsToReview from './components/PrsToReview.tsx';
import SetupChecklist from './components/SetupChecklist.tsx';

type TicketState = {
  ticket: string;
  ticketUrl: string;
  type: string;
  phase: string;
  branch: string | null;
  prUrl: string | null;
  prNumber: number | null;
  waiting: { active: boolean; reason: string; since: string } | null;
  investigation: { findings: string; rootCause: string } | null;
};

type PrInfo = {
  number: number;
  title: string;
  author?: string;
  url: string;
  reviewDecision: string;
  mergeable?: string;
  behindBy?: number;
  ciStatus?: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED';
  reviewStatus?: 'needs-your-review' | 'waiting-for-author' | 'you-approved';
  yourPrStatus?: 'awaiting-review' | 'changes-requested' | 'approved';
  humanReviewCount?: number;
  botCommentCount?: number;
  unresolvedHumanThreads?: number;
  repliedHumanThreads?: number;
  learnStatus?: 'learned' | 'skipped' | 'none';
  ticketKey?: string;
  ticketPhase?: string;
  ticketWaitingSince?: string;
};

type JiraTicket = {
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

type SetupCheck = {
  id: string;
  label: string;
  passed: boolean;
  setupRef: string;
};

type SectionMeta = {
  loading: boolean;
  lastUpdated?: string;
};

type SectionMetaState = {
  yourPrs: SectionMeta;
  prsToReview: SectionMeta;
  jiraBacklog: SectionMeta;
  reconcile: SectionMeta;
};

type DashboardState = {
  tickets: TicketState[];
  yourPrs: PrInfo[];
  prsToReview: PrInfo[];
  jiraBacklog: JiraTicket[];
  setupChecks: SetupCheck[];
  sectionMeta: SectionMetaState;
};

const INITIAL_SECTION_META: SectionMetaState = {
  yourPrs: { loading: false },
  prsToReview: { loading: false },
  jiraBacklog: { loading: false },
  reconcile: { loading: false },
};

const INITIAL_STATE: DashboardState = {
  tickets: [],
  yourPrs: [],
  prsToReview: [],
  jiraBacklog: [],
  setupChecks: [],
  sectionMeta: INITIAL_SECTION_META,
};

function formatLastRefreshed(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const App: FC = () => {
  const [state, setState] = useState<DashboardState>(() => {
    const saved = getVsCodeApi().getState() as Partial<DashboardState> | undefined;
    return {
      ...INITIAL_STATE,
      ...saved,
      sectionMeta: saved?.sectionMeta ?? INITIAL_SECTION_META,
    };
  });

  useEffect(() => {
    getVsCodeApi().setState(state);
  }, [state]);

  const handleMessage = useCallback((msg: { type: string; [key: string]: unknown }) => {
    switch (msg.type) {
      case 'state':
        setState((prev) => ({ ...prev, tickets: msg.data as TicketState[] }));
        break;
      case 'yourPrs':
        setState((prev) => ({ ...prev, yourPrs: msg.data as PrInfo[] }));
        break;
      case 'prsToReview':
        setState((prev) => ({ ...prev, prsToReview: msg.data as PrInfo[] }));
        break;
      case 'jiraBacklog':
        setState((prev) => ({ ...prev, jiraBacklog: msg.data as JiraTicket[] }));
        break;
      case 'refreshStatus': {
        const source = msg.source as keyof Pick<SectionMetaState, 'yourPrs' | 'prsToReview' | 'jiraBacklog'>;
        setState((prev) => ({
          ...prev,
          sectionMeta: {
            ...prev.sectionMeta,
            [source]: {
              loading: msg.loading as boolean,
              lastUpdated: (msg.lastUpdated as string | undefined) ?? prev.sectionMeta[source].lastUpdated,
            },
          },
        }));
        break;
      }
      case 'reconcileStatus':
        setState((prev) => ({
          ...prev,
          sectionMeta: {
            ...prev.sectionMeta,
            reconcile: { loading: msg.loading as boolean },
          },
        }));
        break;
      case 'setupStatus':
        setState((prev) => ({ ...prev, setupChecks: msg.checks as SetupCheck[] }));
        break;
    }
  }, []);

  const { send } = useIpc(handleMessage);

  useEffect(() => {
    send({ type: 'ready' });
  }, [send]);

  const handleOpenUrl = useCallback(
    (url: string) => send({ type: 'openUrl', url }),
    [send],
  );

  const handleStartTicket = useCallback(
    (ticket: string) => send({ type: 'workOnTicket', ticket, mode: 'start' }),
    [send],
  );


  const handleResumeTicket = useCallback(
    (ticket: string) => send({ type: 'workOnTicket', ticket, mode: 'resume' }),
    [send],
  );

  const handleReconcile = useCallback(() => send({ type: 'reconcile' }), [send]);

  const handleRefreshPrs = useCallback(
    () => send({ type: 'refresh', source: 'prs' }),
    [send],
  );

  const handleRefreshJira = useCallback(
    (assignedToMe?: boolean) => send({ type: 'refresh', source: 'jira', assignedToMe }),
    [send],
  );

  const handleMonitorPr = useCallback(
    (prNumber: number) => send({ type: 'agentAction', action: 'monitor-pr', prNumber }),
    [send],
  );

  const handleMonitorAll = useCallback(
    () => send({ type: 'agentAction', action: 'monitor-all' }),
    [send],
  );

  const handleReviewPr = useCallback(
    (prNumber: number) => send({ type: 'agentAction', action: 'review-pr', prNumber }),
    [send],
  );

  const handleCopyToClipboard = useCallback(
    (text: string) => send({ type: 'copyToClipboard', text }),
    [send],
  );

  const { sectionMeta } = state;

  return (
    <div className="dashboard">
      <SetupChecklist checks={state.setupChecks} />
        <MyPrs
          prs={state.yourPrs}
          loading={sectionMeta.yourPrs.loading}
          lastRefreshed={
            sectionMeta.yourPrs.lastUpdated
              ? formatLastRefreshed(sectionMeta.yourPrs.lastUpdated)
              : undefined
          }
          onRefresh={handleRefreshPrs}
          onOpenUrl={handleOpenUrl}
          onMonitorPr={handleMonitorPr}
          onMonitorAll={handleMonitorAll}
          onCopyToClipboard={handleCopyToClipboard}
        />
        <PrsToReview
          prs={state.prsToReview}
          loading={sectionMeta.prsToReview.loading}
          lastRefreshed={
            sectionMeta.prsToReview.lastUpdated
              ? formatLastRefreshed(sectionMeta.prsToReview.lastUpdated)
              : undefined
          }
          onRefresh={handleRefreshPrs}
          onOpenUrl={handleOpenUrl}
          onReviewPr={handleReviewPr}
        />
      <JiraBacklog
        tickets={state.jiraBacklog}
        loading={sectionMeta.jiraBacklog.loading}
        lastRefreshed={
          sectionMeta.jiraBacklog.lastUpdated
            ? formatLastRefreshed(sectionMeta.jiraBacklog.lastUpdated)
            : undefined
        }
        onRefresh={handleRefreshJira}
        onOpenUrl={handleOpenUrl}
        onStartWork={handleStartTicket}
      />
      <ActiveTickets
        tickets={state.tickets}
        reconcileLoading={sectionMeta.reconcile.loading}
        onOpenUrl={handleOpenUrl}
        onResumeWork={handleResumeTicket}
        onReconcile={handleReconcile}
      />
    </div>
  );
};

export default App;
