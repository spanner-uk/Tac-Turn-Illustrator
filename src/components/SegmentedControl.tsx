import type { KeyboardEvent } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  className?: string;
  name: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange(value: T): void;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  className = "",
  name,
  options,
  value,
  onChange
}: SegmentedControlProps<T>) {
  const handleKey = (event: KeyboardEvent<HTMLSpanElement>, optionValue: T) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onChange(optionValue);
    }
  };

  return (
    <div className={`segmented ${className}`.trim()} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span tabIndex={0} title={option.title} onKeyDown={(event) => handleKey(event, option.value)}>
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
