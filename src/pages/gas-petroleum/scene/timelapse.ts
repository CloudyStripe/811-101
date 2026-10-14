/**
 * The formation time-lapse: a glass core beside the block that replays how its layers formed.
 * Sea life drifts down and settles into dark mud, layer after layer buries it, the deep layer
 * heats until oil and gas form, and they creep up into the sandstone under the cap rock. It runs
 * on the model's own clock, so it stands still while motion is paused.
 */
import {
  Color,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { TIMELAPSE } from '../../../../content/utilities/gas-petroleum.ts';
import { DIORAMA_COLORS as C, MATERIAL_COLORS } from '../../../design/tokens.ts';
import { mulberry32 } from '../../../kit3d/rng.ts';
import { BLOCK, boundary } from './layout.ts';

/** Where the column stands, its radius, and the x its layers are sampled from. */
const COLUMN = { x: -47.5, z: 18, r: 1.95, sampleX: -42 } as const;
/** How long a replay runs, in seconds of the model's clock. */
const DURATION = 16;
/** Along the replay (0 to 1): when each million-years mark is reached. */
const CLOCK: readonly (readonly [number, number])[] = [
  [0, 150],
  [0.12, 130],
  [0.34, 100],
  [0.62, 60],
  [0.8, 30],
  [1, 0],
];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** How far through the span a to b the replay is, 0 to 1. */
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);

export interface TimeLapseState {
  playing: boolean;
  /** How far through the replay, 0 to 1. */
  progress: number;
  /** Million years ago, rounded; 0 is today. */
  ma: number;
  /** Which caption shows. */
  caption: number;
}

export class TimeLapse {
  readonly group = new Object3D();
  private t = 1;
  private playingNow = false;
  private readonly layers: { mesh: Mesh; y0: number; y1: number }[] = [];
  private readonly source: MeshStandardMaterial;
  private readonly oil: Mesh;
  private readonly gas: Mesh;
  private readonly sea: Mesh;
  private readonly plankton: InstancedMesh;
  private readonly drops: InstancedMesh;
  private readonly planktonY: Float32Array;
  private readonly dropsY: Float32Array;
  private readonly planktonXZ: Float32Array;
  private readonly dropsXZ: Float32Array;
  private readonly resTop: number;
  private readonly srcTop: number;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly v = new Vector3();
  private readonly s = new Vector3();
  private listener: ((state: TimeLapseState) => void) | null = null;
  /** The state the listener was last told. */
  private told: TimeLapseState | null = null;

  constructor(parent: Object3D) {
    const { x, z, r, sampleX } = COLUMN;
    this.group.position.set(x, 0, z);
    parent.add(this.group);
    const at = (i: number) => boundary(i, sampleX);
    const unit = new CylinderGeometry(r, r, 1, 24).translate(0, 0.5, 0);
    const solid = (hex: string) =>
      new MeshStandardMaterial({ color: new Color(hex), roughness: 0.9 });

    // The glass, its rim and its stand.
    const glass = new Mesh(
      new CylinderGeometry(2.15, 2.15, 16.7, 32, 1, true),
      new MeshStandardMaterial({
        color: new Color(C.glass),
        roughness: 0.15,
        transparent: true,
        opacity: 0.16,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    glass.position.y = BLOCK.bottom + 8.35;
    const rim = new Mesh(new CylinderGeometry(2.2, 2.2, 0.16, 32, 1, true), solid(C.steel));
    rim.position.y = 0.7;
    const stand = new Mesh(new CylinderGeometry(2.6, 2.8, 0.5, 32), solid(C.machineDark));
    stand.position.y = BLOCK.bottom + 0.25;
    stand.castShadow = rim.castShadow = true;
    this.group.add(glass, rim, stand);

    // The layers, bottom to top, each growing in its turn.
    this.source = solid(C.sourceRock);
    const spec: [number, number, MeshStandardMaterial][] = [
      [BLOCK.bottom, at(7), solid(C.basement)],
      [at(7), at(6), this.source],
      [at(6), at(5), solid(C.shale)],
      [at(5), at(4), solid(C.waterZone)],
      [at(4), at(3), solid(C.capRock)],
      [at(3), at(2), solid(C.overburden)],
      [at(2), at(1), solid(C.aquifer)],
      [at(1), at(0), solid(C.soil)],
      [at(0), 0, solid(MATERIAL_COLORS.grass)],
    ];
    for (const [y0, y1, material] of spec) {
      const mesh = new Mesh(unit, material);
      mesh.position.y = y0;
      mesh.scale.y = y1 - y0;
      this.group.add(mesh);
      this.layers.push({ mesh, y0, y1 });
    }
    this.resTop = at(4);
    this.srcTop = at(6);
    // Oil and gas that gather under the cap rock at the end.
    this.oil = new Mesh(unit, solid(C.oilZone));
    this.gas = new Mesh(unit, solid(C.gasZone));
    for (const m of [this.oil, this.gas]) m.scale.set(1.01, 1, 1.01);
    // The sea the layers settle in, while they're still forming.
    this.sea = new Mesh(
      unit,
      new MeshStandardMaterial({
        color: new Color(C.sea),
        roughness: 0.3,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.group.add(this.oil, this.gas, this.sea);

    // Sea life drifting down, and drops of oil and gas creeping up.
    const random = mulberry32(150);
    const bead = new IcosahedronGeometry(0.16, 1);
    const beads = (count: number) => {
      const mesh = new InstancedMesh(bead, new MeshStandardMaterial({ roughness: 0.6 }), count);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    };
    this.plankton = beads(46);
    this.drops = beads(36);
    this.planktonY = new Float32Array(46);
    this.dropsY = new Float32Array(36);
    this.planktonXZ = new Float32Array(92);
    this.dropsXZ = new Float32Array(72);
    const plankton = new Color(C.plankton);
    for (let i = 0; i < 46; i++) {
      const a = random() * Math.PI * 2;
      const rr = random() * 1.7;
      this.planktonXZ.set([Math.cos(a) * rr, Math.sin(a) * rr], i * 2);
      this.planktonY[i] = -14 + random() * 14;
      this.plankton.setColorAt(i, plankton);
    }
    const [gasDrop, oilDrop] = [new Color(C.gas), new Color(C.oil)];
    for (let i = 0; i < 36; i++) {
      const a = random() * Math.PI * 2;
      const rr = random() * 1.6;
      this.dropsXZ.set([Math.cos(a) * rr, Math.sin(a) * rr], i * 2);
      this.dropsY[i] = this.srcTop - random() * 1.5;
      this.drops.setColorAt(i, i % 3 === 0 ? gasDrop : oilDrop);
    }
    this.place(1);
  }

  /** Told whenever the clock, the caption or playing changes, and as the replay moves on. */
  onChange(listener: ((state: TimeLapseState) => void) | null) {
    this.listener = listener;
  }

  get state(): TimeLapseState {
    let ma = 0;
    for (let i = 0; i < CLOCK.length - 1; i++) {
      const [t0, m0] = CLOCK[i] ?? [0, 0];
      const [t1, m1] = CLOCK[i + 1] ?? [1, 0];
      if (this.t >= t0 && this.t <= t1) ma = lerp(m0, m1, (this.t - t0) / (t1 - t0));
    }
    const caption = Math.max(0, TIMELAPSE.filter((c) => this.t >= c.at).length - 1);
    return { playing: this.playingNow, progress: this.t, ma: Math.round(ma), caption };
  }

  /** Starts the replay from the beginning. */
  play() {
    for (let i = 0; i < 36; i++) this.dropsY[i] = this.srcTop - ((i * 37) % 15) / 10;
    this.playingNow = true;
    this.place(0);
    this.notify();
  }

  get playing() {
    return this.playingNow;
  }

  /** Moves the replay on by dt seconds of the model's clock. */
  update(dt: number) {
    if (!this.playingNow || dt <= 0) return;
    const t = Math.min(1, this.t + dt / DURATION);
    if (this.plankton.visible) {
      for (let i = 0; i < 46; i++) {
        let y = (this.planktonY[i] ?? 0) - dt * 2.2;
        if (y < this.srcTop + 0.1) y = -1 - ((i * 13) % 20) / 10;
        this.planktonY[i] = y;
      }
    }
    if (this.drops.visible) {
      for (let i = 0; i < 36; i++) {
        const stop = this.resTop - 0.3 - (i % 3 ? 0.5 : 0);
        this.dropsY[i] = Math.min(stop, (this.dropsY[i] ?? 0) + dt * (1.6 + (i % 5) * 0.25));
      }
    }
    if (t >= 1) this.playingNow = false;
    this.place(t);
    const now = this.state;
    const told = this.told;
    if (
      told?.ma !== now.ma ||
      now.caption !== told.caption ||
      now.playing !== told.playing ||
      Math.abs(now.progress - told.progress) >= 0.01
    ) {
      this.notify();
    }
  }

  private notify() {
    this.told = this.state;
    this.listener?.(this.told);
  }

  /** Shows the column at point t of the replay. */
  private place(t: number) {
    this.t = t;
    // The layers grow from the bottom up.
    const grow = [
      1,
      seg(t, 0, 0.2),
      seg(t, 0.2, 0.27),
      seg(t, 0.27, 0.36),
      seg(t, 0.36, 0.42),
      seg(t, 0.42, 0.5),
      seg(t, 0.5, 0.56),
      seg(t, 0.56, 0.6),
      seg(t, 0.6, 0.62),
    ];
    let top: number = BLOCK.bottom;
    this.layers.forEach((layer, i) => {
      const h = (layer.y1 - layer.y0) * (grow[i] ?? 1);
      layer.mesh.visible = h > 0.001;
      layer.mesh.scale.y = Math.max(h, 0.001);
      if (h > 0.001) top = layer.y0 + h;
    });
    this.sea.visible = top < -0.05;
    this.sea.position.y = top;
    this.sea.scale.y = Math.max(0.001, -top);
    // The source rock glows as it's heated, deep and long ago.
    const heat = seg(t, 0.6, 0.72) * (1 - 0.5 * seg(t, 0.9, 1));
    this.source.emissive.setRGB(0.55 * heat, 0.18 * heat, 0.02 * heat);
    const fill = seg(t, 0.8, 0.98);
    this.oil.visible = this.gas.visible = fill > 0.02;
    this.gas.scale.y = Math.max(0.001, 0.4 * fill);
    this.gas.position.y = this.resTop - 0.4 * fill;
    this.oil.scale.y = Math.max(0.001, 0.5 * fill);
    this.oil.position.y = this.resTop - 0.9 * fill;
    this.plankton.visible = this.playingNow && t < 0.24;
    this.drops.visible = this.playingNow && t > 0.72 && t < 0.99;
    this.placeBeads(this.plankton, this.planktonXZ, this.planktonY, 46);
    this.placeBeads(this.drops, this.dropsXZ, this.dropsY, 36);
  }

  private placeBeads(mesh: InstancedMesh, xz: Float32Array, ys: Float32Array, count: number) {
    if (!mesh.visible) return;
    this.s.setScalar(1);
    for (let i = 0; i < count; i++) {
      this.v.set(xz[i * 2] ?? 0, ys[i] ?? 0, xz[i * 2 + 1] ?? 0);
      mesh.setMatrixAt(i, this.m.compose(this.v, this.q, this.s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Where the column's clock sits, above its glass. */
export const CLOCK_AT = [COLUMN.x, 1.7, COLUMN.z] as const;
