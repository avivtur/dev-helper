import { type FC, type ReactNode } from 'react';

type AccordionSectionProps = {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  actions?: ReactNode;
  meta?: string;
  children: ReactNode;
};

const AccordionSection: FC<AccordionSectionProps> = ({
  title,
  count,
  defaultOpen = false,
  actions,
  meta,
  children,
}) => (
  <details className="accordion-section" open={defaultOpen || undefined}>
    <summary className="accordion-section__header">
      <span className="accordion-section__title">
        {title}
        {count !== undefined && <span className="accordion-section__count">({count})</span>}
      </span>
      {(meta || actions) && (
        <span className="accordion-section__actions" onClick={(e) => e.preventDefault()}>
          {meta && <span className="accordion-section__meta">{meta}</span>}
          {actions}
        </span>
      )}
    </summary>
    <div className="accordion-section__body">
      {children}
    </div>
  </details>
);

export default AccordionSection;
