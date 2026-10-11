/** The street block: soil strata and trench on the cut face, and the street surface on top. */
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
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
import { surface } from '../../../kit3d/materials.ts';
import { mulberry32 } from '../../../kit3d/rng.ts';
import { BLOCK, DRIVEWAY, HOOKUP, HYDRANT, PATCH, STRATA, SURFACE, TRENCH } from './layout.ts';

/** An axis-aligned slab between two corners, with softly rounded edges. */
function slab(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  radius = 0.12,
): BufferGeometry {
  return roundedBox(x1 - x0, y1 - y0, z1 - z0, radius, [
    (x0 + x1) / 2,
    (y0 + y1) / 2,
    (z0 + z1) / 2,
  ]);
}

function mesh(geometry: BufferGeometry, material: Material, cast = false): Mesh {
  const m = new Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

export interface Street {
  readonly group: Group;
  /** Shows a share of the grass tufts, per quality tier. */
  setDetail(share: number): void;
}

const TUFT_AVOID: readonly { x: number; z: number; r: number }[] = [
  { ...HOOKUP.transmitter, r: 1.5 },
  { ...HOOKUP.access, r: 0.9 },
  { x: HOOKUP.stake.x, z: HOOKUP.stake.z, r: 0.7 },
  { ...HOOKUP.pedestal, r: 1.1 },
  { ...HYDRANT, r: 1.0 },
];

export function buildStreet(): Street {
  const group = new Group();
  group.name = 'street';
  const soil = (hex: string, amount = 0.18) =>
    surface(hex, { roughness: 1, noise: { scale: 1.3, amount } });

  // Soil strata. Above the trench bottom they stop at the trench; below, they reach the face.
  const strata = STRATA.map((s) => {
    const parts: BufferGeometry[] = [];
    if (s.bottom >= TRENCH.bottom) {
      parts.push(slab(BLOCK.x0, BLOCK.x1, s.bottom, s.top, BLOCK.z0, TRENCH.zBack));
      parts.push(slab(BLOCK.x0, TRENCH.x0, s.bottom, s.top, TRENCH.zBack, BLOCK.z1));
    } else {
      parts.push(slab(BLOCK.x0, BLOCK.x1, s.bottom, s.top, BLOCK.z0, BLOCK.z1));
    }
    return mesh(merge(parts), soil(C[s.name]));
  });
  group.add(...strata);
  group.add(
    mesh(
      slab(TRENCH.x0, TRENCH.x1, TRENCH.bottom, 0, TRENCH.zBack, BLOCK.z1),
      soil(C.backfill, 0.24),
    ),
  );

  // Surface, front to back.
  const grass = surface(C.grass, { roughness: 1, noise: { scale: 2.2, amount: 0.2 } });
  const concrete = surface(C.concrete, { noise: { scale: 3, amount: 0.07 } });
  const concreteNew = surface(C.concreteNew, { noise: { scale: 3, amount: 0.05 } });
  const curb = surface(C.curb, { noise: { scale: 2.5, amount: 0.06 } });
  const asphalt = surface(C.asphalt, { roughness: 0.95, noise: { scale: 0.7, amount: 0.14 } });
  const seal = surface(C.asphaltSeal, { roughness: 0.6 });

  const grassParts = [
    slab(BLOCK.x0, DRIVEWAY.x0, 0, 0.12, SURFACE.vergeBack, 0),
    slab(DRIVEWAY.x1, BLOCK.x1, 0, 0.12, SURFACE.vergeBack, 0),
    slab(BLOCK.x0, BLOCK.x1, 0, 0.12, BLOCK.z0, SURFACE.sidewalkBack),
  ];
  const concreteParts = [
    // Driveway apron with a curb cut; the patch fills its middle.
    slab(DRIVEWAY.x0, PATCH.x0 - 0.03, 0, 0.3, SURFACE.vergeBack, 0),
    slab(PATCH.x1 + 0.03, DRIVEWAY.x1, 0, 0.3, SURFACE.vergeBack, 0),
    slab(DRIVEWAY.x0, DRIVEWAY.x1, -0.02, 0.24, SURFACE.gutterBack, SURFACE.vergeBack - 0.03),
    // Gutter pans.
    slab(BLOCK.x0, DRIVEWAY.x0, -0.06, 0.06, SURFACE.gutterBack, SURFACE.curbBack),
    slab(DRIVEWAY.x1, BLOCK.x1, -0.06, 0.06, SURFACE.gutterBack, SURFACE.curbBack),
    slab(BLOCK.x0, BLOCK.x1, -0.06, 0.06, SURFACE.farGutterBack, SURFACE.streetBack),
  ];
  // Far sidewalk in 5 ft panels with tooled joints.
  for (let x = BLOCK.x0; x < BLOCK.x1; x += 5) {
    concreteParts.push(
      slab(
        x + 0.03,
        Math.min(x + 5, BLOCK.x1) - 0.03,
        0,
        0.3,
        SURFACE.sidewalkBack,
        SURFACE.farCurbBack,
        0.06,
      ),
    );
  }
  const curbParts = [
    slab(BLOCK.x0, DRIVEWAY.x0, 0, 0.5, SURFACE.curbBack, SURFACE.curbFront, 0.16),
    slab(DRIVEWAY.x1, BLOCK.x1, 0, 0.5, SURFACE.curbBack, SURFACE.curbFront, 0.16),
    slab(BLOCK.x0, BLOCK.x1, 0, 0.5, SURFACE.farCurbBack, SURFACE.farGutterBack, 0.16),
  ];
  const asphaltParts = [
    slab(BLOCK.x0, BLOCK.x1, -0.12, 0.02, SURFACE.streetBack, SURFACE.gutterBack, 0.06),
    // An old trench patch in the street.
    slab(30, 38.5, -0.1, 0.035, -21, -13, 0.04),
  ];
  // Crack-seal lines: thin, slightly raised, irregular.
  const rand = mulberry32(811);
  const sealParts: BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const x = BLOCK.x0 + 8 + rand() * (BLOCK.x1 - BLOCK.x0 - 16);
    const z0 = SURFACE.streetBack + 1 + rand() * 6;
    const len = 4 + rand() * 10;
    sealParts.push(
      slab(x - 0.09, x + 0.09, 0.0, 0.045, z0, Math.min(z0 + len, SURFACE.gutterBack - 0.5), 0.03),
    );
  }
  sealParts.push(slab(BLOCK.x0 + 2, BLOCK.x1 - 2, 0.0, 0.045, -17.6, -17.42, 0.03));

  group.add(
    mesh(merge(grassParts), grass),
    mesh(merge(concreteParts), concrete, true),
    mesh(slab(PATCH.x0, PATCH.x1, 0, 0.29, SURFACE.vergeBack, 0, 0.05), concreteNew, true),
    mesh(merge(curbParts), curb, true),
    mesh(merge(asphaltParts), asphalt),
    mesh(merge(sealParts), seal),
  );

  // Hydrant: neutral colors, since paint colors on hydrants mean other things.
  const hydrantBody = surface('#e4dfd5', { roughness: 0.55 });
  const hydrantMetal = surface(C.steel, { roughness: 0.45, metalness: 0.6 });
  const hx = HYDRANT.x;
  const hz = HYDRANT.z;
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

  // Telecom pedestal: neutral, as many are.
  const pedestal = surface('#b6afa3', { roughness: 0.6 });
  group.add(
    mesh(
      roundedBox(1.0, 2.5, 0.8, 0.12, [HOOKUP.pedestal.x, 1.25, HOOKUP.pedestal.z]),
      pedestal,
      true,
    ),
    mesh(
      roundedBox(1.08, 0.14, 0.88, 0.05, [HOOKUP.pedestal.x, 2.55, HOOKUP.pedestal.z]),
      surface(C.graphite, { roughness: 0.5 }),
      true,
    ),
  );

  // Grass tufts: seeded, instanced, thinned on lower tiers.
  const tuft = merge([
    new ConeGeometry(0.03, 0.55, 4, 1).translate(0, 0.275, 0),
    new ConeGeometry(0.028, 0.42, 4, 1).rotateZ(0.32).translate(0.07, 0.2, 0.02),
    new ConeGeometry(0.028, 0.46, 4, 1).rotateX(-0.3).translate(-0.04, 0.22, -0.06),
  ]);
  const tuftMaterial = surface('#ffffff', { roughness: 0.95 });
  const positions: Vector3[] = [];
  const area = (x0: number, x1: number, z0: number, z1: number, count: number) => {
    let placed = 0;
    while (placed < count) {
      const x = x0 + rand() * (x1 - x0);
      const z = z0 + rand() * (z1 - z0);
      if (x > DRIVEWAY.x0 - 0.3 && x < DRIVEWAY.x1 + 0.3 && z > SURFACE.vergeBack) continue;
      if (TUFT_AVOID.some((a) => Math.hypot(x - a.x, z - a.z) < a.r)) continue;
      positions.push(new Vector3(x, 0.1, z));
      placed++;
    }
  };
  area(BLOCK.x0 + 0.3, BLOCK.x1 - 0.3, SURFACE.vergeBack + 0.25, -0.25, 2600);
  area(BLOCK.x0 + 0.3, BLOCK.x1 - 0.3, BLOCK.z0 + 0.3, SURFACE.sidewalkBack - 0.25, 1700);
  // Seeded shuffle, so thinning for lower tiers removes tufts evenly everywhere.
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = positions[i];
    const b = positions[j];
    if (a && b) {
      positions[i] = b;
      positions[j] = a;
    }
  }
  const tufts = new InstancedMesh(tuft, tuftMaterial, positions.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const up = new Vector3(0, 1, 0);
  const light = new Color(C.grass);
  const dark = new Color(C.grassDark);
  const c = new Color();
  positions.forEach((p, i) => {
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    const k = 0.75 + rand() * 0.6;
    s.set(k, k * (0.8 + rand() * 0.5), k);
    tufts.setMatrixAt(i, m.compose(p, q, s));
    tufts.setColorAt(i, c.copy(dark).lerp(light, rand()));
  });
  tufts.castShadow = true;
  tufts.receiveShadow = true;
  group.add(tufts);

  return {
    group,
    setDetail(share: number) {
      tufts.count = Math.round(positions.length * Math.min(1, Math.max(0, share)));
    },
  };
}
