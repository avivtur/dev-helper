import { useState, useRef, useEffect, useCallback, type FC, type MouseEvent } from 'react';

type MultiSelectFilterProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

const MultiSelectFilter: FC<MultiSelectFilterProps> = ({
  label,
  options,
  selected,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event: Event): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const stopPropagation = useCallback((e: MouseEvent): void => {
    e.stopPropagation();
  }, []);

  const toggleOpen = useCallback((e: MouseEvent): void => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  const handleToggleOption = useCallback(
    (option: string) => {
      if (selected.includes(option)) {
        onChange(selected.filter((value) => value !== option));
        return;
      }
      onChange([...selected, option]);
    },
    [onChange, selected],
  );

  const handleSelectAll = useCallback(
    (e: MouseEvent): void => {
      e.stopPropagation();
      onChange([...options]);
    },
    [onChange, options],
  );

  const handleClear = useCallback(
    (e: MouseEvent): void => {
      e.stopPropagation();
      onChange([]);
    },
    [onChange],
  );

  const triggerLabel = selected.length > 0 ? `${label} (${selected.length})` : label;

  return (
    <div
      ref={rootRef}
      className="multi-select-filter"
      onClick={stopPropagation}
    >
      <button
        type="button"
        className="multi-select-filter__trigger"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {triggerLabel}
      </button>
      {open && (
        <div className="multi-select-filter__panel" role="listbox" aria-multiselectable="true">
          <div className="multi-select-filter__actions">
            <button type="button" className="multi-select-filter__action" onClick={handleSelectAll}>
              Select all
            </button>
            <button type="button" className="multi-select-filter__action" onClick={handleClear}>
              Clear
            </button>
          </div>
          {options.map((option) => (
            <label key={option} className="multi-select-filter__option">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => handleToggleOption(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectFilter;
