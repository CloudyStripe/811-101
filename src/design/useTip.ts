/**
 * Content that shows on hover or focus, the way WCAG 1.4.13 asks: the pointer can move onto it
 * without it closing, Escape dismisses it without moving focus, and it stays until hover and
 * focus leave or it's dismissed. A click or tap pins it open, so it works on touch too.
 */
import { useEffect, useRef, useState } from 'preact/hooks';

/** Grace period for the pointer to cross from the trigger to the tip. */
const LEAVE_DELAY_MS = 120;

export function useTip<T extends HTMLElement>() {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const ref = useRef<T>(null);
  const leaveTimer = useRef(0);
  const open = !dismissed && (pinned || hover || focus);

  // A pinned tip closes when the pointer goes down anywhere else.
  useEffect(() => {
    if (!pinned) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setPinned(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('pointerdown', onDown);
    };
  }, [pinned]);

  // Once hover, focus and pin have all gone, a dismissed tip can open again next time.
  useEffect(() => {
    if (!hover && !focus && !pinned) setDismissed(false);
  }, [hover, focus, pinned]);

  useEffect(
    () => () => {
      clearTimeout(leaveTimer.current);
    },
    [],
  );

  /** Spread on the element that holds both the trigger and the tip, and give it `ref`. */
  const handlers = {
    onPointerEnter(event: PointerEvent) {
      if (event.pointerType === 'touch') return;
      clearTimeout(leaveTimer.current);
      setHover(true);
    },
    onPointerLeave(event: PointerEvent) {
      if (event.pointerType === 'touch') return;
      leaveTimer.current = window.setTimeout(() => {
        setHover(false);
      }, LEAVE_DELAY_MS);
    },
    onFocusIn() {
      setFocus(true);
    },
    onFocusOut(event: FocusEvent) {
      if (!ref.current?.contains(event.relatedTarget as Node | null)) setFocus(false);
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !open) return;
      event.stopPropagation();
      setDismissed(true);
      setPinned(false);
    },
  };

  /** For the trigger's click: pins the tip open, or closes a pinned one. */
  function toggle() {
    if (open && pinned) {
      setPinned(false);
      setDismissed(true);
    } else {
      setPinned(true);
      setDismissed(false);
    }
  }

  return { open, ref, handlers, toggle };
}
