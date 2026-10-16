/**
 * Small pieces the stops share: concrete pads, strips drawn on the cut face, trees, flames and
 * drifting puffs, and the materials for things that glow.
 */
import {
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { DIORAMA_COLORS as C, WORLD_COLORS } from '../../../design/tokens.ts';
import type { Finish } from '../../../kit3d/materials.ts';
import type { Finishes, Parts, Point } from './build.ts';
import { FACE } from './layout.ts';

/** A concrete pad on the ground: matte, like the ground it lies on. */
export function pad(parts: Parts, w: number, d: number, x: number, z: number, hex: string = C.pad) {
  parts.box(w, 0.08, d, hex, x, 0, z, { cast: false, finish: 'matte' });
  parts.pads.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
}

/** A vertical strip drawn on the cut face, from y0 down to y1, `dz` proud of it, in a finish. */
export function faceStrip(
  parts: Parts,
  x: number,
  y0: number,
  y1: number,
  w: number,
  hex: string,
  dz = 0,
  finish: Finish = 'paint',
) {
  parts.box(w, y0 - y1, 0.06, hex, x, y1, FACE + dz, { cast: false, finish });
}

/** A tree: a trunk and a soft, round crown, like the lab's, matte as leaves are. */
export function tree(
  parts: Parts,
  x: number,
  z: number,
  s = 1,
  foliage: string = WORLD_COLORS.foliage,
) {
  const matte = { finish: 'matte' } as const;
  parts.cyl(0.1 * s, 0.14 * s, 0.9 * s, WORLD_COLORS.trunk, x, 0, z, { ...matte, segments: 6 });
  parts.ball(0.85 * s, foliage, x, 1.55 * s, z, { ...matte, segments: 16 });
  parts.ball(0.6 * s, foliage, x + 0.25 * s, 2.15 * s, z - 0.1 * s, { ...matte, segments: 12 });
}

/** A material that glows: fire, a furnace window, a lit screen. Only these bloom. */
export function glowing(hex: string, intensity: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(hex),
    emissive: new Color(hex),
    emissiveIntensity: intensity,
    roughness: 0.8,
    metalness: 0,
  });
}

/** How brightly fire glows: above the bloom threshold, so it blooms, as the signal does. */
export const FLAME_GLOW = 5;

/**
 * A flame: a soft outer tongue and a pale core, which fade with their stop. It flickers by its
 * group's scale.
 */
export function flame(parent: Object3D, finishes: Finishes, at: Point, s = 1): Object3D {
  const g = new Object3D();
  g.position.set(...at);
  const shape = new IcosahedronGeometry(1, 1);
  const outer = new Mesh(shape, finishes.track(glowing(C.flame, FLAME_GLOW)));
  outer.position.y = 0.55 * s;
  outer.scale.set(0.32 * s, 0.62 * s, 0.32 * s);
  const core = new Mesh(shape, finishes.track(glowing(C.flameCore, FLAME_GLOW)));
  core.position.y = 0.36 * s;
  core.scale.set(0.17 * s, 0.38 * s, 0.17 * s);
  for (const m of [outer, core]) {
    m.castShadow = false;
    g.add(m);
  }
  parent.add(g);
  return g;
}

/**
 * Puffs drifting up from a point: steam, smoke or the added smell. Each rises and swells, then
 * shrinks away, on its own phase; one draw for the lot. They fade with their stop.
 */
export class Puffs {
  readonly mesh: InstancedMesh;
  private readonly matrix = new Matrix4();
  private readonly at = new Vector3();
  private readonly size = new Vector3();
  private readonly turn = new Quaternion();
  private readonly count: number;
  private readonly from: Point;
  private readonly rise: number;
  private readonly spread: number;
  private readonly cycle: number;

  constructor(
    parent: Object3D,
    finishes: Finishes,
    count: number,
    hex: string,
    from: Point,
    { rise = 3, spread = 0.6, cycle = 2.6 } = {},
  ) {
    this.count = count;
    this.from = from;
    this.rise = rise;
    this.spread = spread;
    this.cycle = cycle;
    const material = finishes.track(
      new MeshStandardMaterial({
        color: new Color(hex),
        roughness: 1,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.mesh = new InstancedMesh(new IcosahedronGeometry(0.3, 0), material, count);
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    this.update(0, false);
  }

  /** Places the puffs for time t; `on` false hides them. */
  update(t: number, on: boolean) {
    this.mesh.visible = on;
    if (!on) return;
    for (let i = 0; i < this.count; i++) {
      const p = (t / this.cycle + i / this.count) % 1;
      this.at.set(
        this.from[0] + Math.sin(i * 7.1) * this.spread * p,
        this.from[1] + p * this.rise,
        this.from[2] + Math.cos(i * 3.3) * this.spread * p,
      );
      // Swells as it rises, then shrinks away at the end of its life.
      const s = (0.4 + p * 1.4) * Math.min(1, (1 - p) * 4);
      this.size.setScalar(Math.max(0.001, s));
      this.matrix.compose(this.at, this.turn, this.size);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
