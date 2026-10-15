/**
 * A segmented control that is a radio group underneath: one tab stop, arrow keys move the
 * selection, and every option is a 24 px+ target with a visible label.
 */
import type { ComponentChildren } from 'preact';
import { useRadioGroup } from './useRadioGroup.ts';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ComponentChildren;
  /** Accessible name when the visible label isn't enough. */
  ariaLabel?: string;
}

export interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  class?: string;
  id?: string;
}

export function Segmented<T extends string | number>(props: SegmentedProps<T>) {
  const group = useRadioGroup(
    props.options.map((o) => o.value),
    props.value,
    props.onChange,
  );

  return (
    <div
      class={`segmented ${props.class ?? ''}`}
      role="radiogroup"
      aria-label={props.label}
      id={props.id}
      onKeyDown={group.onKeyDown}
    >
      {props.options.map((option, i) => (
        <button
          key={String(option.value)}
          {...group.option(i)}
          type="button"
          aria-label={option.ariaLabel}
          class="segmented-option"
          onClick={() => {
            props.onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
