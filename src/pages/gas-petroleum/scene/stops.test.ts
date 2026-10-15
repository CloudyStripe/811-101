/**
 * The thirteen stops as built: in the content's order, each with its labels' words in the content,
 * shadows only from still parts, and on the two paths, every material fading with the filter.
 */
import type { Matrix4, Mesh, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import {
  DETAILS,
  STOPS,
  TIMELAPSE,
  stopById,
} from '../../../../content/utilities/gas-petroleum.ts';
import { buildStops } from './stops/index.ts';
import type { TimeLapse } from './timelapse.ts';

const timeLapse: { current: TimeLapse | null } = { current: null };
const models = buildStops(timeLapse);

/** Every mesh in an object's tree. */
function meshesOf(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((object) => {
    if ((object as Partial<Mesh>).isMesh === true) found.push(object as Mesh);
  });
  return found;
}

describe('the stops', () => {
  it("are built in the content's order, the formation's with its time-lapse", () => {
    expect(models.map((m) => m.id)).toEqual(STOPS.map((s) => s.id));
    expect(timeLapse.current).not.toBeNull();
  });

  it('step through the time-lapse, each step held where the clock reads its own time', () => {
    const lapse = timeLapse.current;
    if (!lapse) throw new Error('no time-lapse');
    TIMELAPSE.forEach((entry, i) => {
      lapse.seekStep(i);
      expect(lapse.state).toMatchObject({ playing: false, caption: i, ma: entry.ma });
    });
    // The last step is today: the column whole again.
    expect(lapse.state.progress).toBe(1);
    lapse.seekStep(0);
    lapse.reset();
    expect(lapse.state).toMatchObject({ progress: 1, ma: 0 });
  });

  it.each(models.map((m) => [m.id, m] as const))(
    '%s: every label on its parts has words in the content, and all its words are used',
    (id, model) => {
      const keys = Object.keys(DETAILS[id]);
      const used = model.details.map((d) => d.key);
      expect(new Set(used).size, 'no label twice').toBe(used.length);
      expect([...used].sort()).toEqual([...keys].sort());
    },
  );

  it.each(models.map((m) => [m.id, m] as const))(
    '%s: only still parts cast shadows, since the shadow map is drawn once',
    (_id, model) => {
      model.root.updateMatrixWorld(true);
      const casters: [Mesh, Matrix4][] = meshesOf(model.root)
        .filter((mesh) => mesh.castShadow)
        .map((mesh) => [mesh, mesh.matrixWorld.clone()]);
      // The stop's machines run for a while, with the stop open and closed.
      for (let i = 1; i <= 24; i++) model.animate?.({ time: i * 0.37, dt: 0.37, open: i % 2 });
      model.root.updateMatrixWorld(true);
      for (const [mesh, before] of casters) {
        expect(mesh.matrixWorld.equals(before), `a ${mesh.type} casts but moves`).toBe(true);
      }
    },
  );

  it.each(models.filter((m) => stopById(m.id).path !== 'shared').map((m) => [m.id, m] as const))(
    '%s: everything it is made of fades when the path filter dims it',
    (_id, model) => {
      for (const mesh of meshesOf(model.root)) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          expect(material.customProgramCacheKey(), `a ${mesh.type} fades`).toBe('gp-fade');
        }
      }
    },
  );

  it.each(models.map((m) => [m.id, m] as const))(
    '%s: can be opened by a click, and has a direction to be seen from',
    (_id, model) => {
      expect(model.hits.length + (model.followHits?.length ?? 0)).toBeGreaterThan(0);
      for (const box of model.hits) expect(box.isEmpty()).toBe(false);
      const [fx, fy, fz] = model.view.from;
      const [tx, ty, tz] = model.view.to;
      expect(Math.hypot(fx - tx, fy - ty, fz - tz)).toBeGreaterThan(1);
    },
  );
});
