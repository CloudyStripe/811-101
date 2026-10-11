/**
 * Procedural lighting: a gradient-sky environment (no HDR photos) prefiltered for soft image-based
 * light, plus one key sun whose shadow frustum hugs the scene.
 */
import {
  BackSide,
  Color,
  DirectionalLight,
  FogExp2,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Box3,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import type { SceneTokens } from '../design/tokens.ts';
import { disposeObject } from './dispose.ts';

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 bottom;
varying vec3 vDir;
void main() {
  float y = vDir.y;
  vec3 c = y > 0.0 ? mix(horizon, top, pow(y, 0.6)) : mix(horizon, bottom, pow(-y, 0.5));
  gl_FragColor = vec4(c, 1.0);
}`;

function buildSky(tokens: SceneTokens): Scene {
  const scene = new Scene();
  const sky = new Mesh(
    new SphereGeometry(50, 48, 24),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new Color(tokens.skyTop) },
        horizon: { value: new Color(tokens.skyHorizon) },
        bottom: { value: new Color(tokens.groundBounce) },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
    }),
  );
  scene.add(sky);
  // A large soft panel above and in front: a broad highlight along pipes and rounded edges.
  const panel = new Mesh(
    new PlaneGeometry(40, 18),
    new MeshBasicMaterial({
      color: new Color(tokens.sunColor).multiplyScalar(2.2),
      side: BackSide,
    }),
  );
  panel.position.set(-12, 30, 28);
  panel.lookAt(0, 0, 0);
  scene.add(panel);
  return scene;
}

export interface Lighting {
  setTheme(tokens: SceneTokens): void;
  /** After a lost graphics context comes back: renders the sky again from scratch. */
  restore(tokens: SceneTokens): void;
  setShadowQuality(mapSize: number, radius: number): void;
  dispose(): void;
}

export function createLighting(
  renderer: WebGLRenderer,
  scene: Scene,
  bounds: Box3,
  tokens: SceneTokens,
  shadow: { mapSize: number; radius: number },
): Lighting {
  const pmrem = new PMREMGenerator(renderer);
  let envTarget: WebGLRenderTarget | null = null;

  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const sun = new DirectionalLight();
  // Low from the front left: long soft shadows across the street, light on the cut face.
  const direction = new Vector3(-0.55, 0.78, 0.62).normalize();
  sun.position.copy(center).addScaledVector(direction, 260);
  sun.target.position.copy(center);
  sun.castShadow = true;
  const half = Math.max(size.x, size.z) * 0.62;
  Object.assign(sun.shadow.camera, {
    left: -half,
    right: half,
    top: half,
    bottom: -half,
    near: 120,
    far: 420,
  });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  function setShadowQuality(mapSize: number, radius: number) {
    sun.shadow.mapSize.set(mapSize, mapSize);
    sun.shadow.radius = radius;
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    renderer.shadowMap.needsUpdate = true;
  }

  function setTheme(t: SceneTokens) {
    const sky = buildSky(t);
    const next = pmrem.fromScene(sky, 0.035);
    disposeObject(sky);
    envTarget?.dispose();
    envTarget = next;
    scene.environment = next.texture;
    scene.background = next.texture;
    scene.backgroundBlurriness = 0.55;
    scene.environmentIntensity = t.envIntensity;
    scene.fog = new FogExp2(new Color(t.fog), t.fogDensity);
    sun.color.set(t.sunColor);
    sun.intensity = t.sunIntensity;
    renderer.shadowMap.needsUpdate = true;
  }

  setShadowQuality(shadow.mapSize, shadow.radius);
  setTheme(tokens);

  return {
    setTheme,
    restore(t: SceneTokens) {
      // The old sky's GPU objects went with the lost context; disposing them now would only
      // ask the new context to delete objects it never had.
      envTarget = null;
      setTheme(t);
    },
    setShadowQuality,
    dispose() {
      envTarget?.dispose();
      pmrem.dispose();
      sun.shadow.map?.dispose();
      scene.remove(sun, sun.target);
    },
  };
}
