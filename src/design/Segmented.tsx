/**
 * A segmented control that is a radio group underneath: one tab stop, arrow keys move the
 * selection, and every option is a 24 px+ target with a visible label.
 */
import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';

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
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    props.options.findIndex((o) => o.value === props.value),
  );

  function move(to: number) {
    const n = props.options.length;
    const next = ((to % n) + n) % n;
    const option = props.options[next];
    if (!option) return;
    props.onChange(option.value);
    refs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent) {
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: props.options.length - 1,
    };
    const to = keys[event.key];
    if (to === undefined) return;
    event.preventDefault();
    move(to);
  }

  return (
    <div
      class={`segmented ${props.class ?? ''}`}
      role="radiogroup"
      aria-label={props.label}
      id={props.id}
      onKeyDown={onKeyDown}
    >
      {props.options.map((option, i) => {
        const checked = i === index;
        return (
          <button
            key={String(option.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            tabIndex={checked ? 0 : -1}
            class="segmented-option"
            onClick={() => {
              props.onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
