/**
 * The camera's shots: the overview, from the south and above, turned within its bounds; and each
 * stop's own shot. A shot gives a direction and what must be in view; the fit sets the distance,
 * so it frames the same things in whatever room the panel and the dock leave.
 */
import { Spherical, Vector3 } from 'three';
import type { View } from '../../../kit3d/camera.ts';
import type { Point } from './build.ts';
import { MODEL_BOX } from './layout.ts';
import { focusPoints, type StopModel } from './stop.ts';

/** The overview: from the south and above, at the middle of the model. */
const OVERVIEW = {
  target: [-3, -4, -4] as const,
  direction: new Vector3(0.06, 0.47, 0.88).normalize(),
};

/** How far the overview turns about its middle, either way: about 35°, in radians. */
export const TURN_LIMIT = (35 * Math.PI) / 180;

/** A turn held within the overview's bounds. */
export const clampYaw = (yaw: number): number => Math.max(-TURN_LIMIT, Math.min(TURN_LIMIT, yaw));

/** What the overview must show: the model's corners, and room above every stop's label. */
export function overviewPoints(models: readonly StopModel[]): Point[] {
  const points: Point[] = [];
  for (const x of [MODEL_BOX.min[0], MODEL_BOX.max[0]])
    for (const y of [MODEL_BOX.min[1], MODEL_BOX.max[1]])
      for (const z of [MODEL_BOX.min[2], MODEL_BOX.max[2]]) points.push([x, y, z]);
  for (const m of models) points.push([m.label.at[0], m.label.at[1] + 1.6, m.label.at[2]]);
  return points;
}

/** The overview, turned `yaw` radians about its middle (to the right for more). */
export function overviewView(points: readonly Point[], yaw: number): View {
  const offset = new Spherical().setFromVector3(OVERVIEW.direction.clone().multiplyScalar(100));
  offset.theta += yaw;
  const p = new Vector3().setFromSpherical(offset).add(new Vector3(...OVERVIEW.target));
  return {
    position: [p.x, p.y, p.z],
    target: OVERVIEW.target,
    mustSee: points,
    margin: 0.05,
    labelRoom: 48,
  };
}

/** A stop's shot, with room around the stop so it sits in its surroundings. */
export function stopView(model: StopModel): View {
  return {
    position: model.view.from,
    target: model.view.to,
    mustSee: focusPoints(model),
    margin: 0.16,
    labelRoom: 60,
    minDistance: 26,
  };
}
