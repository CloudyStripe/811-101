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
 * (in normalized units, where the area spans -1 to 1).
 */
export function fitShot(shot: Shot, fovDeg: number, area: FitArea, margin = 0.08): Pose {
  const cam = areaCamera(fovDeg, area);
  const dir = new Vector3(...shot.from).sub(new Vector3(...shot.to)).normalize();
  const target = new Vector3(...shot.to);
  const points = shot.mustSee.map((p) => new Vector3(...p));
  const v = new Vector3();
  const limit = 1 - margin;

  const place = (distance: number) => {
    cam.position.copy(target).addScaledVector(dir, distance);
    cam.lookAt(target);
    cam.updateMatrixWorld();
  };
  const extent = () => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let behind = false;
    for (const p of points) {
      v.copy(p).project(cam);
      if (v.z < -1 || v.z > 1) behind = true;
      x0 = Math.min(x0, v.x);
      x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
    }
    return { x0, x1, y0, y1, behind };
  };
  const fits = (distance: number) => {
    place(distance);
    const e = extent();
    return !e.behind && e.x0 >= -limit && e.x1 <= limit && e.y0 >= -limit && e.y1 <= limit;
  };
  /** The nearest distance at which everything fits. */
  const nearest = () => {
    let lo = 0.5;
    let hi = 5000;
    for (let i = 0; i < 42; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  };

  // Center the points, then fit the distance again: centering changes what fits.
  const right = new Vector3();
  const up = new Vector3();
  for (let pass = 0; pass < 4; pass++) {
    const distance = nearest();
    place(distance);
    const e = extent();
    const tanV = Math.tan(MathUtils.degToRad(cam.fov / 2));
    right.setFromMatrixColumn(cam.matrixWorld, 0);
    up.setFromMatrixColumn(cam.matrixWorld, 1);
    target
      .addScaledVector(right, ((e.x0 + e.x1) / 2) * tanV * cam.aspect * distance)
      .addScaledVector(up, ((e.y0 + e.y1) / 2) * tanV * distance);
  }
  place(nearest());
  return { position: cam.position.clone(), target: target.clone() };
}
