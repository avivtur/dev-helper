import { useState, useRef, useCallback, type FC, type ReactNode } from 'react';

type HoverCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

const HOVER_DELAY_MS = 300;

const HoverCard: FC<HoverCardProps> = ({ title, description, children }) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), HOVER_DELAY_MS);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  return (
    <span
      className="hover-card-anchor"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && (
        <div className="hover-card">
          <div className="hover-card__title">{title}</div>
          {description && (
            <div className="hover-card__desc">{description}</div>
          )}
        </div>
      )}
    </span>
  );
};

export default HoverCard;
