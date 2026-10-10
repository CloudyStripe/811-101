/**
 * Material presets: physically based, no photo textures. Surfaces that need richness get a
 * seeded procedural noise in world space instead.
 */
import { Color, MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three';

export interface NoiseOptions {
  /** Feature size, in scene units (feet). */
  scale: number;
  /** How far albedo varies, as a share (0.1 = ±10%). */
  amount: number;
}

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

function withNoise(material: MeshStandardMaterial, { scale, amount }: NoiseOptions): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.labNoiseScale = { value: 1 / scale };
    shader.uniforms.labNoiseAmount = { value: amount };
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
        `#include <common>\nvarying vec3 labWorldPos;\nuniform float labNoiseScale;\nuniform float labNoiseAmount;\n${NOISE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float labN = lab_noise(labWorldPos * labNoiseScale) * 0.65 + lab_noise(labWorldPos * labNoiseScale * 3.7) * 0.35;
diffuseColor.rgb *= 1.0 + labNoiseAmount * (labN - 0.5) * 2.0;`,
      );
  };
  material.customProgramCacheKey = () => `lab-noise-${scale}-${amount}`;
}

export interface SurfaceOptions extends MeshStandardMaterialParameters {
  noise?: NoiseOptions;
}

/** A standard PBR material from an sRGB hex color, optionally with procedural variation. */
export function surface(
  hex: string,
  { noise, ...params }: SurfaceOptions = {},
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: new Color(hex),
    roughness: 0.85,
    metalness: 0,
    ...params,
  });
  if (noise) withNoise(material, noise);
  return material;
}

/** Mixes an APWA color toward a material's base color, so the tint reads as a teaching aid. */
export function tint(baseHex: string, apwaHex: string, strength: number): string {
  const c = new Color(baseHex).lerp(new Color(apwaHex), strength);
  return `#${c.getHexString()}`;
}
