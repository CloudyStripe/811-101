/**
 * Fitting a shot to the free part of the view. A shot gives a direction to look along and the
 * points that must be in view; the fit finds where to put the camera so they all sit inside the
 * area the panel or sheet leaves free, centered, with a margin. It's a pure function of the field
 * of view and the area, so it's tested without a renderer.
 */
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

export type Point3 = readonly [number, number, number];

export interface Shot {
  /** A camera position and target that set the direction to look along; the distance is fitted. */
  from: Point3;
  to: Point3;
  /** Points that must be in view, labels' room included. */
  mustSee: readonly Point3[];
  /**
   * The camera comes no closer than this to its target. A wide free area would otherwise bring it
   * in close, where perspective swells the near field; held back, the view shows more of the
   * world around the lesson instead.
   */
  minDistance?: number;
  /**
   * CSS pixels kept clear at the free area's left and right, so a label centered on a point near
   * either side still fits beside it. Counts only where it's more than the margin.
   */
  labelRoom?: number;
}

/** How far out the must-see points may reach, each way, in the free area's -1 to 1 units. */
export function fitLimits(shot: Shot, area: FitArea, margin = 0.08): { x: number; y: number } {
  const room = Math.min(0.6, (shot.labelRoom ?? 0) / Math.max(1, area.width / 2));
  return { x: 1 - Math.max(margin, room), y: 1 - margin };
}

export interface FitArea {
  /** The free area's size, and the whole canvas's height, in CSS pixels. */
  width: number;
  height: number;
  canvasHeight: number;
}

export interface Pose {
  position: Vector3;
  target: Vector3;
}

/** A camera covering only the free area: its field of view shrinks with the area's share of the canvas. */
export function areaCamera(fovDeg: number, area: FitArea): PerspectiveCamera {
  const halfTan =
    Math.tan(MathUtils.degToRad(fovDeg / 2)) * (area.height / Math.max(1, area.canvasHeight));
  return new PerspectiveCamera(
    MathUtils.radToDeg(2 * Math.atan(halfTan)),
    area.width / Math.max(1, area.height),
    0.1,
    10_000,
  );
}

/**
 * Where the camera goes so every must-see point fits the free area, inside `margin` of its edges
 * (in normalized units, where the area spans -1 to 1), and `labelRoom` pixels from its sides.
 */
export function fitShot(shot: Shot, fovDeg: number, area: FitArea, margin = 0.08): Pose {
  // Nothing to fit, or nowhere to fit it: keep the shot as given.
  if (shot.mustSee.length === 0 || area.width < 1 || area.height < 1 || area.canvasHeight < 1) {
    return { position: new Vector3(...shot.from), target: new Vector3(...shot.to) };
  }
  const cam = areaCamera(fovDeg, area);
  const dir = new Vector3(...shot.from).sub(new Vector3(...shot.to)).normalize();
  const target = new Vector3(...shot.to);
  const points = shot.mustSee.map((p) => new Vector3(...p));
  const v = new Vector3();
  const limit = fitLimits(shot, area, margin);

  const place = (distance: number) => {
    cam.position.copy(target).addScaledVector(dir, distance);
    cam.lookAt(target);
    cam.updateMatrixWorld();
  };
  /** The points' extent on screen, and how deep the points at each edge sit. */
  const extent = () => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    const depth = { x0: 1, x1: 1, y0: 1, y1: 1 };
    let behind = false;
    for (const p of points) {
      v.copy(p).applyMatrix4(cam.matrixWorldInverse);
      const z = -v.z;
      v.copy(p).project(cam);
      if (v.z < -1 || v.z > 1) behind = true;
      if (v.x < x0) [x0, depth.x0] = [v.x, z];
      if (v.x > x1) [x1, depth.x1] = [v.x, z];
      if (v.y < y0) [y0, depth.y0] = [v.y, z];
      if (v.y > y1) [y1, depth.y1] = [v.y, z];
    }
    return { x0, x1, y0, y1, depth, behind };
  };
  const fits = (distance: number) => {
    place(distance);
    const e = extent();
    return !e.behind && e.x0 >= -limit.x && e.x1 <= limit.x && e.y0 >= -limit.y && e.y1 <= limit.y;
  };
  /** The nearest distance at which everything fits (to a few hundredths of a unit). */
  const nearest = () => {
    let lo = 0.5;
    let hi = 5000;
    for (let i = 0; i < 24; i++) {
      const mid = Math.sqrt(lo * hi);
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  };

  // Center the points, then fit the distance again, until they sit centered: centering changes
  // what fits. Sliding the camera sideways moves near points more than far ones, so each step is
  // sized by how deep the points at the two edges sit.
  const right = new Vector3();
  const up = new Vector3();
  const tanV = Math.tan(MathUtils.degToRad(cam.fov / 2));
  const tanH = tanV * cam.aspect;
  /** The slide that centers two edge points at screen positions a and b, depths za and zb. */
  const slide = (a: number, b: number, za: number, zb: number, tan: number) =>
    ((a + b) * tan) / (1 / Math.max(za, 1e-3) + 1 / Math.max(zb, 1e-3));
  const minDistance = shot.minDistance ?? 0;
  const fitted = () => Math.max(minDistance, nearest());
  for (let pass = 0; pass < 24; pass++) {
    place(fitted());
    const e = extent();
    if (Math.abs(e.x0 + e.x1) < 0.01 && Math.abs(e.y0 + e.y1) < 0.01) break;
    right.setFromMatrixColumn(cam.matrixWorld, 0);
    up.setFromMatrixColumn(cam.matrixWorld, 1);
    target
      .addScaledVector(right, slide(e.x0, e.x1, e.depth.x0, e.depth.x1, tanH))
      .addScaledVector(up, slide(e.y0, e.y1, e.depth.y0, e.depth.y1, tanV));
  }
  place(fitted());
  return { position: cam.position.clone(), target: target.clone() };
}
