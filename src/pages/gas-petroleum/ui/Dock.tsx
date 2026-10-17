/**
 * The diorama's controls, in thumb reach on phones: which path to show, and a pause for the
 * model's motion. The steps have their own bar, in the guide (StepBar), and the camera's buttons
 * sit in the view's corner (ViewControls).
 */
import { PATH_NAMES } from '../../../../content/utilities/gas-petroleum.ts';
import { Icon } from '../../../design/icons.tsx';
import { PATH_STYLE } from '../../../design/paths.ts';
import { Segmented } from '../../../design/Segmented.tsx';
import type { Filter } from '../scene/index.ts';

const FILTERS = [
  {
    value: 'gas' as const,
    label: (
      <>
        <Icon name={PATH_STYLE.gas.icon} />
        Natural gas
      </>
    ),
    ariaLabel: PATH_NAMES.gas,
  },
  {
    value: 'gasoline' as const,
    label: (
      <>
        <Icon name={PATH_STYLE.gasoline.icon} />
        Gasoline
      </>
    ),
    ariaLabel: PATH_NAMES.gasoline,
  },
  { value: 'both' as const, label: 'Both' },
];

export function Dock(props: {
  filter: Filter;
  onFilter: (filter: Filter) => void;
  paused: boolean;
  onPause: (paused: boolean) => void;
}) {
  const pauseName = props.paused ? 'Play the motion' : 'Pause the motion';
  return (
    <section class="gp-dock" aria-labelledby="dock-title" data-chrome>
      <h2 class="sr-only" id="dock-title">
        Controls
      </h2>
      <div class="dock-row">
        <Segmented
          label="Show"
          value={props.filter}
          options={FILTERS}
          onChange={props.onFilter}
          class="dock-filter"
        />
        <button
          type="button"
          class="icon-button dock-pause"
          aria-label={pauseName}
          title={pauseName}
          data-paused={props.paused ? '' : undefined}
          onClick={() => {
            props.onPause(!props.paused);
          }}
        >
          <Icon name={props.paused ? 'play' : 'pause'} />
        </button>
      </div>
    </section>
  );
}
