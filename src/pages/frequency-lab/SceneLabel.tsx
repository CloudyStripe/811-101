/**
 * A label on something in the 3D view. The scene's label layer positions it and owns its classes
 * (`off`, `compact`, `capped`), so this component keeps its own state in data attributes. Hovering,
 * focusing or tapping it shows a one-line definition, kept inside the view.
 */
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { labelDefinition } from '../../../content/training/frequency-lab.ts';
import { APWA } from '../../design/apwa.ts';
import { Icon } from '../../design/icons.tsx';
import { useTip } from '../../design/useTip.ts';
import type { SetupId } from '../../signal/model.ts';
import { CARRIER, type LabelSpec } from './scene/labels.ts';

const GAP = 6;
const EDGE = 8;

export function SceneLabel({
  spec,
  setup,
  register,
}: {
  spec: LabelSpec;
  setup: SetupId;
  register: (element: HTMLDivElement | null) => void;
}) {
  const tip = useTip<HTMLDivElement>();
  const tipId = useId();
  const tipRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ shift: 0, above: false });
  const text = spec.text[setup];

  // The tip goes below its label, or above it, wherever it stays inside the view and clear of the
  // page's controls; it slides sideways to fit.
  useLayoutEffect(() => {
    const label = tip.ref.current;
    const box = label?.parentElement?.getBoundingClientRect();
    const t = tipRef.current;
    if (!tip.open || !label || !box || !t) return;
    const l = label.getBoundingClientRect();
    const width = t.offsetWidth;
    const height = t.offsetHeight;
    const center = l.left + l.width / 2;
    const chrome = [...document.querySelectorAll('[data-chrome]')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    /** Where the tip's left edge goes with its top here, or null if it can't fit there. */
    const fit = (top: number): number | null => {
      if (top < box.top + EDGE || top + height > box.bottom - EDGE) return null;
      let lo = box.left + EDGE;
      let hi = box.right - EDGE;
      for (const c of chrome) {
        if (c.bottom <= top || c.top >= top + height) continue;
        if (c.right <= center) lo = Math.max(lo, c.right + EDGE);
        else if (c.left >= center) hi = Math.min(hi, c.left - EDGE);
        else return null;
      }
      return hi - lo < width ? null : Math.max(lo, Math.min(center - width / 2, hi - width));
    };
    const below = fit(l.bottom + GAP);
    const above = below === null ? fit(l.top - GAP - height) : null;
    const left =
      below ??
      above ??
      Math.max(box.left + EDGE, Math.min(center - width / 2, box.right - EDGE - width));
    setPlace({ shift: Math.round(left - (center - width / 2)), above: above !== null });
  }, [tip.open, tip.ref]);

  return (
    <div
      class="lbl off"
      data-label={spec.id}
      // What carries the signal is the label to read first.
      data-tier={CARRIER[setup] === spec.id ? 'current' : 'context'}
      data-tip={tip.open ? 'open' : undefined}
      hidden={text === null}
      ref={(element) => {
        tip.ref.current = element;
        register(element);
      }}
      {...tip.handlers}
    >
      <button type="button" class="lbl-btn" aria-describedby={tipId} onClick={tip.toggle}>
        <span
          class={`lbl-icon${spec.color ? ' lbl-icon-facility' : ''}`}
          style={spec.color ? { '--chip': APWA[spec.color].fill } : undefined}
        >
          <Icon name={spec.icon} />
        </span>
        <span class="lbl-text">{text}</span>
      </button>
      <div
        id={tipId}
        ref={tipRef}
        role="tooltip"
        class={`lbl-tip${place.above ? ' above' : ''}`}
        style={{ '--shift': `${String(place.shift)}px` }}
        hidden={!tip.open}
      >
        {labelDefinition(spec.id, setup).text}
      </div>
    </div>
  );
}
