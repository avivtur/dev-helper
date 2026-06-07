import type { FC } from 'react';
import { RefreshCw } from 'lucide-react';

type RefreshButtonProps = {
  loading: boolean;
  onRefresh: () => void;
  title?: string;
};

const RefreshButton: FC<RefreshButtonProps> = ({ loading, onRefresh, title = 'Refresh' }) => (
  <button
    type="button"
    className={`icon-button${loading ? ' icon-button--spinning' : ''}`}
    onClick={onRefresh}
    disabled={loading}
    title={title}
    aria-label={title}
  >
    <RefreshCw size={14} />
  </button>
);

export default RefreshButton;
