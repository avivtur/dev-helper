import { useState, useCallback, type FC } from 'react';
import { BotMessageSquare, Tag } from 'lucide-react';

import AccordionSection from './AccordionSection.tsx';
import HoverCard from './HoverCard.tsx';
import RefreshButton from './RefreshButton.tsx';

type YourPrStatus = 'awaiting-review' | 'changes-requested' | 'approved';
type CiStatus = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED';

type PrInfo = {
  number: number;
  title: string;
  url: string;
  yourPrStatus?: YourPrStatus;
  ciStatus?: CiStatus;
  mergeable?: string;
  behindBy?: number;
  humanReviewCount?: number;
  botCommentCount?: number;
  unresolvedHumanThreads?: number;
  repliedHumanThreads?: number;
  learnStatus?: 'learned' | 'skipped' | 'none';
  ticketKey?: string;
  ticketPhase?: string;
  ticketWaitingSince?: string;
};

type MyPrsProps = {
  prs: PrInfo[];
  loading: boolean;
  lastRefreshed?: string;
  onRefresh: () => void;
  onOpenUrl: (url: string) => void;
  onMonitorPr: (prNumber: number) => void;
  onMonitorAll: () => void;
  onCopyToClipboard: (text: string) => void;
};

const MY_PRS_COLUMNS = '20px 56px 18px 22px 22px 22px 22px';
const PR_BASE = 'https://github.com/kubev2v/forklift-console-plugin/pull';

function reviewIcon(status: YourPrStatus | undefined): { icon: string; cls: string; label: string } {
  switch (status) {
    case 'approved': return { icon: '✓', cls: 'icon--success', label: 'Approved' };
    case 'changes-requested': return { icon: '✗', cls: 'icon--error', label: 'Changes Requested' };
    default: return { icon: '◷', cls: 'icon--warning', label: 'Awaiting Review' };
  }
}

function buildReviewTooltip(pr: PrInfo): string {
  const parts: string[] = [];
  const human = pr.humanReviewCount ?? 0;
  const bot = pr.botCommentCount ?? 0;
  const unresolved = pr.unresolvedHumanThreads ?? 0;
  const replied = pr.repliedHumanThreads ?? 0;
  parts.push(`${human} human reviewer${human !== 1 ? 's' : ''}`);
  if (bot > 0) parts.push(`${bot} CodeRabbit comment${bot !== 1 ? 's' : ''}`);
  if (unresolved > 0) parts.push(`${replied}/${unresolved} threads replied`);
  return parts.join('\n');
}

function ciIcon(status: CiStatus | undefined): { icon: string; cls: string; label: string } {
  switch (status) {
    case 'SUCCESS': return { icon: '✓', cls: 'icon--success', label: 'CI Passing' };
    case 'FAILURE': return { icon: '✗', cls: 'icon--error', label: 'CI Failing' };
    case 'ERROR': return { icon: '!', cls: 'icon--error', label: 'CI Error' };
    case 'PENDING': return { icon: '◷', cls: 'icon--warning', label: 'CI Pending' };
    default: return { icon: '—', cls: 'icon--muted', label: 'CI Unknown' };
  }
}

type MergeCriterion = { label: string; passed: boolean };

function getMergeCriteria(pr: PrInfo): MergeCriterion[] {
  return [
    { label: 'Approved', passed: pr.yourPrStatus === 'approved' },
    { label: 'CI passing', passed: pr.ciStatus === 'SUCCESS' },
    { label: 'No conflicts', passed: pr.mergeable === 'MERGEABLE' },
    { label: 'No changes requested', passed: pr.yourPrStatus !== 'changes-requested' },
    { label: 'Up to date with main', passed: (pr.behindBy ?? 0) === 0 },
    { label: 'Learnings captured', passed: pr.learnStatus === 'learned' || pr.learnStatus === 'skipped' || !pr.learnStatus },
  ];
}

function mergeReadyIcon(pr: PrInfo): { icon: string; cls: string } {
  const criteria = getMergeCriteria(pr);
  const allPassed = criteria.every((c) => c.passed);

  if (pr.mergeable === 'CONFLICTING') {
    return { icon: '✗', cls: 'icon--error' };
  }
  if (allPassed) {
    return { icon: '✓', cls: 'icon--success' };
  }
  return { icon: '—', cls: 'icon--muted' };
}

function formatMergeChecklist(pr: PrInfo): string {
  return getMergeCriteria(pr)
    .map((c) => `${c.passed ? '✓' : '✗'}  ${c.label}`)
    .join('\n');
}

const PHASE_LABELS: Record<string, string> = {
  'triage': 'Triage', 'investigate': 'Investigate', 'implement': 'Implement',
  'verify': 'Verify', 'send-pr': 'Send PR', 'monitor-pr': 'Monitor PR',
  'track-jira-merged': 'Post-Merge', 'done': 'Done',
};

function formatPhase(phase: string): string {
  return PHASE_LABELS[phase] ?? phase;
}

const STALE_THRESHOLD_DAYS = 7;

function buildTicketTooltip(pr: PrInfo): string | undefined {
  if (!pr.ticketPhase) return undefined;
  const parts = [formatPhase(pr.ticketPhase)];
  if (pr.ticketWaitingSince) {
    const days = Math.floor((Date.now() - new Date(pr.ticketWaitingSince).getTime()) / 86400000);
    if (days >= STALE_THRESHOLD_DAYS) {
      parts.push(`STALE — waiting ${days}d`);
    }
  }
  return parts.join('\n');
}

const MyPrs: FC<MyPrsProps> = ({ prs, loading, lastRefreshed, onRefresh, onOpenUrl, onMonitorPr, onMonitorAll, onCopyToClipboard }) => {
  const [selectedPrs, setSelectedPrs] = useState<Set<number>>(new Set());

  const handleClick = useCallback(
    (number: number) => onOpenUrl(`${PR_BASE}/${number}`),
    [onOpenUrl],
  );

  const toggleSelect = useCallback((prNumber: number) => {
    setSelectedPrs((prev) => {
      const next = new Set(prev);
      if (next.has(prNumber)) next.delete(prNumber);
      else next.add(prNumber);
      return next;
    });
  }, []);

  const handleShare = useCallback(() => {
    const selected = prs.filter((pr) => selectedPrs.has(pr.number));
    if (selected.length === 0) return;
    const lines = ['Could you review these PRs?'];
    
    for (const pr of selected) {
      lines.push(`${PR_BASE}/${pr.number}`);
    }
    onCopyToClipboard(lines.join('\n'));
    setSelectedPrs(new Set());
  }, [prs, selectedPrs, onCopyToClipboard]);

  const sorted = [...prs].sort((a, b) => {
    const order: Record<string, number> = { 'changes-requested': 0, 'awaiting-review': 2, 'approved': 3 };
    const aScore = order[a.yourPrStatus ?? 'awaiting-review'] ?? 2;
    const bScore = order[b.yourPrStatus ?? 'awaiting-review'] ?? 2;
    if (aScore !== bScore) return aScore - bScore;
    const ciOrder: Record<string, number> = { 'FAILURE': 0, 'ERROR': 0, 'PENDING': 1, 'SUCCESS': 2 };
    return (ciOrder[a.ciStatus ?? ''] ?? 2) - (ciOrder[b.ciStatus ?? ''] ?? 2);
  });

  return (
    <AccordionSection
      title="My PRs"
      count={prs.length}
      meta={lastRefreshed ? `Last refreshed: ${lastRefreshed}` : undefined}
      actions={
        <RefreshButton loading={loading} onRefresh={onRefresh} title="Refresh PRs" />
      }
    >
      {prs.length === 0 ? (
        <p className="empty-state">No open PRs</p>
      ) : (
        <div className="data-table">
          <div className="data-table__head" style={{ gridTemplateColumns: MY_PRS_COLUMNS }}>
            <span />
            <span>#</span>
            <span />
            <HoverCard title="Review status"><span>Rev</span></HoverCard>
            <HoverCard title="CI status"><span>CI</span></HoverCard>
            <HoverCard title="Merge readiness"><span>Mrg</span></HoverCard>
            <HoverCard title="Monitor all PRs">
              <button
                className="icon-button icon-button--play"
                onClick={onMonitorAll}
              >
                <BotMessageSquare size={14} />
              </button>
            </HoverCard>
          </div>
          {sorted.map((pr) => {
            const rev = reviewIcon(pr.yourPrStatus);
            const ci = ciIcon(pr.ciStatus);
            const mrg = mergeReadyIcon(pr);
            const isSelected = selectedPrs.has(pr.number);
            return (
              <div
                key={pr.number}
                className={`data-table__row pr-item ${isSelected ? 'pr-item--selected' : ''}`}
                style={{ gridTemplateColumns: MY_PRS_COLUMNS }}
              >
                <input
                  type="checkbox"
                  className="pr-item__checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(pr.number)}
                />
                <HoverCard title={pr.title}>
                  <span
                    className="pr-item__number clickable"
                    onClick={() => handleClick(pr.number)}
                  >
                    #{pr.number}
                  </span>
                </HoverCard>
                {pr.ticketKey ? (
                  <HoverCard
                    title={pr.ticketKey}
                    description={buildTicketTooltip(pr)}
                  >
                    <span
                      className="pr-item__ticket-tag clickable"
                      onClick={() => onOpenUrl(`https://redhat.atlassian.net/browse/${pr.ticketKey}`)}
                    >
                      <Tag size={12} />
                    </span>
                  </HoverCard>
                ) : (
                  <span />
                )}
                <HoverCard title={rev.label} description={buildReviewTooltip(pr)}>
                  <span className={`pr-icon ${rev.cls}`}>{rev.icon}</span>
                </HoverCard>
                <HoverCard title={ci.label}>
                  <span className={`pr-icon ${ci.cls}`}>{ci.icon}</span>
                </HoverCard>
                <HoverCard title="Merge readiness" description={formatMergeChecklist(pr)}>
                  <span className={`pr-icon ${mrg.cls}`}>{mrg.icon}</span>
                </HoverCard>
                <HoverCard title={`Monitor PR #${pr.number}`}>
                  <button
                    className="icon-button icon-button--play"
                    onClick={() => onMonitorPr(pr.number)}
                  >
                    <BotMessageSquare size={14} />
                  </button>
                </HoverCard>
              </div>
            );
          })}
        </div>
      )}
      {selectedPrs.size > 0 && (
        <div className="share-bar">
          <button className="share-bar__button" onClick={handleShare}>
            Share {selectedPrs.size} PR{selectedPrs.size > 1 ? 's' : ''} for review
          </button>
        </div>
      )}
    </AccordionSection>
  );
};

export default MyPrs;
