/**
 * Building a stop's parts: boxes, cylinders, balls, rods and shapes, placed in the model's units.
 * Everything that holds still merges into one mesh per finish (glossy paint, matte or metal),
 * colored per vertex, and each moving part (a group the stop animates) merges into meshes of its
 * own, so a whole stop costs a few draw calls. Every part of a stop shares the stop's materials,
 * so the stop can fade back as one when the path filter dims it.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Material,
  type MeshBasicMaterial,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FINISH } from '../../../design/tokens.ts';
import type { Finish, GroundRect } from '../../../kit3d/materials.ts';

export type Point = readonly [number, number, number];

export interface PartOptions {
  /** Rotations about x, y and z, in radians, applied in that order. */
  rx?: number;
  ry?: number;
  rz?: number;
  /**
   * How the part is finished: glossy paint (the default, for built things), matte (for what grows
   * or lies on the ground, and roofs), or metal (steel).
   */
  finish?: Finish;
  /** Casts a shadow (default true). Flat things on the ground and on the cut face don't. */
  cast?: boolean;
  /** Radial segments for round parts. */
  segments?: number;
}

/**
 * A stop's finishes, and any other material it uses, which fade back together when the path
 * filter dims the stop.
 */
export interface Finishes {
  paint: MeshStandardMaterial;
  matte: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  /** Fades a material of the stop's own (glass, a glow, puffs) along with its finishes. */
  track<M extends MeshStandardMaterial | MeshBasicMaterial>(material: M): M;
  /** How far the stop is faded back, 0 to 1. */
  setDim(dim: number): void;
}

/** Shared by every faded material, so dimming never compiles a new program. */
const DIM = { color: { value: new Color() } };

/** The color dimmed stops fade toward, for the theme: a quiet gray. */
export function setDimColor(hex: string): void {
  DIM.color.value.set(hex);
}

/** Makes a material fade toward the dim color by `dim`: its color, and any glow it gives off. */
function fade(material: MeshStandardMaterial | MeshBasicMaterial, dim: { value: number }): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.gpDim = dim;
    shader.uniforms.gpDimColor = DIM.color;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float gpDim;\nuniform vec3 gpDimColor;',
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, gpDimColor, gpDim * 0.72);',
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 1.0 - gpDim * 0.72;',
      );
  };
  // The amount is a uniform, so faded materials of a kind share one compiled program.
  material.customProgramCacheKey = () => 'gp-fade';
}

export function createFinishes(): Finishes {
  // One amount for everything the stop is made of.
  const dim = { value: 0 };
  const paint = new MeshPhysicalMaterial({ vertexColors: true, metalness: 0, ...FINISH.paint });
  const matte = new MeshStandardMaterial({ vertexColors: true, metalness: 0, ...FINISH.matte });
  const metal = new MeshStandardMaterial({ vertexColors: true, ...FINISH.metal });
  for (const material of [paint, matte, metal]) fade(material, dim);
  return {
    paint,
    matte,
    metal,
    track(material) {
      fade(material, dim);
      return material;
    },
    setDim(value) {
      dim.value = value;
    },
  };
}

/** Still parts by finish, and whether they cast a shadow. */
type Bucket = Record<`${Finish}${'' | 'Flat'}`, BufferGeometry[]>;

const UP = new Vector3(0, 1, 0);
const color = new Color();

/**
 * Gives every zero-length normal a direction. A shape that tapers to a point (a layer that pinches
 * out, the band of oil in a tank) leaves faces with no area, and their normals at zero; a shader
 * normalizing one gets NaN, which bloom would spread over the whole frame.
 */
export function fixNormals(geometry: BufferGeometry): BufferGeometry {
  if (!geometry.hasAttribute('normal')) return geometry;
  const normals = geometry.getAttribute('normal');
  for (let i = 0; i < normals.count; i++) {
    const x = normals.getX(i);
    const y = normals.getY(i);
    const z = normals.getZ(i);
    if (x * x + y * y + z * z < 1e-12) normals.setXYZ(i, 0, 0, 1);
  }
  return geometry;
}

/** The pads a stop laid on the lawn, kept on its root when its parts were finished. */
export function padsOn(root: Object3D): readonly GroundRect[] {
  const pads: unknown = root.userData.pads;
  return Array.isArray(pads) ? (pads as GroundRect[]) : [];
}

/** Gives a geometry one flat color per vertex, in the working (linear) color space. */
function colorize(geometry: BufferGeometry, hex: string): BufferGeometry {
  // Merging needs every part to carry the same attributes.
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  color.set(hex);
  for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

export class Parts {
  readonly root = new Group();
  /** Pads laid on the lawn, which the grass wears thin around (see `padsOn`). */
  readonly pads: GroundRect[] = [];
  private readonly finishes: Finishes;
  private readonly buckets = new Map<Object3D, Bucket>();
  /** The transform parts are placed in: the stop's, or a group's within it. */
  private frame = new Matrix4();
  /** Where parts go: the stop's root, or a moving group. */
  private target: Object3D;

  constructor(finishes: Finishes) {
    this.finishes = finishes;
    this.target = this.root;
  }

  /** A box whose base sits at y. */
  box(
    w: number,
    h: number,
    d: number,
    hex: string,
    x: number,
    y: number,
    z: number,
    o: PartOptions = {},
  ) {
    // Soft, toy-like edges where a part is big enough to show them.
    const least = Math.min(w, h, d);
    const r = least > 0.3 ? Math.min(FINISH.bevel, least * 0.2) : 0;
    const g =
      r > 0 ? new RoundedBoxGeometry(w, h, d, r > 0.1 ? 3 : 2, r) : new BoxGeometry(w, h, d);
    this.add(g, hex, [x, y + h / 2, z], o);
  }

  /** A cylinder whose base sits at y. */
  cyl(
    rt: number,
    rb: number,
    h: number,
    hex: string,
    x: number,
    y: number,
    z: number,
    o: PartOptions = {},
  ) {
    this.add(new CylinderGeometry(rt, rb, h, o.segments ?? 16), hex, [x, y + h / 2, z], o);
  }

  /** A ball centered on (x, y, z). */
  ball(r: number, hex: string, x: number, y: number, z: number, o: PartOptions = {}) {
    const n = o.segments ?? 14;
    this.add(new SphereGeometry(r, n, Math.max(6, Math.round(n * 0.7))), hex, [x, y, z], o);
  }

  /** The top half of a ball, its flat side down at y, squashed to `squash` of its height. */
  dome(
    r: number,
    squash: number,
    hex: string,
    x: number,
    y: number,
    z: number,
    o: PartOptions = {},
  ) {
    const g = new SphereGeometry(r, o.segments ?? 18, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, squash, 1);
    this.add(g, hex, [x, y, z], o);
  }

  /** A cone centered on (x, y, z), its point up. */
  cone(r: number, h: number, hex: string, x: number, y: number, z: number, o: PartOptions = {}) {
    this.add(new ConeGeometry(r, h, o.segments ?? 12), hex, [x, y, z], o);
  }

  torus(
    r: number,
    tube: number,
    hex: string,
    x: number,
    y: number,
    z: number,
    o: PartOptions = {},
  ) {
    this.add(new TorusGeometry(r, tube, 8, o.segments ?? 24), hex, [x, y, z], o);
  }

  /** A rod from a to b, tapering to r2 when given. */
  rod(a: Point, b: Point, r: number, hex: string, o: PartOptions & { r2?: number } = {}) {
    const from = new Vector3(...a);
    const along = new Vector3(...b).sub(from);
    const g = new CylinderGeometry(o.r2 ?? r, r, along.length(), o.segments ?? 8);
    const q = new Quaternion().setFromUnitVectors(UP, along.clone().normalize());
    g.applyQuaternion(q);
    const mid = from.addScaledVector(along, 0.5);
    this.add(g, hex, [mid.x, mid.y, mid.z], { ...o, rx: 0, ry: 0, rz: 0 });
  }

  /** A tank lying along x with rounded ends, centered on (x, y, z). */
  bullet(
    len: number,
    r: number,
    hex: string,
    x: number,
    y: number,
    z: number,
    o: PartOptions = {},
  ) {
    const n = o.segments ?? 16;
    this.add(new CylinderGeometry(r, r, len, n), hex, [x, y, z], { ...o, rz: Math.PI / 2 });
    this.ball(r, hex, x - len / 2, y, z, { ...o, segments: n });
    this.ball(r, hex, x + len / 2, y, z, { ...o, segments: n });
  }

  /** A flat shape in the x-y plane, pushed `depth` along z from z0. */
  extrude(
    points: readonly (readonly [number, number])[],
    depth: number,
    hex: string,
    z0: number,
    o: PartOptions = {},
  ) {
    const shape = new Shape();
    const [first, ...rest] = points;
    if (!first) return;
    shape.moveTo(first[0], first[1]);
    for (const [px, py] of rest) shape.lineTo(px, py);
    const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    this.add(g, hex, [0, 0, z0], o);
  }

  /** Any geometry, placed at `at` with the part options. */
  add(geometry: BufferGeometry, hex: string, at: Point, o: PartOptions = {}) {
    const m = new Matrix4().compose(
      new Vector3(...at),
      new Quaternion().setFromEuler(new Euler(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0)),
      new Vector3(1, 1, 1),
    );
    geometry.applyMatrix4(m).applyMatrix4(this.frame);
    const bucket = this.bucket(this.target);
    const colored = colorize(fixNormals(geometry), hex);
    const finish = o.finish ?? 'paint';
    bucket[o.cast === false ? (`${finish}Flat` as const) : finish].push(colored);
  }

  /** Parts placed inside `fn` sit in a group at (x, y, z), turned `ry` about y; still ones merge. */
  group(x: number, y: number, z: number, fn: () => void, ry = 0) {
    const before = this.frame;
    this.frame = before.clone().multiply(new Matrix4().makeRotationY(ry).setPosition(x, y, z));
    fn();
    this.frame = before;
  }

  /**
   * A part the stop moves: its own object at (x, y, z), turned `ry` about y, which the stop's
   * animation turns or slides. Parts placed inside `fn` are in its own space.
   */
  moving(x: number, y: number, z: number, fn: () => void, ry = 0): Object3D {
    const object = new Object3D();
    object.position.set(x, y, z);
    object.rotation.y = ry;
    // Placed where the current group is, inside whatever is moving already.
    const parent = this.target;
    object.applyMatrix4(this.frame);
    parent.add(object);
    const [frame, target] = [this.frame, this.target];
    this.frame = new Matrix4();
    this.target = object;
    fn();
    this.frame = frame;
    this.target = target;
    return object;
  }

  /** Merges what was built into meshes, and returns the stop's root. */
  finish(): Group {
    for (const [object, bucket] of this.buckets) {
      const groups: [BufferGeometry[], Material, boolean][] = (
        ['paint', 'matte', 'metal'] as const
      ).flatMap((finish) => [
        [bucket[finish], this.finishes[finish], true],
        [bucket[`${finish}Flat`], this.finishes[finish], false],
      ]);
      for (const [list, material, cast] of groups) {
        if (list.length === 0) continue;
        const merged = mergeGeometries(list, false);
        for (const g of list) g.dispose();
        const mesh = new Mesh(merged, material);
        // The shadow map is drawn once, so only still parts cast into it.
        mesh.castShadow = cast && object === this.root;
        mesh.receiveShadow = true;
        object.add(mesh);
      }
    }
    this.buckets.clear();
    this.root.userData.pads = [...this.pads];
    return this.root;
  }

  private bucket(object: Object3D): Bucket {
    let b = this.buckets.get(object);
    if (!b) {
      b = { paint: [], paintFlat: [], matte: [], matteFlat: [], metal: [], metalFlat: [] };
      this.buckets.set(object, b);
    }
    return b;
  }
}
