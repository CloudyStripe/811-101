/** The fit solver on its own: what it does with simple shots, and with nothing to fit. */
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { areaCamera, fitShot, type FitArea, type Point3, type Shot } from './fit.ts';

const FOV = 34;

/** The must-see points' extent in the free area (-1 to 1 each way), seen from the fitted pose. */
function extent(shot: Shot, area: FitArea, margin?: number) {
  const pose = fitShot(shot, FOV, area, margin);
  const camera = areaCamera(FOV, area);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  camera.updateMatrixWorld();
  const projected = shot.mustSee.map((p) => new Vector3(...p).project(camera));
  const xs = projected.map((v) => v.x);
  const ys = projected.map((v) => v.y);
  return {
    pose,
    projected,
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
}

/** The eight corners of a box. */
function corners(min: Point3, max: Point3): Point3[] {
  const out: Point3[] = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push([x, y, z]);
  return out;
}

const WIDE: FitArea = { width: 1200, height: 800, canvasHeight: 800 };
const BOX = corners([-10, -2, -4], [30, 6, 4]);
const SHOT: Shot = { from: [-20, 15, 40], to: [10, 0, 0], mustSee: BOX };

describe('fitShot', () => {
  it('keeps the shot as given when there is nothing to fit, or nowhere to fit it', () => {
    for (const [shot, area] of [
      [{ ...SHOT, mustSee: [] }, WIDE],
      [SHOT, { width: 0, height: 800, canvasHeight: 800 }],
      [SHOT, { width: 1200, height: 0, canvasHeight: 800 }],
      [SHOT, { width: 1200, height: 800, canvasHeight: 0 }],
    ] as const) {
      const pose = fitShot(shot, FOV, area);
      expect(pose.position.toArray()).toEqual([...SHOT.from]);
      expect(pose.target.toArray()).toEqual([...SHOT.to]);
    }
  });

  it('puts every point in view, inside the margin, in front of the camera', () => {
    const e = extent(SHOT, WIDE, 0.1);
    for (const v of e.projected) {
      expect(v.z).toBeGreaterThan(-1);
      expect(v.z).toBeLessThan(1);
    }
    expect(e.x0).toBeGreaterThanOrEqual(-0.9 - 1e-3);
    expect(e.x1).toBeLessThanOrEqual(0.9 + 1e-3);
    expect(e.y0).toBeGreaterThanOrEqual(-0.9 - 1e-3);
    expect(e.y1).toBeLessThanOrEqual(0.9 + 1e-3);
  });

  it('comes as close as fits: the points reach the margin one way or the other', () => {
    const e = extent(SHOT, WIDE, 0.1);
    expect(Math.max(e.x1 - e.x0, e.y1 - e.y0)).toBeGreaterThan(1.8 - 0.01);
  });

  it('centers the points in the free area', () => {
    for (const area of [WIDE, { width: 390, height: 600, canvasHeight: 844 }]) {
      const e = extent(SHOT, area);
      expect(Math.abs((e.x0 + e.x1) / 2)).toBeLessThan(0.01);
      expect(Math.abs((e.y0 + e.y1) / 2)).toBeLessThan(0.01);
    }
  });

  it('keeps the direction it was given', () => {
    const { pose } = extent(SHOT, WIDE);
    const given = new Vector3(...SHOT.from).sub(new Vector3(...SHOT.to)).normalize();
    const fitted = pose.position.clone().sub(pose.target).normalize();
    expect(fitted.dot(given)).toBeGreaterThan(0.9999);
  });

  it('gives a finite pose for a single point', () => {
    const { pose } = extent({ ...SHOT, mustSee: [[5, 1, 0]] }, WIDE);
    for (const n of [...pose.position.toArray(), ...pose.target.toArray()]) {
      expect(Number.isFinite(n)).toBe(true);
    }
  });
});
