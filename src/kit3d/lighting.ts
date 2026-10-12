/**
 * Procedural lighting, from the scene tokens:
 * - a gradient-sky environment (no HDR photos), prefiltered for soft image-based light;
 * - a key light (the sun, or the moon at night) whose shadow frustum hugs the scene;
 * - a sky and ground fill, and a rim light from behind that separates forms from the sky;
 * - the sky dome itself, and fog that fades into its horizon.
 * One exposure scales every light, so night can be darker and still read.
 */
import {
  BackSide,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
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
import { Sky, directionFrom, screenColor } from './sky.ts';

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
    new MeshBasicMaterial({ color: new Color(t.key.color).multiplyScalar(2.2), side: BackSide }),
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
  /**
   * After the camera is framed: centers the sky on it, and sets the fog so the farthest point the
   * lesson needs, `farDistance` away, has the theme's share of fog over it, and the edge of the
   * world, `edgeDistance` away, is all but hidden.
   */
  setViewpoint(camera: Vector3, farDistance: number, edgeDistance?: number): void;
  dispose(): void;
}

/** How much fog lies over the edge of the world, at the least. */
const EDGE_FOG = 0.98;

export interface LightingOptions {
  shadow: { mapSize: number; radius: number };
  /** The sky dome's radius, in scene units: well inside the camera's far plane. */
  skyRadius: number;
}

export function createLighting(
  renderer: WebGLRenderer,
  scene: Scene,
  bounds: Box3,
  tokens: SceneTokens,
  { shadow, skyRadius }: LightingOptions,
): Lighting {
  const pmrem = new PMREMGenerator(renderer);
  let envTarget: WebGLRenderTarget | null = null;

  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());

  const sky = new Sky(skyRadius);
  sky.follow(center);
  scene.add(sky.mesh);
  const fog = new FogExp2(0xffffff, 0.003);
  let fogAtFar = tokens.fogAtFar;
  let farDistance = Math.max(size.x, size.z);
  let edgeDistance = Infinity;
  /** FogExp2 hides a share f at distance d when density = sqrt(-ln(1 - f)) / d. */
  const densityFor = (share: number, distance: number) =>
    Math.sqrt(-Math.log(1 - share)) / Math.max(1, distance);
  const applyFog = () => {
    fog.density = Math.max(
      densityFor(Math.min(0.95, fogAtFar), farDistance),
      // Wherever the camera sits, the world's edge stays out of sight.
      densityFor(EDGE_FOG, edgeDistance),
    );
  };

  const key = new DirectionalLight();
  key.castShadow = true;
  key.target.position.copy(center);
  const half = Math.max(size.x, size.z) * 0.62;
  Object.assign(key.shadow.camera, {
    left: -half,
    right: half,
    top: half,
    bottom: -half,
    near: 120,
    far: 420,
  });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;

  const hemisphere = new HemisphereLight();
  const rim = new DirectionalLight();
  rim.target.position.copy(center);
  scene.add(key, key.target, hemisphere, rim, rim.target);

  const direction = new Vector3();

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
    // The sky dome is the backdrop; the environment only lights.
    scene.background = null;
    scene.environmentIntensity = t.envIntensity * t.exposure;
    // Fully fogged distance shows exactly the sky's horizon, so the two meet without a seam.
    screenColor(t.skyHorizon, fog.color);
    fogAtFar = t.fogAtFar;
    applyFog();
    scene.fog = fog;
    sky.setTheme(t);

    directionFrom(t.key.azimuth, t.key.elevation, direction);
    key.position.copy(center).addScaledVector(direction, 260);
    key.color.set(t.key.color);
    key.intensity = t.key.intensity * t.exposure;

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
      // The old environment's GPU objects went with the lost context; disposing them now would
      // only ask the new context to delete objects it never had.
      envTarget = null;
      setTheme(t);
    },
    setShadowQuality,
    setViewpoint(camera: Vector3, far: number, edge = Infinity) {
      sky.follow(camera);
      farDistance = far;
      edgeDistance = edge;
      applyFog();
    },
    dispose() {
      envTarget?.dispose();
      pmrem.dispose();
      key.shadow.map?.dispose();
      sky.dispose();
      scene.remove(key, key.target, hemisphere, rim, rim.target, sky.mesh);
    },
  };
}
