/**
 * A radio group's keyboard: one tab stop (the checked option), arrow keys move the choice and the
 * focus with it, and Home and End jump to the ends. The segmented control is built on it.
 */
import { useRef } from 'preact/hooks';

export function useRadioGroup<T>(values: readonly T[], value: T, onChange: (value: T) => void) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const index = Math.max(0, values.indexOf(value));

  /** Chooses the option at `to` (wrapping round) and moves focus to it. */
  function move(to: number) {
    const n = values.length;
    const next = ((to % n) + n) % n;
    const option = values[next];
    if (option === undefined) return;
    onChange(option);
    refs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent) {
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: values.length - 1,
    };
    const to = keys[event.key];
    if (to === undefined) return;
    event.preventDefault();
    move(to);
  }

  /** The props each option's element needs: its role, its state, and its place in the tab order. */
  function option(i: number) {
    return {
      ref: (el: HTMLElement | null) => {
        refs.current[i] = el;
      },
      role: 'radio' as const,
      'aria-checked': i === index,
      tabIndex: i === index ? 0 : -1,
    };
  }

  return { index, move, onKeyDown, option };
}
