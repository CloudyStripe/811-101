/**
 * A label on something in the 3D view. The scene's label layer positions it and owns its classes
 * (`off`, `compact`), so this component keeps its own state in data attributes. Hovering,
 * focusing or tapping it shows a one-line definition, kept inside the view.
 */
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { labelDefinition } from '../../../content/training/frequency-lab.ts';
import { APWA } from '../../design/apwa.ts';
import { Icon } from '../../design/icons.tsx';
import { useTip } from '../../design/useTip.ts';
import type { SetupId } from '../../signal/model.ts';
import type { LabelSpec } from './scene/labels.ts';

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

  useLayoutEffect(() => {
    const label = tip.ref.current;
    const box = label?.parentElement?.getBoundingClientRect();
    const t = tipRef.current;
    if (!tip.open || !label || !box || !t) return;
    const l = label.getBoundingClientRect();
    const width = t.offsetWidth;
    const center = l.left + l.width / 2;
    const left = Math.max(box.left + EDGE, Math.min(center - width / 2, box.right - EDGE - width));
    const fitsBelow = l.bottom + GAP + t.offsetHeight <= box.bottom - EDGE;
    setPlace({ shift: Math.round(left - (center - width / 2)), above: !fitsBelow });
  }, [tip.open, tip.ref]);

  return (
    <div
      class="lbl off"
      data-label={spec.id}
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
