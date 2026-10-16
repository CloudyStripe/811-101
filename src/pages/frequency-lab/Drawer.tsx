/**
 * Where the guide or the key opens: between the view and the console, so it never covers the
 * lines, and one at a time. It has its own heading and a button that closes it, and Escape closes
 * it from anywhere in it. Opening it moves focus to its heading, so it's read first and Tab goes
 * on through it.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { Icon } from '../../design/icons.tsx';

export interface DrawerProps {
  id: string;
  /** The open drawer's heading, or null when it's closed. */
  title: string | null;
  /** The close button's name, for the eye (its tip) and assistive tech alike. */
  closeLabel: string;
  onClose: () => void;
  children: ComponentChildren;
}

export function Drawer(props: DrawerProps) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const open = props.title !== null;

  useEffect(() => {
    if (open) heading.current?.focus();
  }, [props.title]);

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
      <div class="drawer-body">{props.children}</div>
    </section>
  );
}
