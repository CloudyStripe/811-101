/**
 * The world around a scene: a ground plane out to the horizon, and instanced low-poly homes,
 * trees and street lights. Everything here is scenery: muted colors, no APWA hues, few draw calls.
 * At night the lamps and windows light up (`setLamps`), with pools of light on the ground.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { roundedBox } from './geometry.ts';
import { surface, type NoiseOptions } from './materials.ts';
import { mulberry32 } from './rng.ts';

/** A flat ground plane, `y` up, covering a rectangle of the scene. */
export function groundPlane(
  rect: { x0: number; x1: number; z0: number; z1: number },
  y: number,
  hex: string,
  noise?: NoiseOptions,
): Mesh {
  const w = rect.x1 - rect.x0;
  const d = rect.z1 - rect.z0;
  const geometry = new PlaneGeometry(w, d, 1, 1)
    .rotateX(-Math.PI / 2)
    .translate((rect.x0 + rect.x1) / 2, y, (rect.z0 + rect.z1) / 2);
  const mesh = new Mesh(geometry, surface(hex, { roughness: 1, ...(noise ? { noise } : {}) }));
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

/** A gable roof one unit wide (x), deep (z) and high, its ridge along x, its base at y = 0. */
function gableGeometry(): BufferGeometry {
  // Two slopes and two gable ends, as flat-shaded triangles.
  const a = [-0.5, 0, 0.5];
  const b = [0.5, 0, 0.5];
  const c = [0.5, 0, -0.5];
  const d = [-0.5, 0, -0.5];
  const e = [-0.5, 1, 0];
  const f = [0.5, 1, 0];
  const tris = [a, b, f, a, f, e, c, d, e, c, e, f, d, a, e, b, c, f];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(tris.flat()), 3));
  geometry.computeVertexNormals();
  return geometry;
}

export interface HomeSpot {
  x: number;
  z: number;
  width: number;
  depth: number;
  stories: 1 | 2;
  /** Turns the home about y; at 0 its front faces +z. */
  rotation: number;
}

export interface WorldPalette {
  walls: readonly string[];
  roofs: readonly string[];
  trim: string;
  window: string;
  windowLit: string;
  foliage: string;
  foliageDark: string;
  trunk: string;
  pole: string;
  lamp: string;
}

export interface Scenery {
  readonly group: Group;
  /** Lamps and windows: 0 off (day) to 1 fully on (night). */
  setLamps(level: number): void;
}

const STORY_FT = 9.5;

/** Homes: walls, roofs and front windows, three draw calls however many there are. */
export function buildHomes(spots: readonly HomeSpot[], palette: WorldPalette, seed = 101): Scenery {
  const rand = mulberry32(seed);
  const group = new Group();
  group.name = 'homes';
  const walls = new InstancedMesh(
    roundedBox(1, 1, 1, 0.02),
    surface('#ffffff', { roughness: 0.9 }),
    spots.length,
  );
  const roofs = new InstancedMesh(
    gableGeometry(),
    surface('#ffffff', { roughness: 0.85 }),
    spots.length,
  );
  const windowsPer = 2;
  const windowMaterial = new MeshStandardMaterial({
    color: new Color(palette.window),
    emissive: new Color(palette.windowLit),
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  const windows = new InstancedMesh(
    roundedBox(1, 1, 0.1, 0.02),
    windowMaterial,
    spots.reduce((n, s) => n + s.stories * windowsPer, 0),
  );
  const holder = new Object3D();
  const m = new Matrix4();
  const color = new Color();
  let w = 0;
  spots.forEach((s, i) => {
    const height = s.stories * STORY_FT;
    holder.position.set(s.x, height / 2, s.z);
    holder.rotation.set(0, s.rotation, 0);
    holder.scale.set(s.width, height, s.depth);
    holder.updateMatrix();
    walls.setMatrixAt(i, holder.matrix);
    walls.setColorAt(i, color.set(palette.walls[i % palette.walls.length] ?? palette.trim));

    holder.position.set(s.x, height, s.z);
    holder.scale.set(s.width + 1.6, 4 + rand() * 4 + s.depth * 0.08, s.depth + 2);
    holder.updateMatrix();
    roofs.setMatrixAt(i, holder.matrix);
    roofs.setColorAt(
      i,
      color.set(palette.roofs[Math.floor(rand() * palette.roofs.length)] ?? palette.trim),
    );

    // Front windows, two per story, on the face toward +z before turning.
    const base = new Matrix4().makeRotationY(s.rotation).setPosition(s.x, 0, s.z);
    for (let story = 0; story < s.stories; story++) {
      for (const side of [-1, 1]) {
        m.makeScale(3.2, 3.8, 1).setPosition(
          (side * s.width) / 4,
          story * STORY_FT + 4.6,
          s.depth / 2 + 0.04,
        );
        windows.setMatrixAt(w++, m.premultiply(base));
      }
    }
  });
  for (const mesh of [walls, roofs, windows]) {
    mesh.castShadow = mesh !== windows;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return {
    group,
    setLamps(level) {
      windowMaterial.emissiveIntensity = level * 1.5;
    },
  };
}

export interface TreeSpot {
  x: number;
  z: number;
  /** Overall height, in scene units. */
  height: number;
}

/** Trees: a trunk and a soft canopy each, two draw calls in all. */
export function buildTrees(spots: readonly TreeSpot[], palette: WorldPalette, seed = 7): Group {
  const rand = mulberry32(seed);
  const group = new Group();
  group.name = 'trees';
  const trunks = new InstancedMesh(
    new CylinderGeometry(0.28, 0.4, 1, 7).translate(0, 0.5, 0),
    surface(palette.trunk, { roughness: 0.95 }),
    spots.length,
  );
  const canopies = new InstancedMesh(
    new IcosahedronGeometry(1, 1),
    surface('#ffffff', { roughness: 0.95 }),
    spots.length,
  );
  const holder = new Object3D();
  const light = new Color(palette.foliage);
  const dark = new Color(palette.foliageDark);
  const color = new Color();
  spots.forEach((t, i) => {
    const trunkH = t.height * 0.42;
    holder.position.set(t.x, 0, t.z);
    holder.rotation.set(0, rand() * Math.PI, 0);
    holder.scale.set(1, trunkH, 1);
    holder.updateMatrix();
    trunks.setMatrixAt(i, holder.matrix);
    const r = t.height * (0.3 + rand() * 0.08);
    holder.position.set(t.x, trunkH + r * 0.72, t.z);
    holder.scale.set(r, r * (0.95 + rand() * 0.25), r);
    holder.updateMatrix();
    canopies.setMatrixAt(i, holder.matrix);
    canopies.setColorAt(i, color.copy(dark).lerp(light, rand()));
  });
  for (const mesh of [trunks, canopies]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

/** A soft round spot of light, for pools under street lamps. */
function poolTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export interface LampSpot {
  x: number;
  z: number;
  /** Which way the arm reaches, in radians about y; 0 reaches toward -z. */
  facing: number;
}

/** Street lights: poles, arms and lamp heads, with pools of light on the ground at night. */
export function buildStreetLights(spots: readonly LampSpot[], palette: WorldPalette): Scenery {
  const group = new Group();
  group.name = 'street-lights';
  const height = 21;
  const reach = 5;
  const poles = new InstancedMesh(
    new CylinderGeometry(0.2, 0.28, height, 8).translate(0, height / 2, 0),
    surface(palette.pole, { roughness: 0.6, metalness: 0.3 }),
    spots.length * 2,
  );
  const lampMaterial = new MeshStandardMaterial({
    color: new Color(palette.lamp),
    emissive: new Color(palette.lamp),
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const heads = new InstancedMesh(roundedBox(2.2, 0.45, 0.9, 0.12), lampMaterial, spots.length);
  const poolMaterial = new MeshBasicMaterial({
    map: poolTexture(),
    color: new Color(palette.lamp),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const pools = new InstancedMesh(
    new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    poolMaterial,
    spots.length,
  );
  const holder = new Object3D();
  const up = new Vector3(0, 1, 0);
  const out = new Vector3();
  spots.forEach((s, i) => {
    const dx = -Math.sin(s.facing) * reach;
    const dz = -Math.cos(s.facing) * reach;
    holder.quaternion.identity();
    holder.position.set(s.x, 0, s.z);
    holder.scale.set(1, 1, 1);
    holder.updateMatrix();
    poles.setMatrixAt(i * 2, holder.matrix);
    // The arm: the same pole, thinner and shorter, reaching out from the top toward the street.
    holder.position.set(s.x, height - 0.4, s.z);
    holder.quaternion.setFromUnitVectors(up, out.set(dx, 0, dz).normalize());
    holder.scale.set(0.45, reach / height, 0.45);
    holder.updateMatrix();
    poles.setMatrixAt(i * 2 + 1, holder.matrix);
    holder.quaternion.identity();
    holder.rotation.set(0, s.facing, 0);
    holder.position.set(s.x + dx, height - 0.75, s.z + dz);
    holder.scale.set(1, 1, 1);
    holder.updateMatrix();
    heads.setMatrixAt(i, holder.matrix);
    holder.rotation.set(0, 0, 0);
    holder.position.set(s.x + dx, 0.06, s.z + dz);
    holder.scale.set(30, 1, 30);
    holder.updateMatrix();
    pools.setMatrixAt(i, holder.matrix);
  });
  poles.castShadow = true;
  heads.castShadow = true;
  pools.renderOrder = 1;
  group.add(poles, heads, pools);
  pools.visible = false;
  return {
    group,
    setLamps(level) {
      lampMaterial.emissiveIntensity = level * 4;
      poolMaterial.opacity = level * 0.32;
      pools.visible = level > 0;
    },
  };
}
