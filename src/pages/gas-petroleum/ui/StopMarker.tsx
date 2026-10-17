/**
 * A stop's marker on the model: a button with its number in its path's shape, a tab with its
 * path's icon, and its short name beside them where there's room (the scene places it, and starts
 * it hidden). It opens the stop. The stop the view is at is filled in ink; a stop on a path the
 * view has faded back fades with it.
 */
import { stopById, type StopId } from '../../../../content/utilities/gas-petroleum.ts';
import { Icon } from '../../../design/icons.tsx';
import { PATH_STYLE } from '../../../design/paths.ts';
import { stopName } from '../summary.ts';
import { PathShape } from './PathShape.tsx';

export function StopMarker(props: {
  id: StopId;
  current: boolean;
  faded: boolean;
  register: (el: HTMLElement | null) => void;
  onOpen: (id: StopId) => void;
}) {
  const stop = stopById(props.id);
  const style = PATH_STYLE[stop.path];
  return (
    <div
      class="lbl mk off"
      ref={props.register}
      data-label={props.id}
      data-path={stop.path}
      data-tier={props.current ? 'current' : 'context'}
      data-faded={props.faded ? '' : undefined}
    >
      <button
        type="button"
        class="mk-btn"
        aria-label={stopName(props.id)}
        aria-current={props.current ? 'step' : undefined}
        onClick={() => {
          props.onOpen(props.id);
        }}
      >
        <span class="mk-badge">
          <PathShape path={stop.path} current={props.current}>
            {stop.step}
          </PathShape>
          <span class="mk-tab" style={{ '--chip': style.color }} aria-hidden="true">
            <Icon name={style.icon} />
          </span>
        </span>
        <span class="lbl-text">{stop.label}</span>
      </button>
    </div>
  );
}
