/**
 * The key: what each line, color and glow in the 3D view means. Beside the view on wide screens,
 * each line's row also finds it: pointing at the row shows the line's label in the view, and
 * pressing it moves focus to that label, which tells what the line is.
 */
import { KEY } from '../../../content/training/frequency-lab.ts';
import { APWA } from '../../design/apwa.ts';
import { Icon } from '../../design/icons.tsx';
import type { SetupId } from '../../signal/model.ts';
import { LABEL_SPECS, type LabelId } from './scene/labels.ts';

export interface LegendFind {
  /** Shows a line's label while its row is pointed at or focused; null when it isn't. */
  onHighlight: (id: LabelId | null) => void;
  /** Moves focus to a line's label in the view. */
  onShow: (id: LabelId) => void;
}

export function Legend({ setup, find }: { setup: SetupId; find?: LegendFind }) {
  // The lines are exactly the labels that carry an APWA color, named the same way.
  const lines = LABEL_SPECS.flatMap((spec) => {
    const name = spec.text[setup];
    return spec.color && name ? [{ id: spec.id, name, icon: spec.icon, color: spec.color }] : [];
  });

  return (
    <div class="legend">
      <ul class="legend-list">
        {lines.map((line) => {
          const chip = (
            <span class="chip" style={{ '--chip': APWA[line.color].fill }} aria-hidden="true">
              <Icon name={line.icon} />
            </span>
          );
          return (
            <li key={line.id}>
              {find ? (
                <button
                  type="button"
                  class="legend-row"
                  title="Find it in the view"
                  onClick={() => {
                    find.onShow(line.id);
                  }}
                  onPointerEnter={() => {
                    find.onHighlight(line.id);
                  }}
                  onPointerLeave={() => {
                    find.onHighlight(null);
                  }}
                  onFocus={() => {
                    find.onHighlight(line.id);
                  }}
                  onBlur={() => {
                    find.onHighlight(null);
                  }}
                >
                  {chip}
                  {line.name}
                </button>
              ) : (
                <>
                  {chip}
                  {line.name}
                </>
              )}
            </li>
          );
        })}
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
