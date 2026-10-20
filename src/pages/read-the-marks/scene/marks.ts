/**
 * The marks: flags on the grass and paint where a line crosses the sidewalk or driveway, each in
 * its full APWA color, larger than life. The mark asked about glows softly on the ground under it,
 * its flags stand a little taller, and the other marks dim a little; its own color never changes.
 * As the ground opens along a line, its flags step aside onto solid ground and its paint goes with
 * the cover it's painted on.
 *
 * Nothing here casts a shadow, as flags move and the shadow map holds still: each flag has a small
 * soft shadow of its own under it instead.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  Quaternion,
  RGBAFormat,
  Vector3,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterial,
} from 'three';
import { APWA } from '../../../design/apwa.ts';
import { merge, roundedBox } from '../../../kit3d/geometry.ts';
import { surface } from '../../../kit3d/materials.ts';
import type { MarkId } from '../game.ts';
import { MARKS, cutsOf, topAt, type Box, type Mark, type MarkSpot, type Point } from './layout.ts';
import { MARK_LOOK as L, YARD_COLORS as Y } from './palette.ts';

/** A soft round spot, white at its middle and clear at its edge: for glows and contact shadows. */
function softSpot(size = 64, falloff = 2): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.min(1, Math.hypot(dx, dy) * 2);
      const a = Math.pow(1 - r, falloff);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const t = new DataTexture(data, size, size, RGBAFormat);
  t.needsUpdate = true;
  return t;
}

/** Which of a line's cuts a spot lies in: its run's index, or -1 for none. */
function runOf(mark: Mark, s: Point): number {
  if (!mark.line) return -1;
  return cutsOf(mark.line).findIndex((c) => s.x > c.x0 && s.x < c.x1 && s.z > c.z0 && s.z < c.z1);
}

interface FlagSlot {
  spot: MarkSpot;
  /** The run whose cut it stands in, or -1. */
  run: number;
}

/** One mark's flags, paint and glow, and the materials that dim it. */
interface MarkParts {
  mark: Mark;
  cloth: MeshStandardMaterial;
  paint: MeshStandardMaterial;
  flags: FlagSlot[];
  clothMesh: InstancedMesh | null;
  hemMesh: InstancedMesh | null;
  stakeMesh: InstancedMesh | null;
  blobMesh: InstancedMesh | null;
  /** Paint, per run of the line it lies over (-1: none), so it can ride with that run's cover. */
  paintGroups: Map<number, Group>;
  glow: Mesh | null;
}

export interface MarkSet {
  group: Group;
  /**
   * The mark the round is on: the rest dim a little, and while it's asked about (`glow`), it
   * glows on the ground and its flags stand taller. None: all as they are.
   */
  setFocus(id: MarkId | null, glow: boolean): void;
  setNight(night: boolean): void;
  /**
   * Places a line's marks as its ground opens: flags in that run's cut step aside by `step`
   * (0 to 1 of the way), and its paint moves with the cover by `offset`, hidden once it's away.
   */
  setRun(id: MarkId, run: number, offset: Vector3, step: number, away: boolean): void;
  dispose(): void;
}

const UP = new Vector3(0, 1, 0);

export function buildMarks(): MarkSet {
  const group = new Group();
  group.name = 'marks';
  const hem = surface(Y.flagHem, { finish: 'paint', roughness: 0.5 });
  const stake = surface(Y.stake, { finish: 'metal' });
  const spot = softSpot();
  const blob = new MeshBasicMaterial({
    color: '#000000',
    alphaMap: spot,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: NormalBlending,
  });
  const glowMaterial = new MeshBasicMaterial({
    color: '#fff7e6',
    map: spot,
    transparent: true,
    opacity: L.glow.strength,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const f = L.flag;
  // A flag's cloth and hem, its bottom edge at its height up the stake, hung off to the stake's
  // right; the stake; a soft shadow at its foot.
  const clothGeometry = roundedBox(
    f.width,
    f.height,
    0.05,
    0.03,
    [f.width / 2 + 0.06, f.stake - f.height / 2, 0],
    1,
  );
  const hemGeometry = roundedBox(
    f.width + 2 * f.hem,
    f.height + 2 * f.hem,
    0.03,
    0.03,
    [f.width / 2 + 0.06, f.stake - f.height / 2, -0.03],
    1,
  );
  const stakeGeometry = new CylinderGeometry(f.stakeRadius, f.stakeRadius, f.stake, 8).translate(
    0,
    f.stake / 2,
    0,
  );
  const blobGeometry = new PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2).translate(0.15, 0.015, 0);

  const parts: MarkParts[] = MARKS.map((mark) => {
    const hex = APWA[mark.color].fill;
    const cloth = surface(hex, { finish: 'paint', roughness: 0.5, emissive: hex });
    const paint = surface(hex, { finish: 'paint', roughness: 0.55, emissive: hex });
    cloth.emissiveIntensity = 0;
    paint.emissiveIntensity = 0;
    const flags: FlagSlot[] = mark.spots
      .filter((s) => s.form === 'flag')
      .map((s) => ({ spot: s, run: runOf(mark, s) }));
    const instanced = (geometry: BufferGeometry, material: Material) => {
      if (!flags.length) return null;
      const m = new InstancedMesh(geometry, material, flags.length);
      m.castShadow = false;
      m.receiveShadow = true;
      group.add(m);
      return m;
    };
    const p: MarkParts = {
      mark,
      cloth,
      paint,
      flags,
      clothMesh: instanced(clothGeometry, cloth),
      hemMesh: instanced(hemGeometry, hem),
      stakeMesh: instanced(stakeGeometry, stake),
      blobMesh: instanced(blobGeometry, blob),
      paintGroups: new Map(),
      glow: null,
    };
    // Paint, a mesh for each run it lies over.
    const byRun = new Map<number, BufferGeometry[]>();
    for (const s of mark.spots) {
      if (s.form !== 'paint') continue;
      const dash = roundedBox(L.paint.length, 0.025, L.paint.width, 0.012, [0, 0, 0], 1)
        .rotateY(-((s.heading ?? 0) * Math.PI) / 180)
        .translate(s.x, topAt(s) + 0.016, s.z);
      const run = runOf(mark, s);
      const list = byRun.get(run) ?? [];
      list.push(dash);
      byRun.set(run, list);
    }
    for (const [run, geometries] of byRun) {
      const g = new Group();
      const m = new Mesh(merge(geometries), paint);
      m.castShadow = false;
      m.receiveShadow = true;
      g.add(m);
      group.add(g);
      p.paintGroups.set(run, g);
    }
    // The glow under each flag and dash, shown while the mark is asked about.
    const r = L.glow.radius;
    const glows = mark.spots.map((s) =>
      new PlaneGeometry(2 * r, 2 * r).rotateX(-Math.PI / 2).translate(s.x, topAt(s) + 0.006, s.z),
    );
    if (glows.length) {
      p.glow = new Mesh(merge(glows), glowMaterial);
      p.glow.visible = false;
      p.glow.renderOrder = 1;
      group.add(p.glow);
    }
    return p;
  });

  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const at = new Vector3();
  /** Each flag's offset as it steps aside, per mark. */
  const steps = new Map<MarkId, Map<number, Vector3>>();
  /** The mark glowing, its flags standing taller: the one asked about. */
  let lit: MarkId | null = null;

  function placeFlags(p: MarkParts) {
    const lift = p.mark.id === lit ? L.lift : 1;
    q.setFromAxisAngle(UP, L.flagTurn);
    p.flags.forEach((slot, i) => {
      const offset = steps.get(p.mark.id)?.get(slot.run);
      at.set(slot.spot.x + (offset?.x ?? 0), topAt(slot.spot), slot.spot.z + (offset?.z ?? 0));
      s.setScalar(lift);
      m.compose(at, q, s);
      for (const mesh of [p.clothMesh, p.hemMesh, p.stakeMesh]) mesh?.setMatrixAt(i, m);
      s.setScalar(1);
      m.compose(at, q, s);
      p.blobMesh?.setMatrixAt(i, m);
    });
    for (const mesh of [p.clothMesh, p.hemMesh, p.stakeMesh, p.blobMesh]) {
      if (mesh) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
  }
  for (const p of parts) placeFlags(p);

  let night = false;
  let dimmed = new Set<MarkId>();
  const base = new Color();
  function shade(p: MarkParts) {
    const k = dimmed.has(p.mark.id) ? L.dim : 1;
    base.set(APWA[p.mark.color].fill);
    for (const material of [p.cloth, p.paint]) {
      material.color.copy(base).multiplyScalar(k);
      material.emissiveIntensity = night ? L.nightGlow * k : 0;
    }
  }

  return {
    group,
    setFocus(id, glow) {
      lit = glow ? id : null;
      dimmed = new Set(id ? parts.filter((p) => p.mark.id !== id).map((p) => p.mark.id) : []);
      for (const p of parts) {
        shade(p);
        if (p.glow) p.glow.visible = p.mark.id === lit;
        placeFlags(p);
      }
    },
    setNight(isNight) {
      night = isNight;
      glowMaterial.color.set(isNight ? '#dfe7ff' : '#fff7e6');
      for (const p of parts) shade(p);
    },
    setRun(id, run, offset, step, away) {
      const p = parts.find((x) => x.mark.id === id);
      if (!p) return;
      const paint = p.paintGroups.get(run);
      if (paint) {
        paint.position.copy(offset);
        paint.visible = !away;
      }
      const cut = p.mark.line ? cutsOf(p.mark.line)[run] : undefined;
      const byRun = steps.get(id) ?? new Map<number, Vector3>();
      steps.set(id, byRun);
      byRun.set(run, cut ? stepAside(cut, offset, step) : new Vector3());
      placeFlags(p);
    },
    dispose() {
      for (const g of [clothGeometry, hemGeometry, stakeGeometry, blobGeometry]) g.dispose();
      group.traverse((o) => {
        if (o instanceof Mesh && !(o instanceof InstancedMesh))
          (o.geometry as BufferGeometry).dispose();
      });
      for (const p of parts) {
        p.cloth.dispose();
        p.paint.dispose();
      }
      for (const material of [hem, stake, blob, glowMaterial]) material.dispose();
      spot.dispose();
    },
  };
}

/**
 * Where a flag in a cut steps to as the ground opens: across to the far edge of the cut, in the
 * way its cover slides, onto the solid ground there, `step` of the way.
 */
function stepAside(cut: Box, offset: Vector3, step: number): Vector3 {
  const along = Math.hypot(offset.x, offset.z);
  if (along < 1e-6 && step === 0) return new Vector3();
  // The cover slides along `offset`; flags step the cut's half width and a little, the same way.
  const dir = along > 1e-6 ? new Vector3(offset.x / along, 0, offset.z / along) : new Vector3();
  const half = Math.abs(dir.x) > 0.5 ? (cut.x1 - cut.x0) / 2 : (cut.z1 - cut.z0) / 2;
  return dir.multiplyScalar((half + 0.5) * step);
}

/** For tests: a box the size of a flag's cloth, unrotated. */
export const FLAG_BOX = new BoxGeometry(L.flag.width, L.flag.height, 0.05);
