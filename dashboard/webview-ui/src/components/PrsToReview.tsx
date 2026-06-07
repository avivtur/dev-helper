import { type FC } from 'react';
import { MessageSquareDiff } from 'lucide-react';

import AccordionSection from './AccordionSection.tsx';
import HoverCard from './HoverCard.tsx';
import RefreshButton from './RefreshButton.tsx';

type ReviewStatus = 'needs-your-review' | 'waiting-for-author' | 'you-approved';
type CiStatus = 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED';

type PrInfo = {
  number: number;
  title: string;
  author?: string;
  url: string;
  reviewDecision?: string;
  reviewStatus?: ReviewStatus;
  ciStatus?: CiStatus;
  mergeable?: string;
  behindBy?: number;
};

const PRS_TO_REVIEW_COLUMNS = '20px 56px 18px 22px 22px 22px 22px';

function reviewIcon(status: ReviewStatus | undefined): { icon: string; cls: string; label: string } {
  switch (status) {
    case 'you-approved': return { icon: '✓', cls: 'icon--success', label: 'You Approved' };
    case 'waiting-for-author': return { icon: '◷', cls: 'icon--muted', label: 'Waiting for Author' };
    default: return { icon: '◉', cls: 'icon--warning', label: 'Needs Your Review' };
  }
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
    { label: 'Approved', passed: pr.reviewDecision === 'APPROVED' },
    { label: 'CI passing', passed: pr.ciStatus === 'SUCCESS' },
    { label: 'No conflicts', passed: pr.mergeable === 'MERGEABLE' },
    { label: 'Up to date with main', passed: (pr.behindBy ?? 0) === 0 },
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

type PrRowProps = {
  pr: PrInfo;
  onOpenUrl: (url: string) => void;
  onReviewPr: (prNumber: number) => void;
};

const PrRow: FC<PrRowProps> = ({ pr, onOpenUrl, onReviewPr }) => {
  const rev = reviewIcon(pr.reviewStatus);
  const ci = ciIcon(pr.ciStatus);
  const mrg = mergeReadyIcon(pr);
  const hoverDesc = pr.author ? `by ${pr.author}` : undefined;

  return (
    <div
      className="data-table__row pr-item"
      style={{ gridTemplateColumns: PRS_TO_REVIEW_COLUMNS }}
    >
      <span />
      <HoverCard title={pr.title} description={hoverDesc}>
        <span
          className="pr-item__number clickable"
          onClick={() => onOpenUrl(pr.url)}
        >
          #{pr.number}
        </span>
      </HoverCard>
      <span />
      <HoverCard title={rev.label}>
        <span className={`pr-icon ${rev.cls}`}>{rev.icon}</span>
      </HoverCard>
      <HoverCard title={ci.label}>
        <span className={`pr-icon ${ci.cls}`}>{ci.icon}</span>
      </HoverCard>
      <HoverCard title="Merge readiness" description={formatMergeChecklist(pr)}>
        <span className={`pr-icon ${mrg.cls}`}>{mrg.icon}</span>
      </HoverCard>
      <HoverCard title={`Review PR #${pr.number}`}>
        <button
          className="icon-button"
          onClick={() => onReviewPr(pr.number)}
        >
          <MessageSquareDiff size={14} />
        </button>
      </HoverCard>
    </div>
  );
};

type PrsToReviewProps = {
  prs: PrInfo[];
  loading: boolean;
  lastRefreshed?: string;
  onRefresh: () => void;
  onOpenUrl: (url: string) => void;
  onReviewPr: (prNumber: number) => void;
};

const PrsToReview: FC<PrsToReviewProps> = ({
  prs,
  loading,
  lastRefreshed,
  onRefresh,
  onOpenUrl,
  onReviewPr,
}) => {
  const sortedPrs = [...prs].sort((a, b) => {
    const order: Record<string, number> = { 'needs-your-review': 0, 'waiting-for-author': 1, 'you-approved': 2 };
    return (order[a.reviewStatus ?? 'needs-your-review'] ?? 0) - (order[b.reviewStatus ?? 'needs-your-review'] ?? 0);
  });

  return (
    <AccordionSection
      title="PRs to Review"
      count={prs.length}
      meta={lastRefreshed ? `Last refreshed: ${lastRefreshed}` : undefined}
      actions={
        <RefreshButton loading={loading} onRefresh={onRefresh} title="Refresh PRs" />
      }
    >
      {prs.length === 0 ? (
        <p className="empty-state">No PRs need your review</p>
      ) : (
        <div className="data-table">
          <div className="data-table__head" style={{ gridTemplateColumns: PRS_TO_REVIEW_COLUMNS }}>
            <span />
            <span>#</span>
            <span />
            <HoverCard title="Review status"><span>Rev</span></HoverCard>
            <HoverCard title="CI status"><span>CI</span></HoverCard>
            <HoverCard title="Merge readiness"><span>Mrg</span></HoverCard>
            <span />
          </div>
          {sortedPrs.map((pr) => (
            <PrRow key={pr.number} pr={pr} onOpenUrl={onOpenUrl} onReviewPr={onReviewPr} />
          ))}
        </div>
      )}
    </AccordionSection>
  );
};

export default PrsToReview;
