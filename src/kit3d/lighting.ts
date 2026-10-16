/**
 * Procedural lighting, from the scene tokens:
 * - a gradient-sky environment (no HDR photos), prefiltered for soft image-based light, with a
 *   soft panel on the sun's side for broad highlights;
 * - a key light (the sun, or the moon at night) whose shadow frustum hugs the scene;
 * - a sky and ground fill, and a rim light from behind that separates forms from the sky;
 * - the sky itself, as a gradient backdrop behind the model (backdrop.ts). There's no fog: the
 *   model is all there is, and it floats in the sky.
 * One exposure scales every light, so night can be darker and still read.
 */
import {
  BackSide,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Box3,
  type Texture,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import type { SceneTokens } from '../design/tokens.ts';
import { backdropTexture } from './backdrop.ts';
import { disposeObject } from './dispose.ts';

/** A unit vector from a light's azimuth (degrees from the scene's front, toward +x) and elevation. */
export function directionFrom(azimuth: number, elevation: number, out = new Vector3()): Vector3 {
  const az = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

const ENV_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const ENV_FRAGMENT = /* glsl */ `
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 bottom;
varying vec3 vDir;
void main() {
  float y = vDir.y;
  vec3 c = y > 0.0 ? mix(horizon, top, pow(y, 0.6)) : mix(horizon, bottom, pow(-y, 0.5));
  gl_FragColor = vec4(c, 1.0);
}`;

/** The environment light's source: the sky's gradient, plus a soft panel for broad highlights. */
function buildEnvironment(t: SceneTokens): Scene {
  const scene = new Scene();
  scene.add(
    new Mesh(
      new SphereGeometry(50, 48, 24),
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new Color(t.skyZenith) },
          horizon: { value: new Color(t.skyHorizon) },
          bottom: { value: new Color(t.hemisphere.ground) },
        },
        vertexShader: ENV_VERTEX,
        fragmentShader: ENV_FRAGMENT,
      }),
    ),
  );
  // A large soft panel on the key light's side: a broad highlight along pipes and rounded edges.
  const panel = new Mesh(
    new PlaneGeometry(40, 18),
    new MeshBasicMaterial({
      color: new Color(t.key.color).multiplyScalar(t.softbox),
      side: BackSide,
    }),
  );
  panel.position
    .copy(directionFrom(t.key.azimuth, Math.max(t.key.elevation, 35)))
    .multiplyScalar(40);
  panel.lookAt(0, 0, 0);
  scene.add(panel);
  return scene;
}

export interface Lighting {
  setTheme(tokens: SceneTokens): void;
  /** After a lost graphics context comes back: renders the environment again from scratch. */
  restore(tokens: SceneTokens): void;
  setShadowQuality(mapSize: number, radius: number): void;
  dispose(): void;
}

export interface LightingOptions {
  shadow: { mapSize: number; radius: number };
}

export function createLighting(
  renderer: WebGLRenderer,
  scene: Scene,
  bounds: Box3,
  tokens: SceneTokens,
  { shadow }: LightingOptions,
): Lighting {
  const pmrem = new PMREMGenerator(renderer);
  let envTarget: WebGLRenderTarget | null = null;
  let backdrop: Texture | null = null;

  const center = bounds.getCenter(new Vector3());

  const key = new DirectionalLight();
  key.castShadow = true;
  key.target.position.copy(center);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;

  const hemisphere = new HemisphereLight();
  const rim = new DirectionalLight();
  rim.target.position.copy(center);
  scene.add(key, key.target, hemisphere, rim, rim.target);

  const direction = new Vector3();
  const probe = new OrthographicCamera();
  const corner = new Vector3();

  /**
   * Fits the shadow's frustum to the scene as the key light sees it, so its map is spent on the
   * model, wherever the sun is. Ground in a shadow lies in line with what casts it, so only depth
   * needs room beyond the model: farther, for long shadows, and nearer, for anything standing taller.
   */
  function fitShadow() {
    probe.position.copy(key.position);
    probe.lookAt(center);
    probe.updateMatrixWorld();
    const lo = new Vector3(Infinity, Infinity, Infinity);
    const hi = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          corner.set(x, y, z).applyMatrix4(probe.matrixWorldInverse);
          lo.min(corner);
          hi.max(corner);
        }
    const margin = 1;
    Object.assign(key.shadow.camera, {
      left: lo.x - margin,
      right: hi.x + margin,
      bottom: lo.y - margin,
      top: hi.y + margin,
      near: Math.max(1, -hi.z - 60),
      far: -lo.z + 120,
    });
    key.shadow.camera.updateProjectionMatrix();
  }

  function setShadowQuality(mapSize: number, radius: number) {
    key.shadow.mapSize.set(mapSize, mapSize);
    key.shadow.radius = radius;
    key.shadow.map?.dispose();
    key.shadow.map = null;
    renderer.shadowMap.needsUpdate = true;
  }

  function setTheme(t: SceneTokens) {
    const environment = buildEnvironment(t);
    const next = pmrem.fromScene(environment, 0.035);
    disposeObject(environment);
    envTarget?.dispose();
    envTarget = next;
    scene.environment = next.texture;
    scene.environmentIntensity = t.envIntensity * t.exposure;
    backdrop?.dispose();
    backdrop = backdropTexture(t);
    scene.background = backdrop;

    directionFrom(t.key.azimuth, t.key.elevation, direction);
    key.position.copy(center).addScaledVector(direction, 260);
    key.color.set(t.key.color);
    key.intensity = t.key.intensity * t.exposure;
    fitShadow();

    hemisphere.color.set(t.hemisphere.sky);
    hemisphere.groundColor.set(t.hemisphere.ground);
    hemisphere.intensity = t.hemisphere.intensity * t.exposure;

    directionFrom(t.rim.azimuth, t.rim.elevation, direction);
    rim.position.copy(center).addScaledVector(direction, 200);
    rim.color.set(t.rim.color);
    rim.intensity = t.rim.intensity * t.exposure;

    renderer.shadowMap.needsUpdate = true;
  }

  setShadowQuality(shadow.mapSize, shadow.radius);
  setTheme(tokens);

  return {
    setTheme,
    restore(t: SceneTokens) {
      // The old environment's and backdrop's GPU objects went with the lost context; disposing
      // them now would only ask the new context to delete objects it never had.
      envTarget = null;
      backdrop = null;
      setTheme(t);
    },
    setShadowQuality,
    dispose() {
      envTarget?.dispose();
      backdrop?.dispose();
      pmrem.dispose();
      key.shadow.map?.dispose();
      scene.remove(key, key.target, hemisphere, rim, rim.target);
      scene.background = null;
    },
  };
}
