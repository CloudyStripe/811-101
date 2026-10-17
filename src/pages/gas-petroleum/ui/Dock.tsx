/**
 * The diorama's controls, in thumb reach on phones: which path to show, a pause for the model's
 * motion, and at a stop, the previous and next stops and the way back to the overview. A button
 * with nowhere to go says so (aria-disabled) but keeps its focus. The camera's own buttons sit in
 * the view's corner (ViewControls).
 */
import { PATH_NAMES, stopById, type StopId } from '../../../../content/utilities/gas-petroleum.ts';
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
  /** The open stop, or null in the overview. */
  stop: StopId | null;
  /** Where back and next go: stops, or a tour's steps. */
  prev: { id: StopId | null; label: string } | null;
  next: { id: StopId | null; label: string } | null;
  onPrev: () => void;
  onNext: () => void;
  onOverview: () => void;
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
      {props.stop !== null && (
        <div class="dock-row dock-moves">
          <button
            type="button"
            class="icon-button"
            aria-label={props.prev?.label ?? 'Back'}
            title={props.prev?.label ?? 'Back'}
            aria-disabled={!props.prev || undefined}
            onClick={props.onPrev}
          >
            <Icon name="back" />
          </button>
          <button
            type="button"
            class="button button-secondary dock-overview"
            onClick={props.onOverview}
          >
            <Icon name="map" />
            Overview
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label={props.next?.label ?? 'Next'}
            title={props.next?.label ?? 'Next'}
            aria-disabled={!props.next || undefined}
            onClick={props.onNext}
          >
            <Icon name="forward" />
          </button>
          <span class="dock-where" aria-hidden="true">
            {stopById(props.stop).label}
          </span>
        </div>
      )}
    </section>
  );
}
