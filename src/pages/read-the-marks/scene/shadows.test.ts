/**
 * The yard's shadows hold still: its shadow map is drawn once, and again only when the ground is
 * built anew along the lines that are open, so nothing that moves may cast into it. The lids that
 * slide off the cuts, and the flags and paint that move with them, cast nothing; everything that
 * does cast stays where it is while the ground opens and closes, by day and by night.
 */
import { InstancedMesh, Vector3, type Mesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { buildBuildings } from './buildings.ts';
import { buildFixtures } from './fixtures.ts';
import { buildGround, groundMaterials } from './ground.ts';
import { MARKS } from './layout.ts';
import { buildLines } from './lines.ts';
import { buildMarks } from './marks.ts';

/** Every mesh in an object's tree. */
function meshesOf(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((object) => {
    if ((object as Partial<Mesh>).isMesh === true) found.push(object as Mesh);
  });
  return found;
}

/** Every line's ground open at once, as at the end of a round. */
const OPEN = MARKS.filter((m) => m.line).map((m) => m.id);

describe('the yard’s shadows', () => {
  const ground = buildGround(OPEN, groundMaterials());
  const marks = buildMarks();
  const buildings = buildBuildings();
  const lines = buildLines();
  const fixtures = buildFixtures();

  it('come from nothing that moves: no lid, flag or paint mark casts', () => {
    expect(ground.lids.length).toBeGreaterThanOrEqual(OPEN.length);
    for (const lid of ground.lids) {
      for (const mesh of meshesOf(lid.group)) expect(mesh.castShadow, lid.group.name).toBe(false);
    }
    for (const mesh of meshesOf(marks.group)) {
      expect(mesh.castShadow, `a ${mesh.type} among the marks`).toBe(false);
    }
  });

  it('hold still: what casts stays put as every line’s ground opens and closes, day and night', () => {
    const roots = [ground.group, buildings.group, lines.group, fixtures];
    for (const root of roots) root.updateMatrixWorld(true);
    const casters = roots.flatMap(meshesOf).filter((mesh) => mesh.castShadow);
    expect(casters.length).toBeGreaterThan(0);
    const before = casters.map((mesh) => ({
      world: mesh.matrixWorld.clone(),
      instances: mesh instanceof InstancedMesh ? [...mesh.instanceMatrix.array] : null,
    }));
    // Each lid slides aside and back, as the scene moves it, its paint riding along and its
    // flags stepping off; the marks are lit in turn, and the night comes on.
    for (const t of [0.3, 0.7, 1, 0.5, 0]) {
      for (const lid of ground.lids) {
        const offset = new Vector3(
          lid.aside.x * lid.reach * t,
          -0.34 * Math.min(1, t * 3),
          lid.aside.z * lid.reach * t,
        );
        lid.group.position.copy(offset);
        marks.setRun(lid.mark, lid.run, offset, t, t >= 1);
      }
    }
    for (const m of MARKS) marks.setFocus(m.id, true);
    marks.setFocus(null, false);
    marks.setNight(true);
    lines.setNight(true);
    buildings.setLamps(1);
    for (const root of roots) root.updateMatrixWorld(true);
    casters.forEach((mesh, i) => {
      const was = before[i];
      if (!was) throw new Error('a caster not measured');
      expect(mesh.matrixWorld.equals(was.world), `a ${mesh.type} casts but moves`).toBe(true);
      if (was.instances && mesh instanceof InstancedMesh) {
        expect([...mesh.instanceMatrix.array], `a ${mesh.type}'s copies cast but move`).toEqual(
          was.instances,
        );
      }
    });
  });
});
