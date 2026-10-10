/**
 * The Frequency Lab's 3D scene: the street block, both setups, the signal effects and the
 * labels, behind a small API the UI drives.
 */
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { frequencyLabel, type Frequency } from '../../../../config/equipment.ts';
import { THEMES, type ThemeName } from '../../../design/tokens.ts';
import { LabCamera, type VisibleArea } from '../../../kit3d/camera.ts';
import { disposeObject } from '../../../kit3d/dispose.ts';
import { LabelLayer } from '../../../kit3d/labels.ts';
import { createLighting } from '../../../kit3d/lighting.ts';
import { PerfHud } from '../../../kit3d/perf.ts';
import { createPost, type Post } from '../../../kit3d/post.ts';
import {
  Governor,
  TIER_SETTINGS,
  guessTier,
  pixelRatioFor,
  type Tier,
} from '../../../kit3d/quality.ts';
import { createDepthUniforms } from '../../../kit3d/signal-pass.ts';
import { Stage } from '../../../kit3d/stage.ts';
import { labState, type SetupId } from '../../../signal/model.ts';
import type { Label } from '../../../kit3d/labels.ts';
import { LABEL_SPECS, type LabelId } from './labels.ts';
import { BLOCK, VIEWS } from './layout.ts';
import { buildSetup, buildShared } from './lines.ts';
import { SignalEffects } from './signal.ts';
import { buildStreet } from './street.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabSceneOptions {
  canvas: HTMLCanvasElement;
  labelElements: Map<LabelId, HTMLElement>;
  setup: SetupId;
  frequency: Frequency;
  tier: Tier | 'auto';
  theme: ThemeName;
  reducedMotion: boolean;
  /** Deterministic frames for screenshots: fixed time and tier, no governor, one frame then stop. */
  capture: boolean;
  perf: boolean;
  /** The part of the canvas the panel and controls leave free, in CSS pixels. */
  visibleArea: () => VisibleArea;
  /** Rectangles labels must avoid, in the canvas's CSS pixels. */
  noGo: () => Rect[];
  onTierChange?: (tier: Tier) => void;
  onContextLost?: () => void;
}

export interface LabScene {
  setState(setup: SetupId, frequency: Frequency): void;
  setTheme(theme: ThemeName): void;
  setReducedMotion(reduced: boolean): void;
  setTier(tier: Tier | 'auto'): Promise<void>;
  readonly tier: Tier;
  /** Re-measures labels and layout, e.g. after fonts load or the panel changes. */
  relayout(): void;
  resetView(): void;
  rotate(direction: -1 | 1): void;
  tilt(direction: -1 | 1): void;
  zoom(direction: -1 | 1): void;
  dispose(): void;
}

const FACE_NORMAL = new Vector3(0, 0, 1);

function labelsFor(elements: Map<LabelId, HTMLElement>, setup: SetupId): Label[] {
  return LABEL_SPECS.flatMap((spec) => {
    const element = elements.get(spec.id);
    if (!element) return [];
    return [
      {
        id: spec.id,
        element,
        anchor: new Vector3(...spec.anchor[setup]),
        priority: spec.priority,
        hidden: spec.text[setup] === null,
        ...(spec.onFace ? { facing: FACE_NORMAL } : {}),
      },
    ];
  });
}

export async function createLabScene(o: LabSceneOptions): Promise<LabScene> {
  const scene = new Scene();
  const fxScene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.5, 900);
  const depthUniforms = createDepthUniforms();

  let tier: Tier = o.tier === 'auto' ? 'medium' : o.tier;
  let governor: Governor | null = null;
  let post: Post | null = null;
  let labelsDirty = true;
  let animTime = 1.25;
  let reducedMotion = o.reducedMotion;
  let setup = o.setup;
  let frequency = o.frequency;
  let rebuilding: Promise<void> | null = null;
  let disposed = false;

  const stage = new Stage(
    o.canvas,
    {
      frame(dt) {
        if (!post) return false;
        const moved = cam.update(dt);
        const animating = !reducedMotion && !o.capture;
        if (animating) {
          animTime += dt;
          fx.setTime(animTime);
        }
        if (moved || labelsDirty) {
          // camera-controls moves the camera; its matrices only refresh at render time.
          camera.updateMatrixWorld();
          labels.update(stage.width, stage.height);
          labelsDirty = false;
        }
        post.render(dt);
        const now = performance.now();
        hud?.frame(dt * 1000, now, stage.renderer, tier, stage.pixelRatio);
        const next = governor?.sample(dt * 1000, now);
        if (next) void changeTier(next);
        return animating || moved;
      },
      resize(width, height) {
        cam.setLayout(width, height, o.visibleArea());
        post?.setSize(width, height);
        labelsDirty = true;
      },
      contextLost() {
        o.onContextLost?.();
      },
      contextRestored() {
        labelsDirty = true;
      },
    },
    (w, h) => pixelRatioFor(tier, w, h, window.devicePixelRatio || 1),
  );
  const { renderer } = stage;

  if (o.tier === 'auto') {
    const gl = renderer.getContext();
    const gpu = String(gl.getParameter(gl.RENDERER));
    const guessed = guessTier(gpu, matchMedia('(pointer: coarse)').matches);
    tier = o.capture ? 'medium' : guessed;
    if (!o.capture) governor = new Governor(tier, guessed);
  }

  const bounds = new Box3(
    new Vector3(BLOCK.x0, BLOCK.bottom, BLOCK.z0),
    new Vector3(BLOCK.x1, 4, BLOCK.z1),
  );
  const settings = () => TIER_SETTINGS[tier];
  const lighting = createLighting(renderer, scene, bounds, THEMES[o.theme].scene, {
    mapSize: settings().shadowMapSize,
    radius: settings().shadowRadius,
  });
  const street = buildStreet();
  street.setDetail(settings().detail);
  const shared = buildShared();
  const setups = { steel: buildSetup('steel'), tracer: buildSetup('tracer') };
  scene.add(street.group, shared.group, setups.steel, setups.tracer);
  const fx = new SignalEffects(depthUniforms);
  fx.setTime(animTime);
  fxScene.add(fx.group);

  const cam = new LabCamera(camera, o.canvas, {
    minDistance: 10,
    maxDistance: 170,
    minPolarAngle: 0.3,
    maxPolarAngle: 1.47,
    minAzimuth: -1.5,
    maxAzimuth: 1.2,
    targetBounds: new Box3(new Vector3(-30, -9, -30), new Vector3(140, 4, 3)),
  });
  cam.reducedMotion = reducedMotion || o.capture;
  const labels = new LabelLayer(camera, o.noGo);
  const hud = o.perf ? new PerfHud(document.body) : null;

  function applyState(flyCamera: boolean) {
    const state = labState(setup, frequency);
    setups.steel.visible = setup === 'steel';
    setups.tracer.visible = setup === 'tracer';
    fx.setState(state);
    shared.screen.draw(frequencyLabel(frequency), `${Math.round(state.transmitter.ma)} mA`);
    labels.setLabels(labelsFor(o.labelElements, setup));
    renderer.shadowMap.needsUpdate = true;
    labelsDirty = true;
    if (flyCamera) void cam.goTo(VIEWS[setup]);
    stage.requestFrame();
  }

  async function buildPost(): Promise<Post> {
    post?.dispose();
    const next = await createPost(renderer, scene, fxScene, camera, settings(), depthUniforms);
    next.setSize(stage.width, stage.height);
    post = next;
    return next;
  }

  async function changeTier(next: Tier) {
    if (rebuilding || next === tier) return;
    tier = next;
    rebuilding = (async () => {
      lighting.setShadowQuality(settings().shadowMapSize, settings().shadowRadius);
      street.setDetail(settings().detail);
      await buildPost();
      stage.resize();
      o.onTierChange?.(tier);
      stage.requestFrame();
    })();
    await rebuilding;
    rebuilding = null;
  }

  const firstPost = await buildPost();
  stage.start();
  cam.setLayout(stage.width, stage.height, o.visibleArea());
  await cam.goTo(VIEWS[setup], false);
  applyState(false);
  // Compile shaders up front. Async needs KHR_parallel_shader_compile; three warns without it.
  if (renderer.extensions.has('KHR_parallel_shader_compile'))
    await renderer.compileAsync(scene, camera);
  else renderer.compile(scene, camera);

  if (o.capture) {
    // One settled frame, then hold still for the screenshot.
    cam.update(1);
    camera.updateMatrixWorld();
    labels.update(stage.width, stage.height);
    firstPost.render(1 / 60);
    stage.stop();
  }
  document.documentElement.dataset.sceneReady = 'true';
  window.dispatchEvent(new Event('scene:ready'));

  return {
    get tier() {
      return tier;
    },
    setState(nextSetup, nextFrequency) {
      const fly = nextSetup !== setup;
      setup = nextSetup;
      frequency = nextFrequency;
      applyState(fly);
    },
    setTheme(theme) {
      lighting.setTheme(THEMES[theme].scene);
      stage.requestFrame();
    },
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      cam.reducedMotion = reduced || o.capture;
      stage.requestFrame();
    },
    async setTier(next) {
      if (next === 'auto') {
        const gl = renderer.getContext();
        const guessed = guessTier(
          String(gl.getParameter(gl.RENDERER)),
          matchMedia('(pointer: coarse)').matches,
        );
        governor = new Governor(guessed, guessed);
        await changeTier(guessed);
      } else {
        governor = null;
        await changeTier(next);
      }
    },
    relayout() {
      labels.measure();
      cam.setLayout(stage.width, stage.height, o.visibleArea());
      labelsDirty = true;
      stage.requestFrame();
    },
    resetView() {
      void cam.goTo(VIEWS[setup]);
      stage.requestFrame();
    },
    rotate(direction) {
      cam.rotateBy(direction * 0.18, 0);
      stage.requestFrame();
    },
    tilt(direction) {
      cam.rotateBy(0, direction * 0.12);
      stage.requestFrame();
    },
    zoom(direction) {
      cam.dollyBy(direction * 10);
      stage.requestFrame();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stage.dispose();
      post?.dispose();
      cam.dispose();
      hud?.dispose();
      lighting.dispose();
      shared.screen.dispose();
      disposeObject(scene);
      disposeObject(fxScene);
    },
  };
}
