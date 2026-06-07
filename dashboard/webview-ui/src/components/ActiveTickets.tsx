import { useCallback, type FC } from 'react';

import AccordionSection from './AccordionSection.tsx';
import HoverCard from './HoverCard.tsx';
import RefreshButton from './RefreshButton.tsx';

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

type ActiveTicketsProps = {
  tickets: TicketState[];
  reconcileLoading: boolean;
  onOpenUrl: (url: string) => void;
  onResumeWork: (ticket: string) => void;
  onReconcile: () => void;
};

const ACTIVE_TICKETS_COLUMNS = '72px 1fr 52px';
const JIRA_BASE = 'https://redhat.atlassian.net/browse';
const PR_BASE = 'https://github.com/kubev2v/forklift-console-plugin/pull';

const PHASE_LABELS: Record<string, string> = {
  'triage': 'Triage',
  'investigate': 'Investigate',
  'ask-more-info': 'Ask Info',
  'reproduce': 'Reproduce',
  'jira-track': 'Jira Track',
  'design': 'Design',
  'implement': 'Implement',
  'verify': 'Verify',
  'e2e-test': 'E2E Test',
  'send-pr': 'Send PR',
  'monitor-pr': 'Monitor PR',
  'track-jira-merged': 'Post-Merge',
  'done': 'Done',
};

function formatPhase(phase: string): string {
  return PHASE_LABELS[phase] ?? phase;
}

function phaseColorClass(phase: string): string {
  switch (phase) {
    case 'triage':
    case 'investigate':
    case 'ask-more-info':
    case 'reproduce':
    case 'jira-track':
    case 'design':
      return 'phase--planning';
    case 'implement':
    case 'verify':
    case 'e2e-test':
      return 'phase--implementation';
    case 'send-pr':
    case 'monitor-pr':
      return 'phase--pr';
    case 'track-jira-merged':
      return 'phase--post-merge';
    case 'done':
      return 'phase--done';
    default:
      return '';
  }
}

const STALE_THRESHOLD_DAYS = 7;

function isStale(t: TicketState): boolean {
  if (!t.waiting?.active || !t.waiting.since) return false;
  const days = Math.floor((Date.now() - new Date(t.waiting.since).getTime()) / 86400000);
  return days >= STALE_THRESHOLD_DAYS;
}

function formatWaitingDuration(since: string): string {
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return '1d';
  return `${days}d`;
}

function buildPhaseTooltip(t: TicketState): string | undefined {
  const parts: string[] = [];

  if (t.waiting?.active) {
    parts.push(`${t.waiting.reason} (${formatWaitingDuration(t.waiting.since)})`);
  }

  if (t.prNumber) {
    parts.push(`PR #${t.prNumber}`);
  }

  if (t.branch) {
    parts.push(`Branch: ${t.branch}`);
  }

  return parts.length > 0 ? parts.join('\n') : undefined;
}

const ActiveTickets: FC<ActiveTicketsProps> = ({
  tickets,
  reconcileLoading,
  onOpenUrl,
  onResumeWork,
  onReconcile,
}) => {
  const active = tickets.filter((t) => t.phase !== 'done' && t.prNumber === null);

  const handleTicketClick = useCallback(
    (ticket: string) => onOpenUrl(`${JIRA_BASE}/${ticket}`),
    [onOpenUrl],
  );

  const handlePhaseClick = useCallback(
    (t: TicketState) => {
      if (t.prNumber) {
        onOpenUrl(`${PR_BASE}/${t.prNumber}`);
      }
    },
    [onOpenUrl],
  );

  return (
    <AccordionSection
      title="Tickets on Hold"
      count={active.length}
      actions={
        <RefreshButton
          loading={reconcileLoading}
          onRefresh={onReconcile}
          title="Reconcile: sync stale states, check waiting tickets"
        />
      }
    >
      {active.length === 0 ? (
        <p className="empty-state">No tickets on hold — all tracked tickets have open PRs</p>
      ) : (
        <div className="data-table">
          <div
            className="data-table__head"
            style={{ gridTemplateColumns: ACTIVE_TICKETS_COLUMNS }}
          >
            <span>Key</span>
            <span>Phase</span>
            <span />
          </div>
          {active.map((t) => (
            <div
              key={t.ticket}
              className="data-table__row ticket-item"
              style={{ gridTemplateColumns: ACTIVE_TICKETS_COLUMNS }}
            >
              <HoverCard
                title={`${t.ticket} (${t.type})`}
                description={t.investigation?.rootCause ?? t.investigation?.findings}
              >
                <span
                  className="ticket-item__key clickable"
                  onClick={() => handleTicketClick(t.ticket)}
                >
                  {t.ticket}
                </span>
              </HoverCard>
              <HoverCard title={formatPhase(t.phase)} description={buildPhaseTooltip(t)}>
                <span
                  className={`ticket-item__phase ${phaseColorClass(t.phase)} ${t.waiting?.active ? 'phase--has-waiting' : ''} ${isStale(t) ? 'phase--stale' : ''} ${t.prNumber ? 'clickable' : ''}`}
                  onClick={() => handlePhaseClick(t)}
                >
                  {formatPhase(t.phase)}
                </span>
              </HoverCard>
              <button
                type="button"
                className="ticket-item__resume-btn"
                onClick={() => onResumeWork(t.ticket)}
                title={`Resume work on ${t.ticket}`}
              >
                Resume
              </button>
            </div>
          ))}
        </div>
      )}
    </AccordionSection>
  );
};

export default ActiveTickets;
