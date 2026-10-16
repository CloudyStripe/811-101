/** Buried lines, access points and the generic locating equipment, for both setups. */
import {
  CanvasTexture,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
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
import { surface, tint, type SurfaceOptions } from '../../../kit3d/materials.ts';
import type { SetupId } from '../../../signal/model.ts';
import type { LabLayout } from './layout.ts';

function mesh(geometry: BufferGeometry, material: Material, cast = true): Mesh {
  const m = new Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

function cable(
  points: readonly (readonly [number, number, number])[],
  radius: number,
  material: Material,
): Mesh {
  const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)));
  return mesh(new TubeGeometry(curve, 64, radius, 10, false), material);
}

/**
 * A buried line's material: its APWA tint, able to glow faintly in the same color so the hue still
 * reads in dim light (see `setLineGlow`).
 */
function line(base: string, apwa: string, strength: number, params: SurfaceOptions) {
  const m = surface(tint(base, apwa, strength), params);
  m.emissive.copy(m.color);
  m.emissiveIntensity = 0;
  m.userData.line = true;
  return m;
}

/** Sets how strongly every buried line under `root` glows in its own tint. */
export function setLineGlow(root: Object3D, level: number): void {
  root.traverse((o) => {
    const m = (o as Partial<Mesh>).material;
    if (m instanceof MeshStandardMaterial && m.userData.line === true) m.emissiveIntensity = level;
  });
}

const strength = FACILITY_TINT_STRENGTH;
const MATERIALS = {
  steelMain: () => line(C.coatedSteel, APWA.yellow.fill, strength, { roughness: 0.5 }),
  plasticMain: () => line(C.casing, APWA.yellow.fill, strength, { roughness: 0.42 }),
  tracer: () => line(C.graphite, APWA.yellow.fill, strength, { roughness: 0.5 }),
  telecom: () => line(C.graphite, APWA.orange.fill, strength, { roughness: 0.55 }),
  water: () => line('#4b4f55', APWA.blue.fill, strength, { roughness: 0.6 }),
  graphite: () => surface(C.graphite, { finish: 'paint' }),
  steel: () => surface(C.steel, { finish: 'metal', roughness: 0.3, metalness: 0.8 }),
  yellowPost: () => surface(APWA.yellow.fill, { finish: 'paint' }),
  casing: () => surface(C.casing, { finish: 'paint' }),
};

const CELL_W = 256;
const CELL_H = 128;
const COLUMNS = 2;

/** Texture offset that shows reading `index` of an atlas `rows` cells high. */
export function screenCellOffset(index: number, rows: number): [number, number] {
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  // Readings fill the canvas from its top left, and the canvas's top row is at v = 1.
  return [column / COLUMNS, 1 - (row + 1) / rows];
}

/**
 * The transmitter's screen, showing the frequency it's set to. Every frequency is drawn once into
 * one texture, and a change only moves which part is shown: re-uploading a canvas texture on each
 * change stalled some GPUs for most of a second. Each cell keeps a plain margin, so mipmaps don't
 * bleed text from one cell into the next.
 */
export class TransmitterScreen {
  /** Fonts the screen draws with, for loading before a redraw. */
  static readonly FONTS = ['600 54px "IBM Plex Mono", ui-monospace, monospace'] as const;

  readonly texture: CanvasTexture;
  private readonly canvas = document.createElement('canvas');
  private readonly readings: readonly string[];
  private readonly rows: number;

  constructor(readings: readonly string[]) {
    this.readings = readings;
    this.rows = Math.ceil(readings.length / COLUMNS);
    this.canvas.width = CELL_W * COLUMNS;
    this.canvas.height = CELL_H * this.rows;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.texture.repeat.set(1 / COLUMNS, 1 / this.rows);
    this.draw();
    this.show(0);
  }

  /** Draws every reading. Call again once the fonts have loaded. */
  draw(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#10161a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.font = TransmitterScreen.FONTS[0];
    ctx.fillStyle = '#e8eef0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.readings.forEach((text, i) => {
      const x = (i % COLUMNS) * CELL_W + CELL_W / 2;
      const y = Math.floor(i / COLUMNS) * CELL_H + CELL_H / 2;
      ctx.fillText(text, x, y, CELL_W - 36);
    });
    this.texture.needsUpdate = true;
  }

  /** Shows one reading by moving the texture's offset; nothing is re-uploaded. */
  show(index: number): void {
    this.texture.offset.set(...screenCellOffset(index, this.rows));
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
export function buildShared(layout: LabLayout, readings: readonly string[]): SharedLines {
  const { lines, hookup, leads, block, equipment: k } = layout;
  const group = new Group();
  group.name = 'shared-lines';
  const t = lines.telecom;
  const w = lines.water;
  group.add(
    mesh(
      merge([
        pipeAlongX(t.x0, block.x1, t.y, 0, t.radius, 24),
        new SphereGeometry(t.radius, 24, 12).translate(t.x0, t.y, 0),
      ]),
      MATERIALS.telecom(),
    ),
  );
  group.add(
    mesh(
      merge([
        pipeAlongZ(w.z0, w.z1, w.x, w.y, w.radius, 32),
        new TorusGeometry(w.radius + 0.03, 0.06 * layout.depth, 12, 40).translate(w.x, w.y, -0.6),
      ]),
      MATERIALS.water(),
    ),
  );

  // Generic transmitter: no manufacturer's design. Rounded case, handle, screen, two terminals,
  // built at true size and drawn at the equipment's size.
  const tx = hookup.transmitter;
  const unit = new Group();
  unit.position.set(tx.x, 0.12, tx.z);
  unit.rotation.y = tx.turn;
  unit.scale.setScalar(k);
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
  const screen = new TransmitterScreen(readings);
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
  const s = hookup.stake;
  const steel = MATERIALS.steel();
  group.add(
    mesh(
      merge([
        post(s.x, s.z, s.tip + 0.25 * k, s.top, 0.05 * k),
        new ConeGeometry(0.05 * k, 0.25 * k, 16)
          .rotateX(Math.PI)
          .translate(s.x, s.tip + 0.125 * k, s.z),
        new CylinderGeometry(0.045 * k, 0.045 * k, 0.9 * k, 16)
          .rotateZ(Math.PI / 2)
          .translate(s.x, s.top, s.z),
      ]),
      steel,
    ),
  );

  // The ground lead, lying in the grass from the transmitter to the stake. Each setup has its own
  // signal lead, to its own access point.
  group.add(cable(leads.ground, layout.leadRadius, MATERIALS.graphite()));
  return { group, screen };
}

/** The target line, its access point, and the signal lead to it, for one setup. */
export function buildSetup(layout: LabLayout, setup: SetupId): Group {
  const { lines, hookup, risers, block, equipment: k } = layout;
  const group = new Group();
  group.name = `setup-${setup}`;
  const a = hookup.access;
  group.add(cable(layout.leads.signal[setup], layout.leadRadius, MATERIALS.graphite()));

  if (setup === 'steel') {
    const m = lines.steel;
    const coating = MATERIALS.steelMain();
    group.add(
      mesh(
        merge([
          pipeAlongX(m.x0, block.x1, m.y, 0, m.radius, 40),
          new SphereGeometry(m.radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
            .rotateZ(Math.PI / 2)
            .translate(m.x0, m.y, 0),
          // Couplings every 40 ft along the block.
          ...Array.from(
            { length: Math.floor((block.x1 - 20) / 40) + 1 },
            (_, i) => 20 + i * 40,
          ).map((x) => ringAlongX(x, m.y, 0, m.radius + 0.02 * layout.depth, 0.05 * layout.depth)),
        ]),
        coating,
      ),
    );
    // Cathodic-protection test station: a yellow post, with its test lead up the cut face.
    group.add(
      mesh(post(a.x, a.z, 0, 3.0 * k, 0.17 * k), MATERIALS.yellowPost()),
      mesh(
        new SphereGeometry(0.19 * k, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(
          a.x,
          3.0 * k,
          a.z,
        ),
        MATERIALS.graphite(),
      ),
      cable(risers.steel, 0.035, MATERIALS.graphite()),
    );
    return group;
  }

  // Plastic main: the pipe itself can't carry a signal, so a tracer wire rides along on top.
  const p = lines.plastic;
  const tr = lines.tracer;
  group.add(
    mesh(
      merge([
        pipeAlongX(p.x0, block.x1, p.y, 0, p.radius, 40),
        new SphereGeometry(p.radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
          .rotateZ(Math.PI / 2)
          .translate(p.x0, p.y, 0),
      ]),
      MATERIALS.plasticMain(),
    ),
  );
  group.add(mesh(pipeAlongX(tr.x0, block.x1, tr.y, 0, tr.radius, 12), MATERIALS.tracer()));
  // Tracer-wire test box, set in the grass; the wire comes up the cut face to it.
  group.add(
    mesh(
      new CylinderGeometry(0.42 * k, 0.44 * k, 0.24 * k, 32).translate(a.x, 0.06 * k, a.z),
      MATERIALS.graphite(),
    ),
    mesh(
      new CylinderGeometry(0.37 * k, 0.37 * k, 0.05 * k, 32).translate(a.x, 0.2 * k, a.z),
      MATERIALS.yellowPost(),
    ),
    cable(risers.plastic, tr.radius, MATERIALS.tracer()),
  );
  return group;
}
