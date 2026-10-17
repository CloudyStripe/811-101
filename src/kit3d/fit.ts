/**
 * Fitting a shot to the free part of the view. A shot gives a direction to look along and the
 * points that must be in view; the fit finds where to put the camera so they all sit inside the
 * area the panel or sheet leaves free, centered, with a margin, and out from under any controls
 * over the area: the picture slides off center, away from them, where the shot allows it and that
 * lets the camera stand nearer than pulling back would. It's a pure function of the field of view
 * and the area, so it's tested without a renderer.
 */
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

export type Point3 = readonly [number, number, number];

/** A rectangle in the free area's own -1 to 1 units, y up. */
export interface FitRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

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
  /**
   * Controls over the free area, such as a card in a corner: no must-see point may sit under one.
   * Ignored where the camera can't get every point out from under them.
   */
  keepOut?: readonly FitRect[];
  /**
   * The picture may slide off center to clear the controls, where that lets the camera stand
   * nearer than pulling back would. Otherwise the points stay centered.
   */
  slide?: boolean;
  /**
   * The lowest the camera may look at. Fitted lower, what it looks at moves up its line of sight
   * to meet it: the same picture, from the same place.
   */
  floor?: number;
  /**
   * The nearest the camera may stand to what it looks at, by how high that is. Fitted nearer, it
   * steps back along its line of sight: the same view, a little smaller.
   */
  nearestAt?: (height: number) => number;
}

/**
 * How far off center the picture may slide to clear the controls, each way, in the free area's -1
 * to 1 units. Every pair is tried; the least slide that does nearly as well as the best one wins.
 */
const SLIDES = [0, 0.08, -0.08, 0.16, -0.16, 0.24, -0.24, 0.32, -0.32];
/** A slide is worth taking for a camera at least this much nearer than the centered fit's. */
const SLIDE_GAIN = 0.98;

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

/** A slide of the picture, in the free area's -1 to 1 units, y up. */
export interface Shift {
  x: number;
  y: number;
}

/** No slide: what the camera looks at sits at the free area's middle. */
export const CENTERED: Shift = { x: 0, y: 0 };

export interface Pose {
  position: Vector3;
  target: Vector3;
  /**
   * How far the picture slides off center, so what the camera looks at shows there rather than
   * at the free area's middle: a shift of the projection, the same for near and far, so the camera
   * still looks at (and turns round) the shot's own target.
   */
  shift: Shift;
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
    return {
      position: new Vector3(...shot.from),
      target: new Vector3(...shot.to),
      shift: CENTERED,
    };
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
  const keepOut = shot.keepOut ?? [];
  /** Whether every point is out from under the controls over the area. */
  const clear = () =>
    points.every((p) => {
      v.copy(p).project(cam);
      return keepOut.every((r) => v.x <= r.x0 || v.x >= r.x1 || v.y <= r.y0 || v.y >= r.y1);
    });
  /** Whether every point, seen from where the camera is now, sits inside the area's limits. */
  const inside = () => {
    const e = extent();
    return !e.behind && e.x0 >= -limit.x && e.x1 <= limit.x && e.y0 >= -limit.y && e.y1 <= limit.y;
  };
  const inArea = (distance: number) => {
    place(distance);
    return inside();
  };
  const fits = (distance: number) => inArea(distance) && clear();
  /** The nearest distance that passes the test (to a few hundredths of a unit), if any does. */
  const nearestFor = (test: (distance: number) => boolean) => {
    let lo = 0.5;
    let hi = 5000;
    if (!test(hi)) return null;
    for (let i = 0; i < 24; i++) {
      const mid = Math.sqrt(lo * hi);
      if (test(mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  };
  const nearest = () => nearestFor(fits) ?? nearestFor(inArea) ?? 5000;

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
  const centered = fitted();
  // No sliding asked for, or no controls, or none that cost the centered fit anything: it stands.
  const unhindered =
    shot.slide === true && keepOut.length > 0
      ? Math.max(minDistance, nearestFor(inArea) ?? centered)
      : centered;
  const pose = (distance: number, shift: Shift): Pose => {
    place(distance);
    const looked = target.clone();
    const { floor } = shot;
    if (floor !== undefined && looked.y < floor && cam.position.y > floor) {
      looked.lerpVectors(
        cam.position,
        target,
        (floor - cam.position.y) / (target.y - cam.position.y),
      );
    }
    const from = cam.position.clone();
    const near = shot.nearestAt?.(looked.y) ?? 0;
    if (from.distanceTo(looked) < near) from.copy(looked).addScaledVector(dir, near);
    return { position: from, target: looked, shift };
  };
  if (centered <= unhindered / SLIDE_GAIN) return pose(centered, CENTERED);

  // Controls over the area: rather than stand back until every point clears them, the picture
  // may slide off center, away from them. The slide moves every point's place on screen alike.
  const slid = (sx: number, sy: number) => (distance: number) => {
    place(distance);
    return points.every((p) => {
      v.copy(p).project(cam);
      const x = v.x + sx;
      const y = v.y + sy;
      return (
        v.z > -1 &&
        v.z < 1 &&
        Math.abs(x) <= limit.x &&
        Math.abs(y) <= limit.y &&
        keepOut.every((r) => x <= r.x0 || x >= r.x1 || y <= r.y0 || y >= r.y1)
      );
    });
  };
  const tries = SLIDES.flatMap((x) =>
    SLIDES.map((y) => {
      const distance = x === 0 && y === 0 ? centered : nearestFor(slid(x, y));
      return { shift: { x, y }, distance: Math.max(minDistance, distance ?? Infinity) };
    }),
  );
  const nearestTry = Math.min(...tries.map((t) => t.distance));
  // The least slide that does nearly as well as the best; none unless it beats centering.
  const [best] = tries
    .filter((t) => t.distance <= nearestTry / SLIDE_GAIN)
    .sort((a, b) => Math.hypot(a.shift.x, a.shift.y) - Math.hypot(b.shift.x, b.shift.y));
  return best && best.distance < centered * SLIDE_GAIN
    ? pose(best.distance, best.shift)
    : pose(centered, CENTERED);
}
