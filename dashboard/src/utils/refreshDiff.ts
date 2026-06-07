import type { JiraTicket, PrInfo, ReviewStatus } from '../types.js';

const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  'needs-your-review': 'Needs Review',
  'waiting-for-author': 'Waiting for Author',
  'you-approved': 'Approved',
};

function reviewStatusLabel(status: ReviewStatus | undefined): string {
  if (!status) return 'Unknown';
  return REVIEW_STATUS_LABELS[status];
}

export function diffPrLists(before: PrInfo[], after: PrInfo[]): string[] {
  const changes: string[] = [];
  const beforeMap = new Map(before.map((pr) => [pr.number, pr]));
  const afterMap = new Map(after.map((pr) => [pr.number, pr]));

  for (const pr of after) {
    if (!beforeMap.has(pr.number)) {
      changes.push(`Added #${pr.number}`);
    }
  }

  for (const pr of before) {
    if (!afterMap.has(pr.number)) {
      changes.push(`Removed #${pr.number}`);
    }
  }

  for (const pr of after) {
    const prev = beforeMap.get(pr.number);
    if (prev && prev.reviewDecision !== pr.reviewDecision) {
      changes.push(`#${pr.number} status: ${pr.reviewDecision}`);
    }
  }

  return changes;
}

export function diffReviewLists(before: PrInfo[], after: PrInfo[]): string[] {
  const changes: string[] = [];
  const beforeMap = new Map(before.map((pr) => [pr.number, pr]));
  const afterMap = new Map(after.map((pr) => [pr.number, pr]));

  for (const pr of after) {
    if (!beforeMap.has(pr.number)) {
      changes.push(`Added #${pr.number}`);
    }
  }

  for (const pr of before) {
    if (!afterMap.has(pr.number)) {
      changes.push(`Removed #${pr.number}`);
    }
  }

  for (const pr of after) {
    const prev = beforeMap.get(pr.number);
    if (prev && prev.reviewStatus !== pr.reviewStatus) {
      changes.push(
        `#${pr.number} → ${reviewStatusLabel(pr.reviewStatus)}`,
      );
    }
  }

  return changes;
}

export function diffJiraLists(before: JiraTicket[], after: JiraTicket[]): string[] {
  const changes: string[] = [];
  const beforeMap = new Map(before.map((t) => [t.key, t]));
  const afterMap = new Map(after.map((t) => [t.key, t]));

  for (const ticket of after) {
    if (!beforeMap.has(ticket.key)) {
      changes.push(`Added ${ticket.key}`);
    }
  }

  for (const ticket of before) {
    if (!afterMap.has(ticket.key)) {
      changes.push(`Removed ${ticket.key}`);
    }
  }

  for (const ticket of after) {
    const prev = beforeMap.get(ticket.key);
    if (prev && prev.status !== ticket.status) {
      changes.push(`${ticket.key}: ${prev.status} → ${ticket.status}`);
    }
  }

  return changes;
}

export function formatRefreshToast(sectionLabel: string, changes: string[]): string {
  if (changes.length === 0) {
    return `${sectionLabel} — already up to date`;
  }

  const preview = changes.slice(0, 3).join('; ');
  const suffix = changes.length > 3 ? ` (+${changes.length - 3} more)` : '';
  return `${sectionLabel} — ${changes.length} change${changes.length === 1 ? '' : 's'}: ${preview}${suffix}`;
}
