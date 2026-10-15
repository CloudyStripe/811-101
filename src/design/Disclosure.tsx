/**
 * A section that can fold away: its heading holds a button that opens and closes it, so screen
 * readers reach it by heading and hear whether it's open. An icon sits beside the heading.
 */
import type { ComponentChildren } from 'preact';
import { useId, useState } from 'preact/hooks';
import { Icon, type IconName } from './icons.tsx';

export function Disclosure({
  icon,
  title,
  open = true,
  children,
}: {
  icon: IconName;
  title: string;
  /** Whether it starts open. After that, it's the reader's to open and close. */
  open?: boolean;
  children: ComponentChildren;
}) {
  const [isOpen, setOpen] = useState(open);
  const body = useId();
  return (
    <section class="disclosure" data-open={isOpen ? '' : undefined}>
      <h3 class="disclosure-heading">
        <button
          type="button"
          class="disclosure-summary"
          aria-expanded={isOpen}
          aria-controls={body}
          onClick={() => {
            setOpen(!isOpen);
          }}
        >
          <span class="disclosure-icon" aria-hidden="true">
            <Icon name={icon} />
          </span>
          <span class="disclosure-title">{title}</span>
          <Icon name="chevron-down" class="icon disclosure-chevron" />
        </button>
      </h3>
      <div class="disclosure-body" id={body} hidden={!isOpen}>
        {children}
      </div>
    </section>
  );
}
