/**
 * The buried lines, each in its full APWA color: a teaching aid, as in the lab, since real pipe and
 * cable colors underground are unreliable. A line runs from under the street, or from the box it
 * leaves, to where it ends; the sewer line rises to its cleanout, and the gas line to the riser up to
 * its meter. Hidden in the ground until the
 * ground opens along it; at night each keeps a faint glow of its own color.
 */
import {
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  type BufferGeometry,
  type MeshStandardMaterial,
} from 'three';
import { APWA } from '../../../design/apwa.ts';
import { merge } from '../../../kit3d/geometry.ts';
import { surface } from '../../../kit3d/materials.ts';
import type { MarkId } from '../game.ts';
import { FIXTURES, MARKS, TOPS, runsAlongZ, segmentsOf, type Line } from './layout.ts';

/** How brightly a line glows at night, as emissive intensity: well under bloom. */
export const LINE_GLOW = 0.3;

/** A line's runs as round pipes, with a round joint at each turn. */
function pipeOf(line: Line): BufferGeometry {
  const r = line.radius;
  const y = -line.depth;
  const parts: BufferGeometry[] = [];
  const runs = segmentsOf(line);
  runs.forEach((run, i) => {
    const [a, b] = run;
    const z = runsAlongZ(run);
    // Each end reaches a little past its point: into the box, the wall, or the joint.
    const reach = i === runs.length - 1 ? 0.3 : 0;
    const from = z ? a.z : a.x;
    const to = z ? b.z : b.x;
    const dir = Math.sign(to - from);
    const s = from - dir * (i === 0 ? 0.3 : 0);
    const e = to + dir * reach;
    const length = Math.abs(e - s);
    const mid = (s + e) / 2;
    const g = new CylinderGeometry(r, r, length, 24, 1, true);
    if (z) g.rotateX(Math.PI / 2).translate(a.x, y, mid);
    else g.rotateZ(Math.PI / 2).translate(mid, y, a.z);
    parts.push(g);
    if (i > 0) parts.push(new SphereGeometry(r, 24, 12).translate(a.x, y, a.z));
  });
  return merge(parts);
}

export interface Lines {
  group: Group;
  setNight(night: boolean): void;
  dispose(): void;
}

export function buildLines(): Lines {
  const group = new Group();
  group.name = 'lines';
  const materials: MeshStandardMaterial[] = [];
  const meshes = new Map<MarkId, Mesh>();
  for (const mark of MARKS) {
    if (!mark.line) continue;
    const hex = APWA[mark.color].fill;
    const material = surface(hex, { finish: 'paint', emissive: hex });
    material.emissiveIntensity = 0;
    materials.push(material);
    const parts = [pipeOf(mark.line)];
    // The sewer line rises to its cleanout's cap at the surface, and the gas line to the foot of
    // its meter's riser, at the ground.
    const riser =
      mark.id === 'sewer'
        ? { at: FIXTURES.cleanout, radius: 0.24, top: TOPS.grass }
        : mark.id === 'gas'
          ? { at: FIXTURES.gasRiser, radius: 0.16, top: 0 }
          : null;
    if (riser) {
      const { x, z } = riser.at;
      const bottom = -mark.line.depth;
      parts.push(
        new CylinderGeometry(riser.radius, riser.radius, riser.top - bottom, 20, 1, true).translate(
          x,
          (riser.top + bottom) / 2,
          z,
        ),
        new SphereGeometry(mark.line.radius, 20, 10).translate(x, bottom, z),
      );
    }
    const m = new Mesh(merge(parts), material);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = `line ${mark.id}`;
    meshes.set(mark.id, m);
    group.add(m);
  }
  return {
    group,
    setNight(night) {
      for (const m of materials) m.emissiveIntensity = night ? LINE_GLOW : 0;
    },
    dispose() {
      for (const m of meshes.values()) m.geometry.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
