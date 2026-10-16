/**
 * Scenery around a model: a soft contact shadow, and instanced low-poly trees, shrubs and street
 * lights. Everything here is scenery: no APWA hues, few draw calls. Trees and shrubs are the
 * ground's cover, graded with the lawn wherever a scene grades it at night (`setGroundGrade`); at
 * night the lamps light up (`setLamps`), with pools of light on the street.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
} from 'three';
import { roundedBox } from './geometry.ts';
import { surface } from './materials.ts';
import { mulberry32 } from './rng.ts';

function flatPlane(x0: number, x1: number, z0: number, z1: number, y: number, rows = 1) {
  return new PlaneGeometry(x1 - x0, z1 - z0, 1, rows)
    .rotateX(-Math.PI / 2)
    .translate((x0 + x1) / 2, y, (z0 + z1) / 2);
}

export interface ContactShadow {
  readonly mesh: Mesh;
  /** How dark it is right at the wall, from 0 to 1. */
  setStrength(opacity: number): void;
}

/**
 * A soft shadow along the foot of a wall that faces +z: darkest at the wall and gone `depth` out.
 * It grounds a model standing in the sky, where no light would cast one.
 */
export function contactShadow(
  x0: number,
  x1: number,
  z: number,
  y: number,
  depth: number,
): ContactShadow {
  const geometry: BufferGeometry = flatPlane(x0, x1, z, z + depth, y, 6);
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

export interface WorldPalette {
  foliage: string;
  foliageDark: string;
  shrub: string;
  trunk: string;
  windowLit: string;
  pole: string;
  lamp: string;
  lampHousing: string;
}

export interface Scenery {
  readonly group: Group;
  /** Lamps: 0 off (day) to 1 fully on (night). */
  setLamps(level: number): void;
}

/**
 * How brightly lit windows and lamp heads glow at full night, as emissive intensity. Both stay
 * under the bloom threshold (checked in tokens.test.ts), so only fire and the signal bloom.
 */
export const WINDOW_GLOW = 1.5;
export const LAMP_GLOW = 2.6;

export interface TreeSpot {
  x: number;
  z: number;
  /** Overall height, in scene units. */
  height: number;
}

/** A smooth, round crown or bush: shaded soft, like a toy's, rather than faceted. */
function crown(): BufferGeometry {
  return new IcosahedronGeometry(1, 3);
}

/** Trees: a trunk and a round canopy each, two draw calls in all. */
export function buildTrees(spots: readonly TreeSpot[], palette: WorldPalette, seed = 7): Group {
  const rand = mulberry32(seed);
  const group = new Group();
  group.name = 'trees';
  const trunks = new InstancedMesh(
    new CylinderGeometry(0.28, 0.4, 1, 7).translate(0, 0.5, 0),
    surface(palette.trunk, { finish: 'matte', ground: true }),
    spots.length,
  );
  const canopies = new InstancedMesh(
    crown(),
    surface('#ffffff', { finish: 'matte', ground: true }),
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
    holder.scale.set(t.height / 24, trunkH, t.height / 24);
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

export interface ShrubSpot {
  x: number;
  z: number;
  /** Across, in scene units. */
  size: number;
}

/** Shrubs: low, round bushes sitting on the lawn, one draw call for the lot. */
export function buildShrubs(spots: readonly ShrubSpot[], palette: WorldPalette, seed = 11): Mesh {
  const rand = mulberry32(seed);
  const shrubs = new InstancedMesh(
    crown(),
    surface('#ffffff', { finish: 'matte', ground: true }),
    spots.length,
  );
  shrubs.name = 'shrubs';
  const holder = new Object3D();
  const base = new Color(palette.shrub);
  const dark = new Color(palette.foliageDark);
  const color = new Color();
  spots.forEach((s, i) => {
    const r = s.size / 2;
    const h = r * (0.6 + rand() * 0.2);
    holder.position.set(s.x, h * 0.55, s.z);
    holder.rotation.set(0, rand() * Math.PI, 0);
    holder.scale.set(r * (0.9 + rand() * 0.25), h, r);
    holder.updateMatrix();
    shrubs.setMatrixAt(i, holder.matrix);
    shrubs.setColorAt(i, color.copy(base).lerp(dark, rand() * 0.5));
  });
  shrubs.castShadow = true;
  shrubs.receiveShadow = true;
  return shrubs;
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
 * Street lights: poles, arms and lamp heads, with pools of light on the street at night. The
 * pools lie on the roadway, out past the lamp head, where a street light throws its light. `size`
 * scales the poles' girth and the heads, for a model smaller than life; a pool's `strength` is how
 * much light it adds at its middle, at full night.
 */
export function buildStreetLights(
  spots: readonly LampSpot[],
  palette: WorldPalette,
  { height = 21, reach = 5, size = 1, pool = { y: 0.1, radius: 7, strength: 0.26 } } = {},
): Scenery {
  const group = new Group();
  group.name = 'street-lights';
  const poles = new InstancedMesh(
    new CylinderGeometry(0.2 * size, 0.28 * size, height, 8).translate(0, height / 2, 0),
    surface(palette.pole, { finish: 'metal' }),
    spots.length * 2,
  );
  // A dark housing, so only the lamp's own glow brightens it, never the moonlight on it as well.
  const lampMaterial = new MeshStandardMaterial({
    color: new Color(palette.lampHousing),
    emissive: new Color(palette.lamp),
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const heads = new InstancedMesh(
    roundedBox(2.2 * size, 0.45 * size, 0.9 * size, 0.12 * size),
    lampMaterial,
    spots.length,
  );
  // Pools take the lamp's own warm white, never a yellow: on the ground, yellow would read as the
  // gas code.
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
    holder.position.set(s.x, height - 0.4 * size, s.z);
    holder.quaternion.setFromUnitVectors(up, out.set(dx, 0, dz).normalize());
    holder.scale.set(0.45, reach / height, 0.45);
    holder.updateMatrix();
    poles.setMatrixAt(i * 2 + 1, holder.matrix);
    holder.quaternion.identity();
    holder.rotation.set(0, s.facing, 0);
    holder.position.set(s.x + dx, height - 0.75 * size, s.z + dz);
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
      poolMaterial.opacity = level * pool.strength;
      pools.visible = level > 0;
    },
  };
}
