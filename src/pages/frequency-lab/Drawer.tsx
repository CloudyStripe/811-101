/**
 * Where the guide or the key opens: between the view and the console, so it never covers the
 * lines, and one at a time. It has its own heading and a button that closes it, and Escape closes
 * it from anywhere in it. Opening it moves focus to its heading, so it's read first and Tab goes
 * on through it. While there's more of it below than shows, its foot fades out, and a More button
 * there scrolls on to it, so it's plain that the drawer scrolls. Pressed to the end, where it goes,
 * More hands focus to the drawer's body, so focus stays in the drawer (Escape still closes it) and
 * the arrow keys go on scrolling it.
 */
import type { ComponentChildren } from 'preact';
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { reducesMotion } from '../../site/settings.ts';
import { useSettings } from '../../site/useSettings.ts';
import { Icon } from '../../design/icons.tsx';

export interface DrawerProps {
  id: string;
  /** The open drawer's heading, or null when it's closed. */
  title: string | null;
  /** The close button's name, for the eye (its tip) and assistive tech alike. */
  closeLabel: string;
  /** The More button's name for assistive tech, beginning with the More it shows. */
  moreLabel: string;
  onClose: () => void;
  children: ComponentChildren;
}

export function Drawer(props: DrawerProps) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const open = props.title !== null;
  const [settings] = useSettings();
  /** There's more of the drawer below what shows. */
  const [more, setMore] = useState(false);

  // Each opening starts at the top: the guide and the key share the drawer, not where it was read to.
  useLayoutEffect(() => {
    if (!open) return;
    if (body.current) body.current.scrollTop = 0;
    heading.current?.focus();
  }, [props.title]);

  // Whether there's more below, as it's scrolled, resized or its words change: checked before the
  // drawer shows, so it never shows a cue that's out of date.
  useLayoutEffect(() => {
    const el = body.current;
    if (!open || !el) return;
    const check = () => {
      const below = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      // More is going: focus it had stays in the drawer, on its body.
      if (!below && document.activeElement === moreButton.current) {
        el.focus({ preventScroll: true });
      }
      // The fade leaves the body's own scrollbar, where it has one, as it is.
      el.style.setProperty('--scrollbar', `${String(el.offsetWidth - el.clientWidth)}px`);
      setMore(below);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    const sizes = new ResizeObserver(check);
    sizes.observe(el);
    for (const child of el.children) sizes.observe(child);
    return () => {
      el.removeEventListener('scroll', check);
      sizes.disconnect();
    };
  }, [open, props.title]);

  return (
    <section
      id={props.id}
      class="lab-drawer"
      aria-labelledby={headingId}
      hidden={!open}
      data-chrome
      onKeyDown={(event) => {
        // A term's tip takes Escape first, and closes; only the next Escape closes the drawer.
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        props.onClose();
      }}
    >
      <div class="drawer-head">
        <h2 id={headingId} class="drawer-title" tabIndex={-1} ref={heading}>
          {props.title}
        </h2>
        <button
          type="button"
          class="icon-button"
          aria-label={props.closeLabel}
          title={props.closeLabel}
          onClick={props.onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div class="drawer-body" ref={body} tabIndex={-1} data-more={more ? '' : undefined}>
        {props.children}
      </div>
      {/* Most of a screenful further on, at once where motion is reduced. */}
      <button
        ref={moreButton}
        type="button"
        class="button button-secondary drawer-more"
        aria-label={props.moreLabel}
        hidden={!more}
        onClick={() => {
          const el = body.current;
          if (!el) return;
          const reduce = reducesMotion(
            settings.motion,
            matchMedia('(prefers-reduced-motion: reduce)').matches,
          );
          el.scrollBy({ top: el.clientHeight * 0.75, behavior: reduce ? 'auto' : 'smooth' });
        }}
      >
        More
        <Icon name="chevron-down" />
      </button>
    </section>
  );
}
