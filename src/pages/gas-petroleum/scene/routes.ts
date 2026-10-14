/**
 * The routes: lines along the ground (and up the cut face from the wells) showing where oil, gas
 * and water go, with beads flowing along them. The shared start is stone; both fuel paths are
 * APWA yellow, natural gas's dashed and gasoline's banded, so the pattern tells them apart. One
 * program draws every route, and one draw every bead.
 */
import {
  BufferAttribute,
  Color,
  CurvePath,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineCurve3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  QuadraticBezierCurve3,
  Quaternion,
  TubeGeometry,
  Vector3,
} from 'three';
import { DIORAMA_COLORS as C } from '../../../design/tokens.ts';
import { PATH_STYLE, type PathId } from '../../../design/paths.ts';
import { FACE, SITE } from './layout.ts';

type Kind = 'oil' | 'gas' | 'water' | 'crude' | 'product';
type P = readonly [number, number, number];

interface RouteSpec {
  path: PathId;
  kind: Kind;
  points: readonly P[];
  /** For refined products: how far along the beads have turned from crude into fuel. */
  refineEnd?: number;
}

/** Lines drawn just in front of the cut face, and just above the ground. */
const RZ = FACE + 0.12;
const RY = 0.3;

const ROUTES: readonly RouteSpec[] = (() => {
  const {
    oilWell: OW,
    gasWell: GW,
    separator: SEP,
    waterTank: WT,
    tower: TW,
    storage: SG,
    cityGate: CG,
    street: STR,
    gasMain: GM,
  } = SITE;
  return [
    // The shared start: up the wells, into the separator, and its water out to the tank.
    {
      path: 'shared',
      kind: 'oil',
      points: [
        [OW.x, -6.6, RZ],
        [OW.x, RY, RZ],
        [OW.x, RY, 21.6],
        [OW.x + 2.8, RY, 16.4],
        [SEP.x - 2.7, RY, SEP.z + 0.7],
      ],
    },
    {
      path: 'shared',
      kind: 'gas',
      points: [
        [GW.x, -5.45, RZ],
        [GW.x, RY, RZ],
        [GW.x, RY, 21.2],
        [GW.x - 0.1, RY, SEP.z + 1.2],
      ],
    },
    {
      path: 'shared',
      kind: 'water',
      points: [
        [SEP.x - 1.6, RY, SEP.z - 0.9],
        [WT.x + 1.0, RY, WT.z + 0.4],
      ],
    },
    // Natural gas: from the separator's gas outlet through the plant, the compressors and the
    // city gate into town, with spurs to storage, the LNG terminal, and the factory and plant.
    {
      path: 'gas',
      kind: 'gas',
      points: [
        [SEP.x + 1.6, RY, SEP.z - 1.3],
        [-23, RY, 4],
        [-20.6, RY, GM.z],
        [CG.x - 2, RY, GM.z],
        [CG.x + 2, RY, GM.z],
        [22.5, RY, GM.z],
        [22.5, RY, STR.z],
        [41, RY, STR.z],
      ],
    },
    {
      path: 'gas',
      kind: 'gas',
      points: [
        [SG.x, RY, GM.z],
        [SG.x, RY, SG.z + 1.0],
      ],
    },
    {
      path: 'gas',
      kind: 'gas',
      points: [
        [10, RY, GM.z],
        [11.8, RY, -14],
        [15.4, RY, -16.9],
        [23.6, RY, -16.9],
        [24.9, RY, -22.4],
        [25.2, 0.35, -28.4],
        [26.2, 0.2, -30.8],
      ],
    },
    {
      path: 'gas',
      kind: 'gas',
      points: [
        [13.6, RY, GM.z],
        [13.6, RY, -13.2],
        [40.2, RY, -13.2],
      ],
    },
    // Gasoline: crude from the separator's oil outlet to the tower, then fuel out to the station.
    {
      path: 'gasoline',
      kind: 'crude',
      points: [
        [SEP.x + SEP.len / 2 + 1.6, RY, SEP.z],
        [TW.x - 5.4, RY, TW.z - 0.4],
        [TW.x - 2.6, 0.6, TW.z - 0.1],
        [TW.x - 0.4, 0.6, TW.z - 0.1],
      ],
    },
    {
      path: 'gasoline',
      kind: 'product',
      refineEnd: 0.4,
      points: [
        [TW.x + 1.5, RY, TW.z - 1.6],
        [3, RY, 12.4],
        [8.2, RY, 12.4],
        [10.4, RY, 14.9],
        [15.4, RY, 14.9],
        [15.6, RY, 9.2],
        [17.6, RY, 8.6],
        [18.5, RY, 9.6],
        [21.8, RY, 13.2],
        [23.4, RY, 16.9],
      ],
    },
  ];
})();

/** A path through the points with its corners rounded off. */
function rounded(points: readonly P[], radius = 1.3): CurvePath<Vector3> {
  const P = points.map((p) => new Vector3(...p));
  const path = new CurvePath<Vector3>();
  let cur = P[0]?.clone() ?? new Vector3();
  for (let i = 1; i < P.length - 1; i++) {
    const [a, b, c] = [P[i - 1], P[i], P[i + 1]];
    if (!a || !b || !c) continue;
    const d1 = b.clone().sub(a);
    const d2 = c.clone().sub(b);
    const r = Math.min(radius, d1.length() * 0.45, d2.length() * 0.45);
    const p1 = b.clone().sub(d1.normalize().multiplyScalar(r));
    const p2 = b.clone().add(d2.normalize().multiplyScalar(r));
    if (cur.distanceTo(p1) > 1e-3) path.add(new LineCurve3(cur.clone(), p1));
    path.add(new QuadraticBezierCurve3(p1, b.clone(), p2));
    cur = p2;
  }
  path.add(new LineCurve3(cur, P[P.length - 1]?.clone() ?? cur));
  return path;
}

const PATTERN = { solid: 0, dashed: 1, banded: 2 } as const;

/** The routes' material: the pattern along each line, and its fading, from uniforms. */
function routeMaterial(path: PathId, length: number) {
  const style = PATH_STYLE[path];
  const material = new MeshStandardMaterial({ color: new Color(style.color), roughness: 0.6 });
  const dim = { value: 0 };
  const dimColor = { value: new Color() };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.gpPattern = { value: PATTERN[style.pattern] };
    shader.uniforms.gpLength = { value: length };
    shader.uniforms.gpDim = dim;
    shader.uniforms.gpDimColor = dimColor;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float along;\nvarying float gpAlong;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ngpAlong = along;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float gpAlong;\nuniform float gpPattern;\nuniform float gpDim;\nuniform vec3 gpDimColor;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// Natural gas: dashes. Gasoline: dark bands across a solid line. A unit is about a line's width.
float gpStep = fract(gpAlong / 1.1);
if (gpPattern > 0.5 && gpPattern < 1.5 && gpStep > 0.62) discard;
if (gpPattern > 1.5 && gpStep > 0.74) diffuseColor.rgb *= 0.28;
diffuseColor.rgb = mix(diffuseColor.rgb, gpDimColor, gpDim * 0.8);`,
      );
  };
  material.customProgramCacheKey = () => 'gp-route';
  return { material, dim, dimColor };
}

export interface Routes {
  group: Group;
  /** Moves the flow on by dt seconds, each path at its own pace (0 still, 1 full). */
  update(dt: number, pace: Readonly<Record<PathId, number>>): void;
  /** Fades a path's routes back toward the haze, 0 to 1. */
  setDim(path: PathId, dim: number): void;
  setDimColor(hex: string): void;
}

export function buildRoutes(): Routes {
  const group = new Group();
  const color = new Color();
  const dark = new Color(C.oil);
  const fuel = new Color(C.fuel);
  const palette: Record<Kind, Color[]> = {
    oil: [new Color(C.oil), new Color(C.oil), new Color(C.producedWater)],
    gas: [new Color(C.gas)],
    water: [new Color(C.producedWater)],
    crude: [new Color(C.oil)],
    product: [dark],
  };
  const fades: { path: PathId; dim: { value: number }; dimColor: { value: Color } }[] = [];
  const lines = ROUTES.map((spec) => {
    const curve = rounded(spec.points);
    const length = curve.getLength();
    const tube = new TubeGeometry(curve, Math.max(8, Math.ceil(length * 3)), 0.15, 8, false);
    // How far along the line each vertex is, in model units, for the pattern.
    const uv = tube.getAttribute('uv');
    const along = new Float32Array(uv.count);
    for (let i = 0; i < uv.count; i++) along[i] = uv.getX(i) * length;
    tube.setAttribute('along', new BufferAttribute(along, 1));
    const { material, dim, dimColor } = routeMaterial(spec.path, length);
    fades.push({ path: spec.path, dim, dimColor });
    const mesh = new Mesh(tube, material);
    mesh.receiveShadow = true;
    group.add(mesh);
    const count = Math.max(2, Math.round(length / 1.7));
    return {
      spec,
      samples: curve.getSpacedPoints(Math.max(16, Math.ceil(length * 3))),
      length,
      count,
      seeds: Array.from({ length: count }, (_, i) => (i + ((i * 0.618) % 1) * 0.4) / count),
      u: 0,
      dim: 0,
    };
  });

  // The beads, every route's in one instanced mesh.
  const total = lines.reduce((n, l) => n + l.count, 0);
  const beads = new InstancedMesh(
    new IcosahedronGeometry(0.14, 1),
    new MeshStandardMaterial({ roughness: 0.45 }),
    total,
  );
  beads.frustumCulled = false;
  beads.castShadow = false;
  group.add(beads);
  const m = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const s = new Vector3();

  function place() {
    let index = 0;
    for (const line of lines) {
      const S = line.samples.length - 1;
      line.seeds.forEach((seed, i) => {
        const u = (seed + line.u) % 1;
        const f = u * S;
        const k = Math.floor(f);
        const w = f - k;
        const a = line.samples[k] ?? line.samples[0];
        const b = line.samples[Math.min(k + 1, S)] ?? a;
        if (!a || !b) return;
        v.set(a.x + (b.x - a.x) * w, a.y + (b.y - a.y) * w + 0.12, a.z + (b.z - a.z) * w);
        // A faded route's beads shrink away.
        s.setScalar(Math.max(0.001, 1 - line.dim));
        beads.setMatrixAt(index, m.compose(v, q, s));
        const kinds = palette[line.spec.kind];
        if (line.spec.refineEnd) {
          color.copy(dark).lerp(fuel, Math.min(1, u / line.spec.refineEnd));
        } else {
          color.copy(kinds[i % kinds.length] ?? dark);
        }
        beads.setColorAt(index, color);
        index++;
      });
    }
    beads.instanceMatrix.needsUpdate = true;
    if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
  }
  place();

  return {
    group,
    update(dt, pace) {
      // Still, the beads stay where they are, and nothing is sent to the GPU again.
      if (dt === 0) return;
      for (const line of lines)
        line.u = (line.u + (dt * 3 * pace[line.spec.path]) / line.length) % 1;
      place();
    },
    setDim(path, dim) {
      for (const f of fades) if (f.path === path) f.dim.value = dim;
      for (const line of lines) if (line.spec.path === path) line.dim = dim;
      place();
    },
    setDimColor(hex) {
      for (const f of fades) f.dimColor.value.set(hex);
    },
  };
}
