/**
 * A modal dialog on the native <dialog>: the browser traps focus and closes it on Escape. Focus
 * returns to whatever opened it, and a click on the backdrop closes it too.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { Icon } from './icons.tsx';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ComponentChildren;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnTo.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      class="dialog"
      aria-labelledby={titleId}
      onClose={() => {
        onClose();
        returnTo.current?.focus();
      }}
      onClick={(event) => {
        // The dialog's own box is only the backdrop: its content fills an inner wrapper.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div class="dialog-body">
        <div class="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            class="icon-button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
