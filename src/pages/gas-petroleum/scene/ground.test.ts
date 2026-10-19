/**
 * The ground the diorama stands on: the block floats in the sky, so nothing outside the model
 * catches a shadow, and no shadow of the block or its buildings falls across the sky beside it.
 */
import { Box3, type Mesh, type Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildGround } from './ground.ts';
import { MODEL_BOX } from './layout.ts';

/** Every mesh in an object's tree. */
function meshesOf(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((object) => {
    if ((object as Partial<Mesh>).isMesh === true) found.push(object as Mesh);
  });
  return found;
}

// The street lamps' pools of light are drawn on a canvas, which the tests run without: any drawing
// call does nothing.
const drawing = new Proxy({}, { get: () => () => ({ addColorStop: () => undefined }) });
vi.stubGlobal('document', {
  createElement: () => ({ width: 0, height: 0, getContext: () => drawing }),
});

describe('the ground', () => {
  const { group } = buildGround();
  group.updateMatrixWorld(true);

  it('catches shadows only on the model itself, never on the sky beside or under it', () => {
    const receivers = meshesOf(group).filter((mesh) => mesh.receiveShadow);
    expect(receivers.length).toBeGreaterThan(0);
    // A little slack for the bevels on the block's edges and the shrubs leaning over them.
    const slack = 1;
    for (const mesh of receivers) {
      const box = new Box3().setFromObject(mesh);
      const name = mesh.name || mesh.geometry.type;
      expect(box.min.x, name).toBeGreaterThanOrEqual(MODEL_BOX.min[0] - slack);
      expect(box.max.x, name).toBeLessThanOrEqual(MODEL_BOX.max[0] + slack);
      expect(box.min.y, name).toBeGreaterThanOrEqual(MODEL_BOX.min[1] - slack);
      expect(box.min.z, name).toBeGreaterThanOrEqual(MODEL_BOX.min[2] - slack);
      expect(box.max.z, name).toBeLessThanOrEqual(MODEL_BOX.max[2] + slack);
    }
  });

  it('has no surface that only shows shadows', () => {
    const shadowOnly = meshesOf(group).filter((mesh) =>
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some(
        (m) => m.type === 'ShadowMaterial',
      ),
    );
    expect(shadowOnly).toEqual([]);
  });
});
