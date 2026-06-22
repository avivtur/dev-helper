import { useState, useMemo, useCallback, type FC } from 'react';
import {
  Asterisk,
  BookOpen,
  Bug,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  CircleSlash,
  GitPullRequestCreate,
  Minus,
  ShieldAlert,
  Zap,
} from 'lucide-react';

import AccordionSection from './AccordionSection.tsx';
import HoverCard from './HoverCard.tsx';
import MultiSelectFilter from './MultiSelectFilter.tsx';
import RefreshButton from './RefreshButton.tsx';

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
  tracked?: boolean;
};

type JiraBacklogProps = {
  tickets: JiraTicket[];
  loading: boolean;
  lastRefreshed?: string;
  onRefresh: (assignedToMe: boolean) => void;
  onOpenUrl: (url: string) => void;
  onStartWork: (ticket: string) => void;
};

type SortColumn = 'key' | 'type' | 'priority' | 'sp' | 'status';
type SortDirection = 'asc' | 'desc';

const JIRA_COLUMNS = '72px 20px 20px 28px 1fr 28px';
const JIRA_BASE = 'https://redhat.atlassian.net/browse';

const PRIORITY_RANK: Record<string, number> = {
  Blocker: 0,
  Critical: 1,
  Major: 2,
  Minor: 3,
  Trivial: 4,
};

const DEFAULT_STATUS_ORDER: Record<string, number> = {
  New: 0, ASSIGNED: 1, 'In Progress': 2, POST: 3, MODIFIED: 4, ON_QA: 5,
};

const SORTABLE_COLUMNS: { id: SortColumn; label: string; tooltip: string; center?: boolean }[] = [
  { id: 'key', label: 'Key', tooltip: 'Ticket key' },
  { id: 'type', label: 'T', tooltip: 'Issue type', center: true },
  { id: 'priority', label: 'P', tooltip: 'Priority', center: true },
  { id: 'sp', label: 'SP', tooltip: 'Story points' },
  { id: 'status', label: 'Status', tooltip: 'Jira status' },
];

type IconElement = { icon: typeof ShieldAlert; className: string };

function typeIcon(type: string): IconElement {
  switch (type) {
    case 'Bug': return { icon: Bug, className: 'jira-icon jira-icon--bug' };
    case 'Story': return { icon: BookOpen, className: 'jira-icon jira-icon--story' };
    case 'Epic': return { icon: Zap, className: 'jira-icon jira-icon--epic' };
    case 'Feature Request': return { icon: Asterisk, className: 'jira-icon jira-icon--feature' };
    default: return { icon: Minus, className: 'jira-icon jira-icon--muted' };
  }
}

function priorityIcon(priority: string): IconElement {
  switch (priority) {
    case 'Blocker': return { icon: ShieldAlert, className: 'jira-icon jira-icon--blocker' };
    case 'Critical': return { icon: ChevronsUp, className: 'jira-icon jira-icon--critical' };
    case 'Major': return { icon: ChevronUp, className: 'jira-icon jira-icon--major' };
    case 'Minor':
    case 'Normal': return { icon: Minus, className: 'jira-icon jira-icon--normal' };
    case 'Low':
    case 'Trivial': return { icon: ChevronDown, className: 'jira-icon jira-icon--low' };
    default: return { icon: CircleSlash, className: 'jira-icon jira-icon--undefined' };
  }
}

function compareStrings(a: string, b: string, direction: SortDirection): number {
  const result = a.localeCompare(b, undefined, { sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

function compareTickets(
  a: JiraTicket,
  b: JiraTicket,
  column: SortColumn,
  direction: SortDirection,
): number {
  switch (column) {
    case 'key':
      return compareStrings(a.key, b.key, direction);
    case 'type':
      return compareStrings(a.type, b.type, direction);
    case 'priority': {
      const rankA = PRIORITY_RANK[a.priority] ?? 99;
      const rankB = PRIORITY_RANK[b.priority] ?? 99;
      const result = rankA - rankB;
      return direction === 'asc' ? result : -result;
    }
    case 'sp': {
      const spA = a.storyPoints;
      const spB = b.storyPoints;
      if (spA == null && spB == null) return 0;
      if (spA == null) return 1;
      if (spB == null) return -1;
      const result = spA - spB;
      return direction === 'asc' ? result : -result;
    }
    case 'status':
      return compareStrings(a.status, b.status, direction);
    default:
      return 0;
  }
}

const JiraBacklog: FC<JiraBacklogProps> = ({
  tickets,
  loading,
  lastRefreshed,
  onRefresh,
  onOpenUrl,
  onStartWork,
}) => {
  const [assignedToMe, setAssignedToMe] = useState(true);
  const [newOnly, setNewOnly] = useState(false);
  const [sprintFilter, setSprintFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [fixVersionFilter, setFixVersionFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sprints = useMemo(() => {
    const set = new Set(tickets.map((t) => t.sprint).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [tickets]);

  const statuses = useMemo(() => {
    const set = new Set(tickets.map((t) => t.status));
    return Array.from(set).sort();
  }, [tickets]);

  const fixVersions = useMemo(() => {
    const set = new Set(tickets.flatMap((t) => t.fixVersions));
    return Array.from(set).sort();
  }, [tickets]);

  const types = useMemo(() => {
    const set = new Set(tickets.map((t) => t.type));
    return Array.from(set).sort();
  }, [tickets]);

  const priorities = useMemo(() => {
    const set = new Set(tickets.map((t) => t.priority));
    return Array.from(set).sort();
  }, [tickets]);

  const NEW_ONLY_STATUSES = new Set(['New', 'ASSIGNED']);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (newOnly && !NEW_ONLY_STATUSES.has(t.status)) return false;
      if (sprintFilter.length > 0 && (!t.sprint || !sprintFilter.includes(t.sprint))) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(t.status)) return false;
      if (fixVersionFilter.length > 0 && !t.fixVersions.some((v) => fixVersionFilter.includes(v))) {
        return false;
      }
      if (typeFilter.length > 0 && !typeFilter.includes(t.type)) return false;
      if (priorityFilter.length > 0 && !priorityFilter.includes(t.priority)) return false;
      return true;
    });
  }, [tickets, newOnly, sprintFilter, statusFilter, fixVersionFilter, typeFilter, priorityFilter]);

  const sorted = useMemo(() => {
    if (sortColumn) {
      return [...filtered].sort((a, b) => compareTickets(a, b, sortColumn, sortDirection));
    }
    return [...filtered].sort((a, b) => {
      const statusA = DEFAULT_STATUS_ORDER[a.status] ?? 5;
      const statusB = DEFAULT_STATUS_ORDER[b.status] ?? 5;
      if (statusA !== statusB) return statusA - statusB;
      return (PRIORITY_RANK[a.priority] ?? 5) - (PRIORITY_RANK[b.priority] ?? 5);
    });
  }, [filtered, sortColumn, sortDirection]);

  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
      return;
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc');
      return;
    }

    setSortColumn(null);
    setSortDirection('asc');
  }, [sortColumn, sortDirection]);

  const handleAssigneeToggle = useCallback(() => {
    const next = !assignedToMe;
    setAssignedToMe(next);
    onRefresh(next);
  }, [assignedToMe, onRefresh]);

  const handleClick = useCallback(
    (key: string) => onOpenUrl(`${JIRA_BASE}/${key}`),
    [onOpenUrl],
  );

  const renderSortIndicator = (column: SortColumn): string | null => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  return (
    <AccordionSection
      title="Jira Backlog"
      count={filtered.length}
      defaultOpen={false}
      meta={lastRefreshed ? `Last refreshed: ${lastRefreshed}` : undefined}
      actions={
        <RefreshButton loading={loading} onRefresh={() => onRefresh(assignedToMe)} title="Refresh Jira" />
      }
    >
      {tickets.length > 0 && (
        <div className="filter-bar">
          <label className="filter-bar__toggle" title="Show only tickets assigned to me">
            <input
              type="checkbox"
              checked={assignedToMe}
              onChange={handleAssigneeToggle}
            />
            <span>Assigned to me</span>
          </label>
          <label className="filter-bar__toggle" title="Show only New and Assigned tickets (no PR yet)">
            <input
              type="checkbox"
              checked={newOnly}
              onChange={() => setNewOnly((prev) => !prev)}
            />
            <span>New only</span>
          </label>
          {sprints.length > 0 && (
            <MultiSelectFilter
              label="Sprint"
              options={sprints}
              selected={sprintFilter}
              onChange={setSprintFilter}
            />
          )}
          {statuses.length > 1 && (
            <MultiSelectFilter
              label="Status"
              options={statuses}
              selected={statusFilter}
              onChange={setStatusFilter}
            />
          )}
          {fixVersions.length > 1 && (
            <MultiSelectFilter
              label="Version"
              options={fixVersions}
              selected={fixVersionFilter}
              onChange={setFixVersionFilter}
            />
          )}
          {types.length > 1 && (
            <MultiSelectFilter
              label="Type"
              options={types}
              selected={typeFilter}
              onChange={setTypeFilter}
            />
          )}
          {priorities.length > 1 && (
            <MultiSelectFilter
              label="Priority"
              options={priorities}
              selected={priorityFilter}
              onChange={setPriorityFilter}
            />
          )}
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="empty-state">
          {tickets.length === 0 ? 'No assigned tickets' : 'No tickets match filters'}
        </p>
      ) : (
        <div className="data-table">
          <div
            className="data-table__head data-table__head--sortable"
            style={{ gridTemplateColumns: JIRA_COLUMNS }}
          >
            {SORTABLE_COLUMNS.map(({ id, label, tooltip, center }) => {
              const indicator = renderSortIndicator(id);
              return (
                <span
                  key={id}
                  data-sortable="true"
                  onClick={() => handleSort(id)}
                  title={`${tooltip} (click to sort)`}
                  style={center ? { textAlign: 'center' } : undefined}
                >
                  {label}
                  {indicator && <span className="sort-indicator">{indicator}</span>}
                </span>
              );
            })}
            <span />
          </div>
          {sorted.map((t) => (
            <div
              key={t.key}
              className={`data-table__row jira-item ${t.tracked ? 'ticket-row--tracked' : ''}`}
              style={{ gridTemplateColumns: JIRA_COLUMNS }}
            >
              <HoverCard title={t.summary} description={t.description}>
                <span
                  className="jira-item__key clickable"
                  onClick={() => handleClick(t.key)}
                >
                  {t.key}
                </span>
              </HoverCard>
              {(() => {
                const { icon: TypeIcon, className } = typeIcon(t.type);
                return (
                  <span className="jira-icon-wrap" title={t.type}>
                    <TypeIcon size={14} className={className} aria-label={t.type} />
                  </span>
                );
              })()}
              {(() => {
                const { icon: PriorityIcon, className } = priorityIcon(t.priority);
                return (
                  <span className="jira-icon-wrap" title={t.priority}>
                    <PriorityIcon size={14} className={className} aria-label={t.priority} />
                  </span>
                );
              })()}
              <span className="jira-item__sp">{t.storyPoints ?? '—'}</span>
              <span className="jira-item__status">{t.status}</span>
              <HoverCard title={`Start work on ${t.key}`}>
                <button
                  className="icon-button icon-button--play"
                  onClick={() => onStartWork(t.key)}
                >
                  <GitPullRequestCreate size={14} />
                </button>
              </HoverCard>
            </div>
          ))}
        </div>
      )}
    </AccordionSection>
  );
};

export default JiraBacklog;
