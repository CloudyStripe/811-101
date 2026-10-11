/** The key: what each line, color and glow in the 3D view means. */
import { KEY } from '../../../content/training/frequency-lab.ts';
import { APWA } from '../../design/apwa.ts';
import { Icon } from '../../design/icons.tsx';
import type { SetupId } from '../../signal/model.ts';
import { LABEL_SPECS } from './scene/labels.ts';

export function Legend({ setup }: { setup: SetupId }) {
  // The lines are exactly the labels that carry an APWA color, named the same way.
  const lines = LABEL_SPECS.flatMap((spec) => {
    const name = spec.text[setup];
    return spec.color && name ? [{ id: spec.id, name, icon: spec.icon, color: spec.color }] : [];
  });

  return (
    <div class="legend">
      <ul class="legend-list">
        {lines.map((line) => (
          <li key={line.id}>
            <span class="chip" style={{ '--chip': APWA[line.color].fill }} aria-hidden="true">
              <Icon name={line.icon} />
            </span>
            {line.name}
          </li>
        ))}
      </ul>
      <ul class="legend-list">
        <li>
          <span class="sym sym-signal" aria-hidden="true" />
          {KEY.signal}
        </li>
        <li>
          <span class="sym sym-soil" aria-hidden="true" />
          {KEY.soil}
        </li>
      </ul>
      <p class="muted">{KEY.colors.text}</p>
    </div>
  );
}
