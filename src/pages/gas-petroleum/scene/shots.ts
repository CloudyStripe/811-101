/**
 * The camera's shots and its limits. The overview looks from the south and above on wide screens,
 * and from the east on tall ones, where the model's length then runs into the view and its width
 * fills the screen. Each stop's shot centers its subject and makes it the biggest thing in view;
 * the stops either side may show at its edges, or just beyond. A shot gives a direction and what
 * must be in view; the fit sets the distance, so it frames the same things in whatever room the
 * guide, the dock and the camera's buttons leave. How near the camera stands sets how much of the
 * ground's night grade it gets.
 *
 * The reader turns the camera all the way round, tilts it within `ORBIT.polar`, zooms from
 * `nearestAt` out to `ORBIT.far` of the distance the whole model shows from, and pans what it
 * looks at within `orbitBounds`. Together these keep it above the grass: what it looks at is never
 * lower than `ORBIT.floor`, and the lower it is, the further back the camera stands, so at its
 * flattest tilt it still clears the grass.
 */
import { Box3, MathUtils, Vector3 } from 'three';
import type { View } from '../../../kit3d/camera.ts';
import type { Point } from './build.ts';
import { BLOCK, HARBOR, MODEL_BOX } from './layout.ts';
import { focusPoints, type StopModel } from './stop.ts';

const UP = new Vector3(0, 1, 0);

/**
 * The overview, at the middle of the model: from the south and above, or from the east, a little
 * to the south so the cut face shows, and higher, so the model's length rises up the tall screen.
 */
const OVERVIEW = {
  target: [-3, -4, -4] as const,
  wide: new Vector3(0.06, 0.47, 0.88).normalize(),
  tall: new Vector3(0.683, 0.707, 0.183).normalize(),
};

/**
 * How the reader may move the camera. `polar`: how far it tilts, in radians from straight
 * overhead, from nearly overhead to 12° above level. `near`: the nearest it comes to what it looks
 * at, in model units, near the grass (lower down, `nearestAt` holds it further back). `far`: the
 * farthest, as a share of the distance the whole model shows from any side (on a tall screen, its
 * long side needs more than the overview's). `floor`: the lowest it looks, in model units.
 */
export const ORBIT = {
  polar: [MathUtils.degToRad(3), MathUtils.degToRad(78)] as const,
  near: 15,
  far: 1.35,
  floor: -8,
} as const;

/** How high above the grass (y = 0) the camera always stands, at least, in model units. */
export const CLEARANCE = 1;

/**
 * The nearest the camera may stand to what it looks at, by how high that is: tilted as flat as it
 * goes, it stands `distance × cos(polar)` above it, which must clear the grass by `CLEARANCE`.
 * Near the grass, `ORBIT.near`; at the floor, about 43.
 */
export function nearestAt(height: number): number {
  return Math.max(ORBIT.near, (CLEARANCE - height) / Math.cos(ORBIT.polar[1]));
}

/** How far in front of the cut face the camera may look, where its underground stops are framed. */
const FORE = 4;

/**
 * Where the camera may look as the reader pans: anywhere over the model, the harbor included, and
 * just in front of the cut face.
 */
export function orbitBounds(): Box3 {
  return new Box3(
    new Vector3(BLOCK.x0, ORBIT.floor, HARBOR.z0),
    new Vector3(BLOCK.x1, MODEL_BOX.max[1], BLOCK.z1 + FORE),
  );
}

/**
 * How a stop's shot frames its subject: the room kept round it, as a share of the free area each
 * way, so it fills the rest, centered, and is the biggest thing in view.
 */
export const STOP_SHOT = { margin: 0.3 } as const;

/**
 * Where the ground's night grade fades, as shares of the overview's distance: all of it from
 * `full` in, none from `none` out.
 */
export const NIGHT_GRADE = { full: 0.8, none: 0.95 } as const;

/** The lowest a stop is looked at from, so its shot shows where it sits on the model. */
const STOP_ELEVATION = MathUtils.degToRad(18);

/**
 * How much of the ground's night grade a view gets, by how near its camera stands, as a share of
 * the overview's distance: all of it as near as a stop's shot, where the lawn fills the view and
 * would read as day, and none at the overview's distance or farther, where the small model in the
 * dark sky reads as night already. Between, as the reader zooms, it fades.
 */
export function nightGradeAt(share: number): number {
  return 1 - MathUtils.smoothstep(share, NIGHT_GRADE.full, NIGHT_GRADE.none);
}

/** What the overview must show: the model's corners, and room above every stop's label. */
export function overviewPoints(models: readonly StopModel[]): Point[] {
  const points: Point[] = [];
  for (const x of [MODEL_BOX.min[0], MODEL_BOX.max[0]])
    for (const y of [MODEL_BOX.min[1], MODEL_BOX.max[1]])
      for (const z of [MODEL_BOX.min[2], MODEL_BOX.max[2]]) points.push([x, y, z]);
  for (const m of models) points.push(...markerPoints(m));
  return points;
}

/**
 * The overview, from the south on a wide screen or from the east on a tall one, where the model
 * fills the width: names near its sides slide in to fit, rather than keep it narrower. `turn`
 * looks from further round, in radians to the right, as the reader may.
 */
export function overviewView(points: readonly Point[], tall = false, turn = 0): View {
  const p = (tall ? OVERVIEW.tall : OVERVIEW.wide)
    .clone()
    .applyAxisAngle(UP, turn)
    .multiplyScalar(100)
    .add(new Vector3(...OVERVIEW.target));
  return {
    position: [p.x, p.y, p.z],
    target: OVERVIEW.target,
    mustSee: points,
    margin: tall ? 0.04 : 0.05,
    labelRoom: tall ? 8 : 48,
    // Controls over a corner (the closed guide's title): the model slides clear, not shrinks.
    slide: true,
    floor: ORBIT.floor,
  };
}

/** A stop's marker and the room above it for its name. */
function markerPoints(model: StopModel): Point[] {
  const [x, y, z] = model.label.at;
  return [
    [x, y, z],
    [x, y + 1.6, z],
  ];
}

/**
 * Where a stop is seen from: its own direction, raised to at least `STOP_ELEVATION` and aimed no
 * lower than the floor, so the camera stands above the grass and the shot shows where it sits.
 */
export function stopAim(model: StopModel): { from: Point; to: Point } {
  const to = new Vector3(...model.view.to);
  const dir = new Vector3(...model.view.from).sub(to).normalize();
  to.y = Math.max(to.y, ORBIT.floor);
  if (dir.y < Math.sin(STOP_ELEVATION)) {
    const level = Math.hypot(dir.x, dir.z);
    const out = Math.cos(STOP_ELEVATION) / level;
    dir.set(dir.x * out, Math.sin(STOP_ELEVATION), dir.z * out);
  }
  const from = to.clone().addScaledVector(dir, 100);
  return { from: [from.x, from.y, from.z], to: [to.x, to.y, to.z] };
}

/**
 * A stop's shot: its subject (its parts, their details and its label) centered in the room the
 * view has and the biggest thing in it, from no nearer than the camera comes. The camera's buttons
 * and the guide leave that room, so nothing slides it off center.
 */
export function stopShot(model: StopModel): View {
  const { from, to } = stopAim(model);
  return {
    position: from,
    target: to,
    mustSee: focusPoints(model),
    margin: STOP_SHOT.margin,
    labelRoom: 60,
    minDistance: ORBIT.near,
    floor: ORBIT.floor,
  };
}

/**
 * One press of a camera button or key: a turn of 20°, so 18 go all the way round; a tilt of 8°;
 * a zoom of a fifth of the distance; and a pan of a tenth of it.
 */
export const ORBIT_STEP = {
  turn: MathUtils.degToRad(20),
  tilt: MathUtils.degToRad(8),
  zoom: 0.2,
  pan: 0.1,
} as const;
