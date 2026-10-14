/**
 * The sky: a dome shaded from the horizon haze up to the zenith, with a soft glow where the back
 * light comes from. Below the horizon it turns to the paper color, so the section stands on the
 * page like a drawing. The fog fades into the horizon color, so the ground meets the sky without a seam.
 */
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { SceneTokens } from '../design/tokens.ts';
import { inversePbrNeutral } from './tonemap.ts';

/**
 * The color to draw so the screen shows `hex` after tone mapping. Backdrops that must match the
 * page (sky, fog, paper) are drawn through this; lit surfaces aren't.
 */
export function screenColor(hex: string, out = new Color()): Color {
  const c = out.set(hex);
  const [r, g, b] = inversePbrNeutral([c.r, c.g, c.b]);
  return out.setRGB(r, g, b);
}

/** A unit vector from a light's azimuth (degrees from the scene's front, toward +x) and elevation. */
export function directionFrom(azimuth: number, elevation: number, out = new Vector3()): Vector3 {
  const az = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 paper;
uniform vec3 glow;
uniform vec3 glowDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 above = mix(horizon, zenith, smoothstep(0.0, 0.6, y));
  vec3 below = mix(horizon, paper, smoothstep(0.0, 0.07, -y));
  vec3 c = y >= 0.0 ? above : below;
  float g = max(dot(d, glowDir), 0.0);
  c += glow * (pow(g, 6.0) * 0.16 + pow(g, 90.0) * 0.4) * smoothstep(-0.03, 0.05, y);
  gl_FragColor = vec4(c, 1.0);
}`;

export class Sky {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor(radius: number) {
    this.material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        zenith: { value: new Color() },
        horizon: { value: new Color() },
        paper: { value: new Color() },
        glow: { value: new Color() },
        glowDir: { value: new Vector3(0, 1, 0) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });
    this.mesh = new Mesh(new SphereGeometry(radius, 48, 24), this.material);
    this.mesh.name = 'sky';
    // Drawn first and never in front of anything, so it can't hide the scene or its shadows.
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }

  /** Centers the dome on the camera, so it's always inside the far plane, however far back the camera sits. */
  follow(position: Vector3): void {
    this.mesh.position.copy(position);
    this.mesh.updateMatrixWorld();
  }

  setTheme(t: SceneTokens): void {
    const u = this.material.uniforms as Record<string, { value: Color | Vector3 }>;
    screenColor(t.skyZenith, u.zenith?.value as Color);
    screenColor(t.skyHorizon, u.horizon?.value as Color);
    screenColor(t.paper, u.paper?.value as Color);
    // The glow adds to the sky, so it's a light, not a color to match.
    (u.glow?.value as Color).set(t.glow);
    directionFrom(t.rim.azimuth, t.rim.elevation, u.glowDir?.value as Vector3);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
