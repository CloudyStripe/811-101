/**
 * A map of every stop: the shared start, forking into the natural gas and gasoline paths. The
 * lines are drawn as the routes are in the view (stone; yellow dashed; yellow banded), and each
 * stop is a button that opens it, numbered in its path's shape as its marker on the model is.
 */
import {
  PATH_NAMES,
  TOURS,
  stopById,
  type StopId,
} from '../../../../content/utilities/gas-petroleum.ts';
import { Icon } from '../../../design/icons.tsx';
import { PATH_STYLE } from '../../../design/paths.ts';
import { stopName } from '../summary.ts';
import { PathShape } from './PathShape.tsx';

const W = 344;
const H = 152;

/** Where each stop sits on the map, in its own units. */
function layout(): { id: StopId; x: number; y: number }[] {
  const shared = TOURS.gas.stops.slice(0, 4);
  const gas = TOURS.gas.stops.slice(4);
  const gasoline = TOURS.gasoline.stops.slice(4);
  return [
    ...shared.map((id, i) => ({ id, x: 16 + i * 29, y: 76 })),
    ...gas.map((id, i) => ({ id, x: 150 + (i * 180) / (gas.length - 1), y: 34 })),
    ...gasoline.map((id, i) => ({ id, x: 150 + (i * 180) / (gasoline.length - 1), y: 118 })),
  ];
}

const NODES = layout();

export function RouteMap({ onOpen }: { onOpen: (id: StopId) => void }) {
  const yellow = PATH_STYLE.gas.color;
  return (
    <div class="rmap">
      <svg class="rmap-lines" viewBox={`0 0 ${String(W)} ${String(H)}`} aria-hidden="true">
        <path class="rmap-line rmap-shared" d="M16 76H112" stroke={PATH_STYLE.shared.color} />
        <path
          class="rmap-line rmap-gas"
          d="M112 76C130 76 128 34 150 34H330"
          stroke={yellow}
          stroke-dasharray="7 5"
        />
        <path
          class="rmap-line rmap-gasoline"
          d="M112 76C130 76 128 118 150 118H330"
          stroke={yellow}
        />
        <path class="rmap-bands" d="M112 76C130 76 128 118 150 118H330" stroke-dasharray="2.5 7" />
      </svg>
      <span class="rmap-name rmap-name-gas">
        <Icon name={PATH_STYLE.gas.icon} />
        {PATH_NAMES.gas}
      </span>
      <span class="rmap-name rmap-name-gasoline">
        <Icon name={PATH_STYLE.gasoline.icon} />
        {PATH_NAMES.gasoline}
      </span>
      <span class="rmap-name rmap-name-shared">{PATH_NAMES.shared}</span>
      <ol class="rmap-stops" aria-label="Every stop: a shared start that forks into two paths">
        {NODES.map((n) => {
          const stop = stopById(n.id);
          return (
            <li
              key={n.id}
              style={{ left: `${String((n.x / W) * 100)}%`, top: `${String((n.y / H) * 100)}%` }}
            >
              <button
                type="button"
                class="rmap-stop"
                data-path={stop.path}
                aria-label={stopName(n.id)}
                title={stop.label}
                onClick={() => {
                  onOpen(n.id);
                }}
              >
                <PathShape path={stop.path}>{stop.step}</PathShape>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
