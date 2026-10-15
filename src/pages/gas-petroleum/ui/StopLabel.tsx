/**
 * A stop's label in the 3D view: a button with its path's icon and its short name, which opens
 * the stop. The scene places it; it starts hidden until then.
 */
import { stopById, type StopId } from '../../../../content/utilities/gas-petroleum.ts';
import { Icon } from '../../../design/icons.tsx';
import { PATH_STYLE } from '../../../design/paths.ts';
import { stopName } from '../summary.ts';

export function StopLabel(props: {
  id: StopId;
  current: boolean;
  register: (el: HTMLElement | null) => void;
  onOpen: (id: StopId) => void;
}) {
  const stop = stopById(props.id);
  const style = PATH_STYLE[stop.path];
  return (
    <div
      class="lbl off"
      ref={props.register}
      data-label={props.id}
      data-path={stop.path}
      data-tier={props.current ? 'current' : 'context'}
    >
      <button
        type="button"
        class="lbl-btn"
        aria-label={stopName(props.id)}
        aria-current={props.current ? 'step' : undefined}
        onClick={() => {
          props.onOpen(props.id);
        }}
      >
        <span class="lbl-icon lbl-icon-path" style={{ '--chip': style.color }} aria-hidden="true">
          <Icon name={style.icon} />
        </span>
        <span class="lbl-text">{stop.label}</span>
      </button>
    </div>
  );
}
