/** The views, checked with the real camera math: the block must fit the free area. */
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { View } from '../../../kit3d/camera.ts';
import { BLOCK, TALL_VIEW, WIDE_VIEW, viewFor } from './layout.ts';

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
