/** The fit solver on its own: what it does with simple shots, and with nothing to fit. */
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { areaCamera, fitShot, type FitArea, type Point3, type Shot } from './fit.ts';

const FOV = 34;

/**
 * The must-see points' extent in the free area (-1 to 1 each way), seen from the fitted pose with
 * the picture slid as it says.
 */
function extent(shot: Shot, area: FitArea, margin?: number) {
  const pose = fitShot(shot, FOV, area, margin);
  const camera = areaCamera(FOV, area);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  camera.updateMatrixWorld();
  const projected = shot.mustSee.map((p) => {
    const v = new Vector3(...p).project(camera);
    return v.set(v.x + pose.shift.x, v.y + pose.shift.y, v.z);
  });
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

  /** A card over the right-hand edge, where the rightmost point lands without one, this tall. */
  function cardOverRightEdge(y0: (right: Vector3) => number, y1: (right: Vector3) => number) {
    const free = extent(SHOT, WIDE);
    const right = free.projected.reduce((m, v) => (v.x > m.x ? v : m));
    const card = { x0: right.x - 0.2, y0: y0(right), x1: 1, y1: y1(right) };
    const under = (v: Vector3) => v.x > card.x0 && v.x < card.x1 && v.y > card.y0 && v.y < card.y1;
    expect(free.projected.some(under)).toBe(true);
    return { free, card, under };
  }
  const reach = (e: ReturnType<typeof extent>) => e.pose.position.distanceTo(e.pose.target);

  it('slides the points out from under a card over a corner, where there is room, rather than pulling back', () => {
    const { free, card, under } = cardOverRightEdge(
      (r) => r.y - 0.1,
      () => 1,
    );
    const e = extent({ ...SHOT, keepOut: [card], slide: true }, WIDE);
    expect(e.projected.some(under)).toBe(false);
    expect(reach(e)).toBeLessThan(reach(free) * 1.03);
    // Off center, then: the picture slid down, out of the card's way, and still inside the margin,
    // while the camera looks the same way at much the same place.
    expect(e.pose.shift.y).toBeLessThan(0);
    expect((e.y0 + e.y1) / 2).toBeLessThan(-0.05);
    expect(e.y0).toBeGreaterThanOrEqual(-0.92 - 1e-3);
    const look = (x: typeof e) => x.pose.target.clone().sub(x.pose.position).normalize();
    expect(look(e).dot(look(free))).toBeGreaterThan(0.9999);
  });

  it('pulls back from a card down a whole side, which no slide gets every point out from under', () => {
    const { free, card, under } = cardOverRightEdge(
      () => -1,
      () => 1,
    );
    const e = extent({ ...SHOT, keepOut: [card], slide: true }, WIDE);
    expect(e.projected.some(under)).toBe(false);
    expect(reach(e)).toBeGreaterThan(reach(free) * 1.03);
  });

  it('keeps the points centered, pulling back instead, unless the shot lets them slide', () => {
    const { free, card, under } = cardOverRightEdge(
      (r) => r.y - 0.1,
      () => 1,
    );
    const e = extent({ ...SHOT, keepOut: [card] }, WIDE);
    expect(e.projected.some(under)).toBe(false);
    expect(Math.abs((e.y0 + e.y1) / 2)).toBeLessThan(0.01);
    expect(reach(e)).toBeGreaterThan(reach(free) * 1.03);
  });

  it('ignores a card it cannot get the points out from under', () => {
    const free = extent(SHOT, WIDE);
    const everywhere = { x0: -1, y0: -1, x1: 1, y1: 1 };
    const e = extent({ ...SHOT, keepOut: [everywhere] }, WIDE);
    expect(e.pose.position.distanceTo(free.pose.position)).toBeLessThan(1e-6);
  });

  it('looks no lower than its floor: along the same line, from the same place, the same picture', () => {
    const free = extent(SHOT, WIDE);
    const floor = free.pose.target.y + 1;
    const e = extent({ ...SHOT, floor }, WIDE);
    expect(e.pose.target.y).toBeCloseTo(floor, 6);
    expect(e.pose.position.distanceTo(free.pose.position)).toBeLessThan(1e-6);
    const look = (x: typeof e) => x.pose.target.clone().sub(x.pose.position).normalize();
    expect(look(e).dot(look(free))).toBeGreaterThan(0.999999);
  });

  it('stands no nearer than its nearest for how high it looks, stepping back along its line', () => {
    const free = extent(SHOT, WIDE);
    const near = free.pose.position.distanceTo(free.pose.target) * 1.5;
    const e = extent({ ...SHOT, nearestAt: () => near }, WIDE);
    expect(e.pose.position.distanceTo(e.pose.target)).toBeCloseTo(near, 6);
    expect(e.pose.target.distanceTo(free.pose.target)).toBeLessThan(1e-6);
  });

  it('gives a finite pose for a single point', () => {
    const { pose } = extent({ ...SHOT, mustSee: [[5, 1, 0]] }, WIDE);
    for (const n of [...pose.position.toArray(), ...pose.target.toArray()]) {
      expect(Number.isFinite(n)).toBe(true);
    }
  });
});
