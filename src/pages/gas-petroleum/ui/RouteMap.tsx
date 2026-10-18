/**
 * A map of every stop, by name: the shared start, then the fork into the natural gas and gasoline
 * paths, side by side. Each path's line is drawn as its route is in the view (stone; yellow
 * dashed; yellow banded), and each stop is a button in its path's shape, numbered as its marker on
 * the model is, with its short name, that opens it.
 */
import {
  PATH_NAMES,
  stopById,
  type PathId,
  type StopId,
} from '../../../../content/utilities/gas-petroleum.ts';
import { Icon } from '../../../design/icons.tsx';
import { PATH_STYLE } from '../../../design/paths.ts';
import { PATHS, SHARED, stopsOf } from '../journey.ts';
import { stopName } from '../summary.ts';
import { PathShape } from './PathShape.tsx';

/** A path's name, with its icon, over its stops. */
function PathName({ path }: { path: PathId }) {
  return (
    <p class="rmap-name">
      <Icon name={PATH_STYLE[path].icon} />
      {PATH_NAMES[path]}
    </p>
  );
}

/** A path's stops in order, along its line. */
function Stops(props: { path: PathId; ids: readonly StopId[]; onOpen: (id: StopId) => void }) {
  return (
    <ol
      class="rmap-stops"
      data-path={props.path}
      style={{ '--path': PATH_STYLE[props.path].color }}
    >
      {props.ids.map((id) => {
        const stop = stopById(id);
        return (
          <li key={id}>
            <button
              type="button"
              class="rmap-stop"
              aria-label={stopName(id)}
              onClick={() => {
                props.onOpen(id);
              }}
            >
              <PathShape path={stop.path}>{stop.step}</PathShape>
              <span>{stop.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function RouteMap({ onOpen }: { onOpen: (id: StopId) => void }) {
  return (
    <div
      class="rmap"
      role="group"
      aria-label="Every stop: a shared start that forks into two paths"
    >
      <PathName path="shared" />
      <Stops path="shared" ids={SHARED} onOpen={onOpen} />
      <div class="rmap-fork">
        {PATHS.map((path) => (
          <div key={path} class="rmap-path">
            <PathName path={path} />
            <Stops path={path} ids={stopsOf(path).slice(SHARED.length)} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </div>
  );
}
