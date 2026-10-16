/**
 * Material presets: physically based, no photo textures. Surfaces that need richness get a
 * seeded procedural noise in world space instead, lawns get patches and worn edges, and the
 * ground's cover is graded for night.
 */
import {
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderChunk,
  Vector4,
  type Material,
  type MeshStandardMaterialParameters,
} from 'three';
import { FINISH, type GroundGrade } from '../design/tokens.ts';

/**
 * The brightest a lit surface may be, in the scene's linear light, before tone mapping: well
 * under bloom's threshold (post.ts), so a glint of sun on glossy paint or metal never blooms.
 * Only fire and the signal bloom. Tone mapping already shows anything this bright as
 * near white, so the cap changes nothing else on screen.
 */
export const GLINT_CAP = 2.2;

/**
 * Every standard and physical material ends by scaling its reflected light down to the cap when a
 * glint would go over, keeping its hue; what it emits is added back after. It's in the shader
 * chunk they all share, so no surface is left out.
 */
const GLINT_GLSL = /* glsl */ `
#ifdef STANDARD
{
  vec3 glintLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
  float glintPeak = max(max(glintLit.r, glintLit.g), glintLit.b);
  outgoingLight = glintLit * min(1.0, ${GLINT_CAP.toFixed(3)} / max(glintPeak, 1e-4)) + totalEmissiveRadiance;
}
#endif
`;
if (!ShaderChunk.opaque_fragment.includes('glintPeak')) {
  ShaderChunk.opaque_fragment = GLINT_GLSL + ShaderChunk.opaque_fragment;
}

export interface NoiseOptions {
  /** Feature size, in scene units (feet). */
  scale: number;
  /** How far albedo varies, as a share (0.1 = ±10%). */
  amount: number;
  /**
   * Scattered pebbles: small blobs darker than the surface (or lighter, with a negative amount),
   * so a cut face reads as soil or gravel rather than paint.
   */
  pebbles?: { scale: number; amount: number };
  /** A lawn's variation: patches, and worn edges. */
  lawn?: LawnOptions;
}

/** A rectangle on the ground, in scene units, along x and z. */
export interface GroundRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/**
 * What keeps a lawn from looking mown flat: big, soft patches of another green, and a band of
 * worn, drier grass around kerbs, paths and pads, ragged rather than ruled.
 */
export interface LawnOptions {
  patch: { hex: string; scale: number; share: number };
  worn: { hex: string; width: number; around: readonly GroundRect[] };
}

/** At most this many rectangles wear a lawn around them. */
export const WORN_MAX = 24;

const NOISE_GLSL = /* glsl */ `
float lab_hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float lab_noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lab_hash(i + vec3(0, 0, 0)), lab_hash(i + vec3(1, 0, 0)), f.x),
                 mix(lab_hash(i + vec3(0, 1, 0)), lab_hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(lab_hash(i + vec3(0, 0, 1)), lab_hash(i + vec3(1, 0, 1)), f.x),
                 mix(lab_hash(i + vec3(0, 1, 1)), lab_hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;

const LAWN_UNIFORMS = `uniform vec3 labPatchColor;
uniform float labPatchScale;
uniform float labPatchShare;
uniform vec3 labWornColor;
uniform float labWornWidth;
uniform vec4 labWornRects[${String(WORN_MAX)}];
uniform int labWornCount;
`;

const LAWN_GLSL = /* glsl */ `
float labPn = lab_noise(labWorldPos * labPatchScale + 31.0) * 0.7 + lab_noise(labWorldPos * labPatchScale * 2.3 + 5.0) * 0.3;
// Lighter patches where the noise is high, deeper green where it is low.
diffuseColor.rgb = mix(diffuseColor.rgb, labPatchColor, smoothstep(0.52, 0.78, labPn) * labPatchShare);
diffuseColor.rgb *= 1.0 - 0.16 * (1.0 - smoothstep(0.22, 0.48, labPn)) * labPatchShare;
float labNearest = 1e5;
for (int i = 0; i < ${String(WORN_MAX)}; i++) {
  if (i >= labWornCount) break;
  vec4 r = labWornRects[i];
  vec2 d = max(abs(labWorldPos.xz - r.xy) - r.zw, 0.0);
  labNearest = min(labNearest, length(d));
}
float labRag = lab_noise(labWorldPos * 1.3 + 7.0);
float labWorn = 1.0 - smoothstep(0.0, labWornWidth, labNearest - (labRag - 0.5) * labWornWidth);
diffuseColor.rgb = mix(diffuseColor.rgb, labWornColor, labWorn * 0.85);
`;

/** A rectangle as the lawn shader takes it: its middle, then its half sizes. */
function wornRect(r: GroundRect): Vector4 {
  return new Vector4(
    (r.x0 + r.x1) / 2,
    (r.z0 + r.z1) / 2,
    Math.abs(r.x1 - r.x0) / 2,
    Math.abs(r.z1 - r.z0) / 2,
  );
}

function withNoise(
  material: MeshStandardMaterial,
  { scale, amount, pebbles, lawn }: NoiseOptions,
): void {
  const worn = (lawn?.worn.around ?? []).slice(0, WORN_MAX).map(wornRect);
  const wornCount = worn.length;
  while (worn.length < WORN_MAX) worn.push(new Vector4(1e6, 1e6, 0, 0));
  material.onBeforeCompile = (shader) => {
    shader.uniforms.labNoiseScale = { value: 1 / scale };
    shader.uniforms.labNoiseAmount = { value: amount };
    shader.uniforms.labPebbleScale = { value: pebbles ? 1 / pebbles.scale : 0 };
    shader.uniforms.labPebbleAmount = { value: pebbles?.amount ?? 0 };
    if (lawn) {
      shader.uniforms.labPatchColor = { value: new Color(lawn.patch.hex) };
      shader.uniforms.labPatchScale = { value: 1 / lawn.patch.scale };
      shader.uniforms.labPatchShare = { value: lawn.patch.share };
      shader.uniforms.labWornColor = { value: new Color(lawn.worn.hex) };
      shader.uniforms.labWornWidth = { value: lawn.worn.width };
      shader.uniforms.labWornRects = { value: worn };
      shader.uniforms.labWornCount = { value: wornCount };
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 labWorldPos;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vec4 labWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
labWorld = instanceMatrix * labWorld;
#endif
labWorldPos = (modelMatrix * labWorld).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 labWorldPos;\nuniform float labNoiseScale;\nuniform float labNoiseAmount;\nuniform float labPebbleScale;\nuniform float labPebbleAmount;\n${lawn ? LAWN_UNIFORMS : ''}${NOISE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float labN = lab_noise(labWorldPos * labNoiseScale) * 0.65 + lab_noise(labWorldPos * labNoiseScale * 3.7) * 0.35;
diffuseColor.rgb *= 1.0 + labNoiseAmount * (labN - 0.5) * 2.0;
if (labPebbleScale > 0.0) {
  float labP = smoothstep(0.74, 0.8, lab_noise(labWorldPos * labPebbleScale + 17.0));
  diffuseColor.rgb *= 1.0 - labPebbleAmount * labP;
}
${lawn ? LAWN_GLSL : ''}`,
      );
  };
  // The settings are uniforms, so every noisy material (and every lawn) shares one program.
  material.customProgramCacheKey = () => (lawn ? 'lab-noise-lawn' : 'lab-noise');
}

/**
 * The ground grade (SceneTokens.ground), shared by every material graded as ground, so a change of
 * theme compiles nothing.
 */
const GRADE = {
  labGradeDim: { value: 0 },
  labGradeGray: { value: 0 },
  labGradeTint: { value: new Color(1, 1, 1) },
};

const GRADE_UNIFORMS = `uniform float labGradeDim;
uniform float labGradeGray;
uniform vec3 labGradeTint;
`;

/** The grade, as `groundGrade` does it, after everything else the material does to its color. */
const GRADE_GLSL = /* glsl */ `
{
  float labGradeL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(labGradeL), labGradeGray) * labGradeTint * (1.0 - labGradeDim);
}
`;

const WHITE = new Color(1, 1, 1);

/**
 * A grade's tint in linear light, scaled to a luminance of 1 so it shifts hue, not brightness, and
 * eased toward white by `strength`.
 */
function gradeTint(hex: string, strength: number, target = new Color()): Color {
  target.set(hex);
  const l = 0.2126 * target.r + 0.7152 * target.g + 0.0722 * target.b;
  return target.multiplyScalar(1 / Math.max(l, 1e-4)).lerp(WHITE, 1 - strength);
}

/**
 * Sets the ground grade, at a `strength` from 0 (none) to 1 (all of it): every material graded as
 * ground follows it.
 */
export function setGroundGrade(grade: GroundGrade, strength = 1): void {
  GRADE.labGradeDim.value = grade.dim * strength;
  GRADE.labGradeGray.value = grade.gray * strength;
  gradeTint(grade.tint, strength, GRADE.labGradeTint.value);
}

/** A color in linear light as the grade draws it, as the shader does. */
export function groundGrade(
  [r, g, b]: readonly [number, number, number],
  grade: GroundGrade,
  strength = 1,
): [number, number, number] {
  const tint = gradeTint(grade.tint, strength);
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const gray = grade.gray * strength;
  const k = 1 - grade.dim * strength;
  return [
    (r + (l - r) * gray) * tint.r * k,
    (g + (l - g) * gray) * tint.g * k,
    (b + (l - b) * gray) * tint.b * k,
  ];
}

/**
 * Grades a material as the ground's cover: at night the ground grade dims, grays and cools its
 * color, after whatever else the material does to it (noise, a lawn's patches, a fade).
 */
export function gradeAsGround<M extends Material>(material: M): M {
  const before = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    Object.assign(shader.uniforms, GRADE);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GRADE_UNIFORMS}`)
      .replace('#include <alphamap_fragment>', `${GRADE_GLSL}#include <alphamap_fragment>`);
  };
  material.customProgramCacheKey = () => `${key()}+ground`;
  return material;
}

/**
 * How a surface is finished (FINISH in tokens.ts): glossy paint with a clear coat, matte, or
 * metal. Without one, a surface is a plain, fairly rough material.
 */
export type Finish = 'paint' | 'matte' | 'metal';

export interface SurfaceOptions extends MeshStandardMaterialParameters {
  finish?: Finish;
  noise?: NoiseOptions;
  /** The ground's cover (lawn, plants, paving): graded at night, see `gradeAsGround`. */
  ground?: boolean;
}

/**
 * A physically based material from an sRGB hex color, in a finish, optionally with procedural
 * variation, and graded at night if it's the ground's cover. Roughness or metalness given here win
 * over the finish's.
 */
export function surface(
  hex: string,
  { finish, noise, ground, ...params }: SurfaceOptions = {},
): MeshStandardMaterial {
  const color = new Color(hex);
  const material =
    finish === 'paint'
      ? new MeshPhysicalMaterial({ color, metalness: 0, ...FINISH.paint, ...params })
      : new MeshStandardMaterial({
          color,
          roughness: 0.85,
          metalness: 0,
          ...(finish === 'matte' ? FINISH.matte : finish === 'metal' ? FINISH.metal : {}),
          ...params,
        });
  if (noise) withNoise(material, noise);
  if (ground) gradeAsGround(material);
  return material;
}

/** Mixes an APWA color toward a material's base color, so the tint reads as a teaching aid. */
export function tint(baseHex: string, apwaHex: string, strength: number): string {
  const c = new Color(baseHex).lerp(new Color(apwaHex), strength);
  return `#${c.getHexString()}`;
}
