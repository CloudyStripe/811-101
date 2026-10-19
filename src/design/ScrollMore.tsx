/**
 * A scrolling body that shows when there's more of it below than shows: its foot fades out, and a
 * More button there scrolls on, most of a screenful (at once where motion is reduced). Pressed to
 * the end, where it goes, More hands focus to the body, so focus stays where it was (Escape and the
 * like still reach it) and the arrow keys go on scrolling. The lab's drawer and the diorama's guide
 * both use it; components.css styles it.
 */
import type { ComponentChildren, RefObject } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons.tsx';

/** Whether the page asks for reduced motion: the reader's own setting (on <html>), else the OS's. */
function motionReduced(): boolean {
  const chosen = document.documentElement.dataset.motion;
  if (chosen === 'reduce') return true;
  if (chosen === 'full') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ScrollMore(props: {
  /** The body's own class, for its padding and the like. */
  class: string;
  id?: string;
  /** The More button's name for assistive tech, beginning with the More it shows. */
  label: string;
  /** The scrolling body, for its owner to scroll back to the top. */
  bodyRef?: RefObject<HTMLDivElement | null>;
  children: ComponentChildren;
}) {
  const own = useRef<HTMLDivElement>(null);
  const body = props.bodyRef ?? own;
  const button = useRef<HTMLButtonElement>(null);
  /** There's more of the body below what shows. */
  const [more, setMore] = useState(false);

  // Whether there's more below, as it's scrolled, resized or its contents change; checked before
  // it shows, so it never shows a cue that's out of date.
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    // The body's size and each of its children's: a change within a child, as text that wraps
    // anew, shows as the child's size. (Not every change within: a clock ticking in it, as the
    // diorama's time-lapse has, would have it measured every frame.)
    const sizes = new ResizeObserver(() => {
      check();
    });
    const watch = () => {
      sizes.disconnect();
      sizes.observe(el);
      for (const child of el.children) sizes.observe(child);
    };
    let scrollbar = '';
    function check() {
      if (!el) return;
      const below = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      // More is going: focus it had stays put, on the body.
      if (!below && document.activeElement === button.current) {
        el.focus({ preventScroll: true });
      }
      // The fade leaves the body's own scrollbar, where it has one, as it is.
      const width = `${String(el.offsetWidth - el.clientWidth)}px`;
      if (width !== scrollbar) {
        scrollbar = width;
        el.style.setProperty('--scrollbar', width);
      }
      setMore(below);
    }
    // A child come or gone is watched in turn.
    const children = new MutationObserver(() => {
      watch();
      check();
    });
    watch();
    check();
    el.addEventListener('scroll', check, { passive: true });
    children.observe(el, { childList: true });
    return () => {
      el.removeEventListener('scroll', check);
      sizes.disconnect();
      children.disconnect();
    };
  }, []);

  return (
    <div class="scroll-more">
      <div
        class={props.class}
        id={props.id}
        ref={body}
        tabIndex={-1}
        data-more={more ? '' : undefined}
      >
        {props.children}
      </div>
      <button
        ref={button}
        type="button"
        class="button button-secondary scroll-more-button"
        aria-label={props.label}
        hidden={!more}
        onClick={() => {
          const el = body.current;
          if (!el) return;
          el.scrollBy({
            top: el.clientHeight * 0.75,
            behavior: motionReduced() ? 'auto' : 'smooth',
          });
        }}
      >
        More
        <Icon name="chevron-down" />
      </button>
    </div>
  );
}
