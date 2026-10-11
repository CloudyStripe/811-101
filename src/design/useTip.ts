/**
 * Content that shows on hover or focus, the way WCAG 1.4.13 asks: the pointer can move onto it
 * without it closing, Escape dismisses it without moving focus, and it stays until hover and
 * focus leave or it's dismissed. A click or tap pins it open, so it works on touch too.
 *
 * Only one tip is open at a time, so tips never pile up over the control that has focus.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

/** Grace period for the pointer to cross from the trigger to the tip. */
const LEAVE_DELAY_MS = 120;

/** Closes the tip that's open now, if any. */
let closeOpenTip: (() => void) | null = null;
let listening = false;

/**
 * Escape closes the open tip wherever focus is. This listens first (capture), so the Escape
 * goes no further: a tip inside a dialog closes without closing the dialog.
 */
function listenForEscape(): void {
  if (listening) return;
  listening = true;
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !closeOpenTip) return;
      event.preventDefault();
      event.stopPropagation();
      closeOpenTip();
    },
    true,
  );
}

export function useTip<T extends HTMLElement>() {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const ref = useRef<T>(null);
  const leaveTimer = useRef(0);
  const open = !dismissed && (pinned || hover || focus);

  const close = useCallback(() => {
    setDismissed(true);
    setPinned(false);
  }, []);

  // Opening this tip closes any other.
  useEffect(() => {
    if (!open) return;
    listenForEscape();
    if (closeOpenTip && closeOpenTip !== close) closeOpenTip();
    closeOpenTip = close;
    return () => {
      if (closeOpenTip === close) closeOpenTip = null;
    };
  }, [open, close]);

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
      if (!ref.current?.contains(event.relatedTarget as Node | null)) {
        setFocus(false);
        setPinned(false);
      }
    },
  };

  /**
   * For the trigger's click. A pointer click or tap pins the tip open, or closes a pinned one.
   * Enter and Space do nothing more: focus already shows the tip, and Escape hides it.
   */
  function toggle(event: MouseEvent) {
    if (event.detail === 0) return;
    if (open && pinned) {
      close();
    } else {
      setPinned(true);
      setDismissed(false);
    }
  }

  return { open, ref, handlers, toggle };
}
