/** Buried lines, access points and the generic locating equipment, for both setups. */
import {
  CanvasTexture,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { APWA } from '../../../design/apwa.ts';
import { FACILITY_TINT_STRENGTH, MATERIAL_COLORS as C } from '../../../design/tokens.ts';
import {
  merge,
  pipeAlongX,
  pipeAlongZ,
  post,
  ringAlongX,
  roundedBox,
} from '../../../kit3d/geometry.ts';
import { surface, tint } from '../../../kit3d/materials.ts';
import type { SetupId } from '../../../signal/model.ts';
import { BREAK_X, HOOKUP, LINES } from './layout.ts';

function mesh(geometry: BufferGeometry, material: Material, cast = true): Mesh {
  const m = new Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

function cable(points: [number, number, number][], radius: number, material: Material): Mesh {
  const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)));
  return mesh(new TubeGeometry(curve, 64, radius, 10, false), material);
}

const strength = FACILITY_TINT_STRENGTH;
const MATERIALS = {
  steelMain: () =>
    surface(tint(C.coatedSteel, APWA.yellow.fill, strength), { roughness: 0.5, metalness: 0.15 }),
  plasticMain: () => surface(tint(C.casing, APWA.yellow.fill, 0.82), { roughness: 0.42 }),
  tracer: () => surface(tint(C.graphite, APWA.yellow.fill, 0.85), { roughness: 0.5 }),
  telecom: () => surface(tint(C.graphite, APWA.orange.fill, strength), { roughness: 0.55 }),
  water: () =>
    surface(tint('#4b4f55', APWA.blue.fill, strength), { roughness: 0.6, metalness: 0.1 }),
  graphite: () => surface(C.graphite, { roughness: 0.45 }),
  steel: () => surface(C.steel, { roughness: 0.35, metalness: 0.8 }),
  copper: () => surface('#b87333', { roughness: 0.35, metalness: 0.9 }),
  yellowPost: () => surface(APWA.yellow.fill, { roughness: 0.5 }),
  casing: () => surface(C.casing, { roughness: 0.5 }),
};

/** The transmitter's screen: frequency and current, redrawn when the state changes. */
export class TransmitterScreen {
  readonly texture: CanvasTexture;
  private readonly canvas = document.createElement('canvas');

  constructor() {
    this.canvas.width = 256;
    this.canvas.height = 128;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  draw(frequency: string, current: string): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#10161a';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#e8eef0';
    ctx.textBaseline = 'middle';
    ctx.font = '600 46px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillText(frequency, 18, 46);
    ctx.font = '500 30px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillStyle = '#9fb0b6';
    ctx.fillText(current, 18, 98);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}

export interface SharedLines {
  readonly group: Group;
  readonly screen: TransmitterScreen;
}

/** Lines and equipment present in both setups. */
export function buildShared(): SharedLines {
  const group = new Group();
  group.name = 'shared-lines';
  const t = LINES.telecom;
  const w = LINES.water;
  group.add(
    mesh(
      merge([
        pipeAlongX(t.x0, t.x1, t.y, 0, t.radius, 24),
        new SphereGeometry(t.radius, 24, 12).translate(t.x0, t.y, 0),
      ]),
      MATERIALS.telecom(),
    ),
  );
  group.add(
    mesh(
      merge([
        pipeAlongZ(w.z0, w.z1, w.x, w.y, w.radius, 32),
        new TorusGeometry(w.radius + 0.03, 0.06, 12, 40).translate(w.x, w.y, -0.6),
      ]),
      MATERIALS.water(),
    ),
  );

  // Generic transmitter: no manufacturer's design. Rounded case, handle, screen, two terminals.
  const tx = HOOKUP.transmitter;
  const unit = new Group();
  unit.position.set(tx.x, 0.12, tx.z);
  unit.rotation.y = -0.55;
  const graphite = MATERIALS.graphite();
  unit.add(
    mesh(roundedBox(1.5, 0.92, 1.0, 0.16, [0, 0.46, 0]), graphite),
    mesh(roundedBox(1.36, 0.7, 0.06, 0.03, [0, 0.47, 0.5]), MATERIALS.casing()),
    mesh(new TorusGeometry(0.42, 0.05, 12, 32, Math.PI).translate(0, 0.92, 0), graphite),
    mesh(
      merge([
        new CylinderGeometry(0.05, 0.05, 0.16, 16)
          .rotateX(Math.PI / 2)
          .translate(-0.45, 0.22, 0.56),
        new CylinderGeometry(0.05, 0.05, 0.16, 16).rotateX(Math.PI / 2).translate(0.45, 0.22, 0.56),
      ]),
      MATERIALS.steel(),
    ),
  );
  const screen = new TransmitterScreen();
  const screenMaterial = new MeshStandardMaterial({
    color: '#000000',
    emissive: '#ffffff',
    emissiveMap: screen.texture,
    emissiveIntensity: 1.1,
    roughness: 0.25,
  });
  unit.add(mesh(roundedBox(0.92, 0.44, 0.03, 0.02, [0, 0.55, 0.535]), screenMaterial, false));
  group.add(unit);

  // Ground stake: a steel rod with a T-handle, driven in at the cut face so its rod shows.
  const s = HOOKUP.stake;
  const steel = MATERIALS.steel();
  group.add(
    mesh(
      merge([
        post(s.x, s.z, s.tip + 0.25, s.top, 0.05),
        new ConeGeometry(0.05, 0.25, 16).rotateX(Math.PI).translate(s.x, s.tip + 0.125, s.z),
        new CylinderGeometry(0.045, 0.045, 0.9, 16).rotateZ(Math.PI / 2).translate(s.x, s.top, s.z),
      ]),
      steel,
    ),
  );

  // Leads lying in the grass: signal lead to the access point, ground lead to the stake.
  const lead = MATERIALS.graphite();
  const a = HOOKUP.access;
  group.add(
    cable(
      [
        [tx.x + 0.3, 0.35, tx.z + 0.5],
        [tx.x + 1.6, 0.16, tx.z + 1.4],
        [a.x - 1.4, 0.16, a.z - 0.4],
        [a.x - 0.3, 0.3, a.z],
      ],
      0.045,
      lead,
    ),
    cable(
      [
        [tx.x - 0.4, 0.35, tx.z + 0.5],
        [tx.x - 3, 0.16, tx.z + 1.6],
        [s.x + 6, 0.16, -1.4],
        [s.x + 0.6, 0.18, -0.5],
        [s.x + 0.08, s.top - 0.3, 0],
      ],
      0.045,
      lead,
    ),
  );
  return { group, screen };
}

/** The target line and its access point, for one setup. */
export function buildSetup(setup: SetupId): Group {
  const group = new Group();
  group.name = `setup-${setup}`;
  const a = HOOKUP.access;

  if (setup === 'steel') {
    const m = LINES.steel;
    const coating = MATERIALS.steelMain();
    group.add(
      mesh(
        merge([
          pipeAlongX(m.x0, m.x1, m.y, 0, m.radius, 40),
          new SphereGeometry(m.radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
            .rotateZ(Math.PI / 2)
            .translate(m.x0, m.y, 0),
          ...[20, 60, 100, 140].map((x) => ringAlongX(x, m.y, 0, m.radius + 0.02, 0.05)),
        ]),
        coating,
      ),
    );
    // Cathodic-protection test station: a yellow post, with its test lead up the cut face.
    group.add(
      mesh(post(a.x, a.z, 0, 3.0, 0.17), MATERIALS.yellowPost()),
      mesh(
        new SphereGeometry(0.19, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(a.x, 3.0, a.z),
        MATERIALS.graphite(),
      ),
      cable(
        [
          [0.4, m.y + m.radius, 0.2],
          [0.4, -1.6, 0.22],
          [0.38, -0.2, 0.2],
          [0.25, 0.14, -0.45],
          [a.x + 0.05, 0.3, a.z + 0.05],
        ],
        0.035,
        MATERIALS.graphite(),
      ),
    );
    return group;
  }

  // Plastic main: the pipe itself can't carry a signal, so a tracer wire rides along on top.
  const p = LINES.plastic;
  const tr = LINES.tracer;
  group.add(
    mesh(
      merge([
        pipeAlongX(p.x0, p.x1, p.y, 0, p.radius, 40),
        new SphereGeometry(p.radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
          .rotateZ(Math.PI / 2)
          .translate(p.x0, p.y, 0),
      ]),
      MATERIALS.plasticMain(),
    ),
  );
  const half = tr.gap / 2;
  group.add(
    mesh(
      merge([
        pipeAlongX(tr.x0, BREAK_X - half, tr.y, 0, tr.radius, 12),
        pipeAlongX(BREAK_X + half, tr.x1, tr.y, 0, tr.radius, 12),
      ]),
      MATERIALS.tracer(),
    ),
    // Bare copper showing at the broken ends.
    mesh(
      merge([
        new ConeGeometry(0.035, 0.14, 8)
          .rotateZ(-Math.PI / 2)
          .translate(BREAK_X - half + 0.06, tr.y, 0),
        new ConeGeometry(0.035, 0.14, 8)
          .rotateZ(Math.PI / 2)
          .translate(BREAK_X + half - 0.06, tr.y, 0),
      ]),
      MATERIALS.copper(),
    ),
  );
  // Tracer-wire test box, flush with the grass; the wire comes up the cut face to it.
  group.add(
    mesh(
      new CylinderGeometry(0.42, 0.44, 0.24, 32).translate(a.x, 0.06, a.z),
      MATERIALS.graphite(),
    ),
    mesh(
      new CylinderGeometry(0.37, 0.37, 0.05, 32).translate(a.x, 0.2, a.z),
      MATERIALS.yellowPost(),
    ),
    cable(
      [
        [tr.x0 + 0.1, tr.y, 0.06],
        [-0.5, -1.8, 0.12],
        [-0.4, -0.25, 0.12],
        [-0.25, 0.1, -0.5],
        [a.x, 0.12, a.z + 0.05],
      ],
      tr.radius,
      MATERIALS.tracer(),
    ),
  );
  return group;
}
