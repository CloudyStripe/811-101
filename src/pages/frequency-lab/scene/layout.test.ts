/** The views, checked with the real camera math: what the lesson needs must fit the free area. */
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { areaCamera, fitShot } from '../../../kit3d/fit.ts';
import type { View } from '../../../kit3d/camera.ts';
import { MUST_SEE, TALL_VIEW, WIDE_VIEW, viewFor } from './layout.ts';

const FOV = 34;

/** The camera, fitted to a view, covering a free area of the given size inside a canvas. */
function fitted(view: View, width: number, height: number, canvasHeight: number) {
  const area = { width, height, canvasHeight };
  const pose = fitShot(
    { from: view.position, to: view.target, mustSee: view.mustSee ?? [] },
    FOV,
    area,
    view.margin,
  );
  const camera = areaCamera(FOV, area);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  camera.updateMatrixWorld();
  return camera;
}

const CASES = [
  // Desktop with the guide open beside the view, and a phone between its header and sheet.
  { name: 'wide', view: WIDE_VIEW, width: 1000, height: 900, canvasHeight: 900 },
  { name: 'tall', view: TALL_VIEW, width: 390, height: 520, canvasHeight: 844 },
  { name: 'short', view: WIDE_VIEW, width: 540, height: 390, canvasHeight: 390 },
] as const;

describe('views', () => {
  it('picks the tall view for portrait free areas and the wide one otherwise', () => {
    expect(viewFor({ x: 0, y: 0, width: 390, height: 520 })).toBe(TALL_VIEW);
    expect(viewFor({ x: 0, y: 0, width: 1000, height: 900 })).toBe(WIDE_VIEW);
  });

  it.each(CASES)('$name: everything the lesson needs fits the free area', (c) => {
    const camera = fitted(c.view, c.width, c.height, c.canvasHeight);
    for (const p of MUST_SEE) {
      const v = new Vector3(...p).project(camera);
      expect(v.z, `${p.join(',')} in front`).toBeLessThan(1);
      expect(Math.abs(v.x), `${p.join(',')} across`).toBeLessThanOrEqual(1);
      expect(Math.abs(v.y), `${p.join(',')} up and down`).toBeLessThanOrEqual(1);
    }
  });

  it.each(CASES)('$name: the view fills the free area, not just fits in it', (c) => {
    const camera = fitted(c.view, c.width, c.height, c.canvasHeight);
    const xs = MUST_SEE.map((p) => new Vector3(...p).project(camera).x);
    const ys = MUST_SEE.map((p) => new Vector3(...p).project(camera).y);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    // The must-see points reach the margin one way or the other: the view is as close as it fits.
    const margin = c.view.margin ?? 0.08;
    expect(span).toBeGreaterThan(2 * (1 - margin) - 0.02);
  });
});
