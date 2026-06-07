import type { FC } from 'react';

type SetupCheck = {
  id: string;
  label: string;
  passed: boolean;
  setupRef: string;
};

type SetupChecklistProps = {
  checks: SetupCheck[];
};

const SETUP_PATH = '.cursor/skills/dev-helper/SETUP.md';

const SetupChecklist: FC<SetupChecklistProps> = ({ checks }) => {
  const failing = checks.filter((c) => !c.passed);

  if (failing.length === 0) return null;

  return (
    <div className="setup-checklist">
      <div className="setup-checklist__header">
        Setup incomplete — {failing.length} prerequisite{failing.length !== 1 ? 's' : ''} missing
      </div>
      <div className="setup-checklist__items">
        {checks.map((check) => (
          <div
            key={check.id}
            className={`setup-checklist__item ${check.passed ? 'setup-checklist__item--pass' : 'setup-checklist__item--fail'}`}
          >
            <span className="setup-checklist__icon">
              {check.passed ? '✓' : '✗'}
            </span>
            <span className="setup-checklist__label">{check.label}</span>
            {!check.passed && (
              <span className="setup-checklist__ref">
                → {check.setupRef}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="setup-checklist__footer">
        Full guide: <code>{SETUP_PATH}</code>
      </div>
    </div>
  );
};

export default SetupChecklist;
