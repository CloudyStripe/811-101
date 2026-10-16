/**
 * The street block, cut out as a slab: soil strata and trench in section on its faces, and the
 * street surface on top. Each layer has its own grain, so the cut reads as earth, not paint, and
 * the lawns have patches and worn edges, so they never look mown flat.
 */
import {
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { MATERIAL_COLORS as C } from '../../../design/tokens.ts';
import { merge, roundedBox } from '../../../kit3d/geometry.ts';
import { surface, type NoiseOptions } from '../../../kit3d/materials.ts';
import { mulberry32 } from '../../../kit3d/rng.ts';
import { DRIVEWAY, PATCH, SURFACE, type LabLayout, type StratumName } from './layout.ts';

/**
 * An axis-aligned slab between two corners, with softly rounded edges, never rounder than it can
 * hold. Small, many parts (panels, seals) need only one segment per edge: their rounding is a
 * pixel or two on screen.
 */
function slab(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  radius = 0.24,
  segments = 3,
): BufferGeometry {
  const r = Math.min(radius, 0.45 * Math.min(x1 - x0, y1 - y0, z1 - z0));
  return roundedBox(
    x1 - x0,
    y1 - y0,
    z1 - z0,
    r,
    [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    segments,
  );
}

/** A sidewalk panel's slab, its corners in any order. */
function panel(x0: number, x1: number, z0: number, z1: number): BufferGeometry {
  return slab(
    Math.min(x0, x1),
    Math.max(x0, x1),
    0,
    0.3,
    Math.min(z0, z1),
    Math.max(z0, z1),
    0.06,
    1,
  );
}

/** Sidewalk along x in 5 ft panels with tooled joints. */
function panelsAlongX(x0: number, x1: number, z0: number, z1: number): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  for (let x = x0; x < x1 - 0.1; x += 5) {
    parts.push(panel(x + 0.03, Math.min(x + 5, x1) - 0.03, z0, z1));
  }
  return parts;
}

/** The parts of [x0, x1] not cut by the given spans: where a strip of pavement or lawn runs. */
function spansBetween(
  x0: number,
  x1: number,
  cuts: readonly { x0: number; x1: number }[],
): { x0: number; x1: number }[] {
  const out: { x0: number; x1: number }[] = [];
  let start = x0;
  for (const cut of [...cuts].sort((a, b) => a.x0 - b.x0)) {
    if (cut.x1 <= start || cut.x0 >= x1) continue;
    if (cut.x0 > start) out.push({ x0: start, x1: cut.x0 });
    start = Math.max(start, cut.x1);
  }
  if (start < x1) out.push({ x0: start, x1 });
  return out;
}

function mesh(geometry: BufferGeometry, material: Material, cast = false): Mesh {
  const m = new Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

/** How each layer looks in section: its grain, and the stones in it, scaled with the drawn depth. */
function stratumLook(name: StratumName, depth: number): NoiseOptions {
  const k = Math.sqrt(depth);
  const look: Record<StratumName, NoiseOptions> = {
    topsoil: { scale: 0.9, amount: 0.16, pebbles: { scale: 0.55, amount: 0.2 } },
    subsoil: { scale: 1.4, amount: 0.13, pebbles: { scale: 0.75, amount: 0.14 } },
    clay: { scale: 2.8, amount: 0.08 },
    gravel: { scale: 0.45, amount: 0.2, pebbles: { scale: 0.34, amount: -0.3 } },
    rock: { scale: 3.6, amount: 0.12, pebbles: { scale: 1.8, amount: 0.16 } },
  };
  const { scale, amount, pebbles } = look[name];
  return {
    scale: scale * k,
    amount,
    ...(pebbles ? { pebbles: { scale: pebbles.scale * k, amount: pebbles.amount } } : {}),
  };
}

/** A low-poly blob with smooth normals, so it shades soft rather than faceted. */
function tuft(radius: number): BufferGeometry {
  const geometry = new IcosahedronGeometry(radius, 0);
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const v = new Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    normal.setXYZ(i, v.x, v.y, v.z);
  }
  return geometry;
}

export interface Street {
  readonly group: Group;
  /** Shows a share of the grass clumps, per quality tier. */
  setDetail(share: number): void;
}

export function buildStreet(layout: LabLayout): Street {
  const { block, strata, trench, hookup, hydrant } = layout;
  const group = new Group();
  group.name = 'street';
  const { x0: X0, x1: X1 } = block;

  // Soil strata, the slab's full length. Above the trench bottom they stop at the trench, which
  // starts at the hookup and runs on under the street; below it they reach the face.
  const layers = strata.map((s) => {
    const parts: BufferGeometry[] = [];
    if (s.bottom >= trench.bottom) {
      parts.push(slab(X0, trench.x0, s.bottom, s.top, block.z0, block.z1, 0.04, 1));
      parts.push(slab(trench.x0, X1, s.bottom, s.top, block.z0, trench.zBack, 0.04, 1));
    } else {
      parts.push(slab(X0, X1, s.bottom, s.top, block.z0, block.z1, 0.04, 1));
    }
    return mesh(
      merge(parts),
      surface(C[s.name], {
        finish: 'matte',
        roughness: 1,
        noise: stratumLook(s.name, layout.depth),
      }),
      true,
    );
  });
  group.add(...layers);
  group.add(
    mesh(
      slab(trench.x0, X1, trench.bottom, 0, trench.zBack, block.z1, 0.04, 1),
      surface(C.backfill, {
        finish: 'matte',
        roughness: 1,
        noise: { scale: 0.8, amount: 0.2, pebbles: { scale: 0.5, amount: 0.16 } },
      }),
      true,
    ),
  );

  // Surface, front to back.
  const grass = surface(C.grass, {
    finish: 'matte',
    roughness: 1,
    noise: {
      scale: 2.6,
      amount: 0.12,
      lawn: {
        patch: { hex: C.grassPatch, scale: 9, share: 0.8 },
        worn: { hex: C.grassWorn, width: 1.3, around: layout.worn },
      },
    },
  });
  const concrete = surface(C.concrete, { noise: { scale: 3, amount: 0.06 } });
  const concreteNew = surface(C.concreteNew, { noise: { scale: 3, amount: 0.05 } });
  const curb = surface(C.curb, { noise: { scale: 2.5, amount: 0.05 } });
  const asphalt = surface(C.asphalt, {
    finish: 'matte',
    roughness: 0.95,
    noise: { scale: 0.7, amount: 0.12 },
  });
  const seal = surface(C.asphaltSeal, { roughness: 0.6 });

  const verge = spansBetween(X0, X1, [DRIVEWAY]);
  const grassParts = [
    ...verge.map((s) => slab(s.x0, s.x1, 0, 0.12, SURFACE.vergeBack, 0, 0.06, 1)),
    slab(X0, X1, 0, 0.12, block.z0, SURFACE.sidewalkBack, 0.06, 1),
  ];
  const concreteParts = [
    // Driveway apron with a curb cut; the patch fills its middle.
    slab(DRIVEWAY.x0, PATCH.x0 - 0.03, 0, 0.3, SURFACE.vergeBack, 0, 0.12),
    slab(PATCH.x1 + 0.03, DRIVEWAY.x1, 0, 0.3, SURFACE.vergeBack, 0, 0.12),
    slab(DRIVEWAY.x0, DRIVEWAY.x1, -0.02, 0.24, SURFACE.gutterBack, SURFACE.vergeBack - 0.03, 0.12),
    // Gutter pans.
    ...verge.map((s) =>
      slab(s.x0, s.x1, -0.06, 0.06, SURFACE.gutterBack, SURFACE.curbBack, 0.12, 1),
    ),
    slab(X0, X1, -0.06, 0.06, SURFACE.farGutterBack, SURFACE.streetBack, 0.12, 1),
    // The far sidewalk.
    ...panelsAlongX(X0, X1, SURFACE.sidewalkBack, SURFACE.farCurbBack),
    // Stepping stones across the far lawn.
    ...layout.steppingStones.map((r) => slab(r.x0, r.x1, 0, 0.2, r.z0, r.z1, 0.12, 2)),
  ];
  const curbParts = [
    ...verge.map((s) => slab(s.x0, s.x1, 0, 0.5, SURFACE.curbBack, SURFACE.curbFront, 0.16)),
    slab(X0, X1, 0, 0.5, SURFACE.farCurbBack, SURFACE.farGutterBack, 0.16),
  ];
  const asphaltParts = [
    slab(X0, X1, -0.12, 0.02, SURFACE.streetBack, SURFACE.gutterBack, 0.06),
    // An old trench patch in the street.
    slab(30, 38.5, -0.1, 0.035, -21, -13, 0.04),
  ];
  // Crack-seal lines: thin, slightly raised, irregular.
  const rand = mulberry32(811);
  const sealParts: BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const x = X0 + 8 + rand() * (X1 - X0 - 16);
    const z0 = SURFACE.streetBack + 1 + rand() * 6;
    const len = 4 + rand() * 10;
    sealParts.push(
      slab(x - 0.09, x + 0.09, 0.0, 0.045, z0, Math.min(z0 + len, SURFACE.gutterBack - 0.5), 0.03),
    );
  }
  sealParts.push(slab(X0 + 2, X1 - 2, 0.0, 0.045, -17.6, -17.42, 0.03));

  group.add(
    mesh(merge(grassParts), grass),
    mesh(merge(concreteParts), concrete, true),
    mesh(slab(PATCH.x0, PATCH.x1, 0, 0.29, SURFACE.vergeBack, 0, 0.05), concreteNew, true),
    mesh(merge(curbParts), curb, true),
    mesh(merge(asphaltParts), asphalt),
    mesh(merge(sealParts), seal),
  );

  // Hydrant: white paint, since paint colors on hydrants mean other things.
  const hydrantBody = surface('#f1f3f5', { finish: 'paint' });
  const hydrantMetal = surface(C.steel, { finish: 'metal' });
  const hx = hydrant.x;
  const hz = hydrant.z;
  group.add(
    mesh(
      merge([
        new CylinderGeometry(0.34, 0.38, 2.1, 32).translate(hx, 1.2, hz),
        new SphereGeometry(0.36, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).translate(hx, 2.25, hz),
        new CylinderGeometry(0.15, 0.15, 0.95, 24).rotateX(Math.PI / 2).translate(hx, 1.55, hz),
        new CylinderGeometry(0.15, 0.15, 0.95, 24).rotateZ(Math.PI / 2).translate(hx, 1.55, hz),
      ]),
      hydrantBody,
      true,
    ),
    mesh(
      merge([
        new CylinderGeometry(0.5, 0.52, 0.16, 32).translate(hx, 0.2, hz),
        new CylinderGeometry(0.09, 0.09, 0.22, 6).translate(hx, 2.65, hz),
      ]),
      hydrantMetal,
      true,
    ),
  );

  // Telecom pedestal: a neutral gray box, as many are.
  const pedestal = surface('#c5cbd2', { finish: 'paint' });
  group.add(
    mesh(
      roundedBox(1.0, 2.5, 0.8, 0.12, [hookup.pedestal.x, 1.25, hookup.pedestal.z]),
      pedestal,
      true,
    ),
    mesh(
      roundedBox(1.08, 0.14, 0.88, 0.05, [hookup.pedestal.x, 2.55, hookup.pedestal.z]),
      surface(C.graphite, { finish: 'paint' }),
      true,
    ),
  );

  // Grass: soft, low tufts rather than blades, seeded and instanced, thinned on lower tiers. Smooth
  // shading and the verge's own greens keep them a texture on the lawn, not spots on it.
  const clump = merge([
    tuft(0.2).scale(1, 0.42, 1).translate(0, 0.05, 0),
    tuft(0.15).scale(1, 0.48, 1).translate(0.17, 0.03, 0.05),
    tuft(0.14).scale(1, 0.48, 1).translate(-0.12, 0.03, -0.1),
  ]);
  const clumpMaterial = surface('#ffffff', { finish: 'matte', roughness: 1 });
  // Clear of the equipment, at the size it's drawn.
  const k = layout.equipment;
  const avoid = [
    { ...hookup.transmitter, r: 0.3 + 1.2 * k },
    { ...hookup.access, r: 0.4 + 0.5 * k },
    { x: hookup.stake.x, z: hookup.stake.z, r: 0.4 + 0.3 * k },
    { ...hookup.pedestal, r: 1.1 },
    { ...hydrant, r: 1.0 },
  ];
  const onStone = (x: number, z: number) =>
    layout.steppingStones.some(
      (r) => x > r.x0 - 0.3 && x < r.x1 + 0.3 && z > r.z0 - 0.3 && z < r.z1 + 0.3,
    );
  const positions: Vector3[] = [];
  const area = (x0: number, x1: number, z0: number, z1: number, count: number) => {
    let placed = 0;
    while (placed < count) {
      const x = x0 + rand() * (x1 - x0);
      const z = z0 + rand() * (z1 - z0);
      if (x > DRIVEWAY.x0 - 0.3 && x < DRIVEWAY.x1 + 0.3 && z > SURFACE.vergeBack) continue;
      if (avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.r)) continue;
      if (onStone(x, z)) continue;
      positions.push(new Vector3(x, 0.1, z));
      placed++;
    }
  };
  area(X0 + 0.5, X1 - 0.5, SURFACE.vergeBack + 0.3, -0.3, 900);
  area(X0 + 0.5, X1 - 0.5, block.z0 + 0.3, SURFACE.sidewalkBack - 0.3, 420);
  // Seeded shuffle, so thinning for lower tiers removes clumps evenly everywhere.
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = positions[i];
    const b = positions[j];
    if (a && b) {
      positions[i] = b;
      positions[j] = a;
    }
  }
  const clumps = new InstancedMesh(clump, clumpMaterial, positions.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const up = new Vector3(0, 1, 0);
  const light = new Color(C.grassLight);
  const base = new Color(C.grass);
  const c = new Color();
  positions.forEach((p, i) => {
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    const k = 0.8 + rand() * 0.7;
    s.set(k, k * (0.8 + rand() * 0.4), k);
    clumps.setMatrixAt(i, m.compose(p, q, s));
    clumps.setColorAt(i, c.copy(base).lerp(light, rand()));
  });
  clumps.receiveShadow = true;
  group.add(clumps);

  return {
    group,
    setDetail(share: number) {
      clumps.count = Math.round(positions.length * Math.min(1, Math.max(0, share)));
    },
  };
}
