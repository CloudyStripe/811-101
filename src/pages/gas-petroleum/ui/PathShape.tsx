/**
 * A path's mark: the shape of its stops' markers (the shared start's circle, natural gas's diamond,
 * gasoline's hexagon), ringed as its route is drawn (stone; yellow dashed; yellow banded), white
 * with what it holds (a stop's number, or an icon) in ink, or in ink with it in white for the stop
 * the view is at. The same mark is a marker on the model, a stop on the map, a dot in the step
 * bar and a way on at the fork.
 */
import type { ComponentChildren } from 'preact';
import { PATH_STYLE, type PathId, type PathStyle } from '../../../design/paths.ts';

/** Each shape in a 30-unit box, its edge far enough in for the ring's stroke to fit. */
const OUTLINE: Readonly<Record<PathStyle['shape'], string>> = {
  circle: 'M15 2.5A12.5 12.5 0 1 1 15 27.5A12.5 12.5 0 1 1 15 2.5Z',
  diamond: 'M15 1.8L28.2 15L15 28.2L1.8 15Z',
  hexagon: 'M15 1.7L26.5 8.35V21.65L15 28.3L3.5 21.65V8.35Z',
};

/** The ring's length, in its own units: its dashes and bands are measured against it. */
const RING = 48;

export function PathShape(props: {
  path: PathId;
  /** The stop the view is at: filled in ink. */
  current?: boolean;
  class?: string;
  children?: ComponentChildren;
}) {
  const style = PATH_STYLE[props.path];
  const d = OUTLINE[style.shape];
  return (
    <span
      class={props.class ? `pshape ${props.class}` : 'pshape'}
      data-shape={style.shape}
      data-current={props.current ? '' : undefined}
      aria-hidden="true"
    >
      <svg viewBox="0 0 30 30">
        <path class="pshape-fill" d={d} />
        {/* Dashes on pale gaps, as the route's are painted. */}
        {style.pattern === 'dashed' && <path class="pshape-gaps" d={d} />}
        <path
          class="pshape-ring"
          d={d}
          stroke={style.color}
          pathLength={RING}
          stroke-dasharray={style.pattern === 'dashed' ? '4 2' : undefined}
        />
        {style.pattern === 'banded' && (
          <path class="pshape-bands" d={d} pathLength={RING} stroke-dasharray="1.5 4.5" />
        )}
      </svg>
      {props.children !== undefined && <span class="pshape-in">{props.children}</span>}
    </span>
  );
}
