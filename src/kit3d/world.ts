/**
 * The world around a scene: a ground plane out to the horizon, a soft contact shadow, and
 * instanced low-poly homes, trees and street lights. Everything here is scenery: muted colors, no
 * APWA hues, few draw calls. At night the lamps and some windows light up (`setLamps`), with pools
 * of light on the street.
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
import { merge, roundedBox } from './geometry.ts';
import { surface, type NoiseOptions } from './materials.ts';
import { mulberry32 } from './rng.ts';

/** A rectangle on the ground, in scene units. */
export interface GroundRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

function flatPlane(r: GroundRect, y: number, rows = 1): BufferGeometry {
  return new PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0, 1, rows)
    .rotateX(-Math.PI / 2)
    .translate((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
}

/** A flat, lit ground plane, `y` up, covering one or more rectangles of the scene. */
export function groundPlane(
  rects: readonly GroundRect[],
  y: number,
  hex: string,
  noise?: NoiseOptions,
): Mesh {
  const mesh = new Mesh(
    merge(rects.map((r) => flatPlane(r, y))),
    surface(hex, { roughness: 1, ...(noise ? { noise } : {}) }),
  );
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

export interface ContactShadow {
  readonly mesh: Mesh;
  /** How dark it is right at the wall, from 0 to 1. */
  setStrength(opacity: number): void;
}

/**
 * A soft shadow on the ground along the foot of a wall that faces +z: darkest at the wall and
 * gone `depth` out. It grounds a section on its paper, where no light would cast one.
 */
export function contactShadow(
  x0: number,
  x1: number,
  z: number,
  y: number,
  depth: number,
): ContactShadow {
  const geometry = flatPlane({ x0, x1, z0: z, z1: z + depth }, y, 6);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, (position.getZ(i) - z) / depth));
    colors.set([1, 1, 1, (1 - t) * (1 - t)], i * 4);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 4));
  const material = new MeshBasicMaterial({
    color: new Color(0x000000),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'contact-shadow';
  mesh.renderOrder = 1;
  return {
    mesh,
    setStrength(opacity) {
      material.opacity = opacity;
    },
  };
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
  lampHousing: string;
}

export interface Scenery {
  readonly group: Group;
  /** Lamps and windows: 0 off (day) to 1 fully on (night). */
  setLamps(level: number): void;
}

const STORY_FT = 9.5;

/** At night, about this share of windows is lit; the rest stay dark, as in a real street. */
const LIT_SHARE = 0.55;

/**
 * How brightly lit windows and lamp heads glow at full night, as emissive intensity. Both stay
 * under the bloom threshold (checked in tokens.test.ts), so the signal is the only thing that glows.
 */
export const WINDOW_GLOW = 1.5;
export const LAMP_GLOW = 2.6;

/** Homes: walls, roofs and front windows, four draw calls however many there are. */
export function buildHomes(spots: readonly HomeSpot[], palette: WorldPalette, seed = 101): Scenery {
  const rand = mulberry32(seed);
  const group = new Group();
  group.name = 'homes';
  // Their rounding is a pixel or less on screen, so one segment per edge does.
  const walls = new InstancedMesh(
    roundedBox(1, 1, 1, 0.02, [0, 0, 0], 1),
    surface('#ffffff', { roughness: 0.9 }),
    spots.length,
  );
  const roofs = new InstancedMesh(
    gableGeometry(),
    surface('#ffffff', { roughness: 0.85 }),
    spots.length,
  );
  const litMaterial = new MeshStandardMaterial({
    color: new Color(palette.window),
    emissive: new Color(palette.windowLit),
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  const lit: Matrix4[] = [];
  const dark: Matrix4[] = [];
  const holder = new Object3D();
  const color = new Color();
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
        const m = new Matrix4()
          .makeScale(3.2, 3.8, 1)
          .setPosition((side * s.width) / 4, story * STORY_FT + 4.6, s.depth / 2 + 0.04)
          .premultiply(base);
        (rand() < LIT_SHARE ? lit : dark).push(m);
      }
    }
  });
  const pane = roundedBox(1, 1, 0.1, 0.02, [0, 0, 0], 1);
  const windows = (matrices: Matrix4[], material: MeshStandardMaterial) => {
    const mesh = new InstancedMesh(pane, material, matrices.length);
    matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
    });
    return mesh;
  };
  const litWindows = windows(lit, litMaterial);
  const darkWindows = windows(
    dark,
    new MeshStandardMaterial({ color: new Color(palette.window), roughness: 0.3 }),
  );
  for (const mesh of [walls, roofs, litWindows, darkWindows]) {
    mesh.castShadow = mesh === walls || mesh === roofs;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return {
    group,
    setLamps(level) {
      litMaterial.emissiveIntensity = level * WINDOW_GLOW;
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

/** A soft round spot of light, for pools under street lamps: bright in the middle, no edge. */
function poolTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.22)');
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

/**
 * Light pools add to what's under them, so fog has to fade them out rather than tint them toward
 * the fog color, or far pools turn into grey smudges. This is FogExp2's own curve, applied as a fade.
 */
const FOG_FADE = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb *= 1.0 - fogFactor;
#endif`;

/**
 * Street lights: poles, arms and lamp heads, with pools of light on the street at night. The
 * pools lie on the roadway, out past the lamp head, where a street light throws its light.
 */
export function buildStreetLights(
  spots: readonly LampSpot[],
  palette: WorldPalette,
  pool = { y: 0.1, radius: 7 },
): Scenery {
  const group = new Group();
  group.name = 'street-lights';
  const height = 21;
  const reach = 5;
  const poles = new InstancedMesh(
    new CylinderGeometry(0.2, 0.28, height, 8).translate(0, height / 2, 0),
    surface(palette.pole, { roughness: 0.6, metalness: 0.3 }),
    spots.length * 2,
  );
  // A dark housing, so only the lamp's own glow brightens it, never the moonlight on it as well.
  const lampMaterial = new MeshStandardMaterial({
    color: new Color(palette.lampHousing),
    emissive: new Color(palette.lamp),
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const heads = new InstancedMesh(roundedBox(2.2, 0.45, 0.9, 0.12), lampMaterial, spots.length);
  // Pools take the warm color of lamplight, as lit windows do, so they read as light on the street.
  const poolMaterial = new MeshBasicMaterial({
    map: poolTexture(),
    color: new Color(palette.windowLit),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  poolMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', FOG_FADE);
  };
  poolMaterial.customProgramCacheKey = () => 'pool-fog-fade';
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
    holder.position.set(s.x + dx * 2, pool.y, s.z + dz * 2);
    holder.scale.set(pool.radius * 2, 1, pool.radius * 2);
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
      lampMaterial.emissiveIntensity = level * LAMP_GLOW;
      poolMaterial.opacity = level * 0.26;
      pools.visible = level > 0;
    },
  };
}
