/**
 * The views and the direction arrows, checked with the real camera math: from each view, the
 * arrows near the hookup must be big enough to read, and the block must fit the free area.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { View } from '../../../kit3d/camera.ts';
import { ARROWS, BLOCK, TALL_VIEW, WIDE_VIEW, arrowPlacement, viewFor } from './layout.ts';

/** The scene's camera, framed on a view for a free area of the given size in CSS pixels. */
function cameraFor(view: View, width: number, height: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(34, width / height, 0.5, 900);
  camera.position.set(...view.position);
  camera.lookAt(new Vector3(...view.target));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function toScreen(camera: PerspectiveCamera, p: Vector3, width: number, height: number) {
  const v = p.clone().project(camera);
  return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, z: v.z };
}

/**
 * On-screen size, in CSS pixels, of an arrow of `size` ft at `x` along a line: its span across
 * the line, and its length along it (tip to back), which the view foreshortens.
 */
function arrowPixels(
  camera: PerspectiveCamera,
  view: { width: number; height: number },
  size: number,
  at: { x: number; y: number; z: number },
) {
  const p = (dx: number, dy: number) =>
    toScreen(camera, new Vector3(at.x + dx, at.y + dy, at.z), view.width, view.height);
  const len = size * ARROWS.stretch;
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  return {
    span: dist(p(-0.54 * len, size / 2), p(-0.54 * len, -size / 2)),
    length: dist(p(0.23 * len, 0), p(-0.77 * len, 0)),
  };
}

const VIEWS = [
  { name: 'wide', view: WIDE_VIEW, width: 1000, height: 900 },
  { name: 'tall', view: TALL_VIEW, width: 390, height: 520 },
] as const;

describe('views', () => {
  it('picks the tall view for portrait free areas and the wide one otherwise', () => {
    expect(viewFor({ x: 0, y: 0, width: 390, height: 520 })).toBe(TALL_VIEW);
    expect(viewFor({ x: 0, y: 0, width: 1000, height: 900 })).toBe(WIDE_VIEW);
  });

  it.each(VIEWS)('$name: the hookup end of the block is in front of the camera', (v) => {
    const camera = cameraFor(v.view, v.width, v.height);
    const p = toScreen(camera, new Vector3(0, 0, 0), v.width, v.height);
    expect(p.z).toBeLessThan(1);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(v.width);
    expect(p.y).toBeGreaterThan(0);
    expect(p.y).toBeLessThan(v.height);
  });

  it('keeps the far end of the block in the tall view', () => {
    const camera = cameraFor(TALL_VIEW, 390, 520);
    const p = toScreen(camera, new Vector3(BLOCK.x1 - 6, -3.6, 0), 390, 520);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(390);
  });
});

describe('direction arrows', () => {
  const lines = [
    { name: 'steel main', size: ARROWS.target.steel, at: arrowPlacement('steel') },
    { name: 'tracer wire', size: ARROWS.target.plastic, at: arrowPlacement('plastic') },
    { name: 'telecom cable', size: ARROWS.telecom, at: arrowPlacement('telecom') },
  ];

  // Near the hookup, where a learner looks first, every arrow must read as an arrow: long enough
  // along the line, not just tall, since the view foreshortens it.
  it.each(lines)('$name: arrows near the hookup are big enough to read', (line) => {
    const x = ARROWS.fromFt + ARROWS.stepFt;
    for (const v of VIEWS) {
      const camera = cameraFor(v.view, v.width, v.height);
      const px = arrowPixels(camera, v, line.size, { x, ...line.at });
      const min = v.name === 'wide' ? 10 : 6;
      expect(px.span, `${v.name} span`).toBeGreaterThanOrEqual(min);
      expect(px.length, `${v.name} length`).toBeGreaterThanOrEqual(min);
    }
  });

  it('stand in front of the line they mark, on the cut-face side', () => {
    for (const line of lines) expect(line.at.z).toBeGreaterThan(0);
  });
});
