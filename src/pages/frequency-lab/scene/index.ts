/**
 * The Frequency Lab's 3D scene: the street block, both setups, the signal effects and the
 * labels, behind a small API the UI drives.
 */
import { Box3, HalfFloatType, PerspectiveCamera, Scene, Vector3, WebGLRenderTarget } from 'three';
import { FREQUENCIES, frequencyLabel, type Frequency } from '../../../../config/equipment.ts';
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
import { SETUPS, labState, transmitterReading, type SetupId } from '../../../signal/model.ts';
import type { Label } from '../../../kit3d/labels.ts';
import { LABEL_SPECS, type LabelId } from './labels.ts';
import { BLOCK, VIEWS } from './layout.ts';
import { TransmitterScreen, buildSetup, buildShared, type ScreenReading } from './lines.ts';
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
  /** Re-places labels without touching the camera, e.g. when a label gains focus or a sheet opens. */
  refreshLabels(): void;
  resetView(): void;
  rotate(direction: -1 | 1): void;
  tilt(direction: -1 | 1): void;
  zoom(direction: -1 | 1): void;
  dispose(): void;
}

const FACE_NORMAL = new Vector3(0, 0, 1);

/** Every reading the transmitter's screen can show, one per setup and frequency. */
const READINGS: ScreenReading[] = SETUPS.flatMap((s) =>
  FREQUENCIES.map((f) => ({
    frequency: frequencyLabel(f),
    current: `${String(Math.round(transmitterReading(s, f).ma))} mA`,
  })),
);
const readingIndex = (s: SetupId, f: Frequency) =>
  SETUPS.indexOf(s) * FREQUENCIES.length + FREQUENCIES.indexOf(f);

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
          labels.update(stage.width, stage.height, freeArea());
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
  const shared = buildShared(READINGS);
  const screenFonts = Promise.all(TransmitterScreen.FONTS.map((f) => document.fonts.load(f))).then(
    () => true,
    () => false,
  );
  const setups = { steel: buildSetup('steel'), plastic: buildSetup('plastic') };
  scene.add(street.group, shared.group, setups.steel, setups.plastic);
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
  /** The part of the view the panel or sheet leaves free, as the label layer wants it. */
  const freeArea = () => {
    const v = o.visibleArea();
    return { x: v.x, y: v.y, w: v.width, h: v.height };
  };
  const hud = o.perf ? new PerfHud(document.body) : null;

  let shadowsFor: SetupId | null = null;

  function applyState() {
    setups.steel.visible = setup === 'steel';
    setups.plastic.visible = setup === 'plastic';
    fx.setState(labState(setup, frequency));
    shared.screen.show(readingIndex(setup, frequency));
    labels.setLabels(labelsFor(o.labelElements, setup));
    // Only the setup changes what casts shadows, so a frequency change leaves the shadow map be.
    if (shadowsFor !== setup) {
      shadowsFor = setup;
      renderer.shadowMap.needsUpdate = true;
    }
    labelsDirty = true;
    stage.requestFrame();
  }

  /** Builds the new post chain before retiring the old one, so no frame renders without one. */
  async function buildPost(): Promise<Post> {
    const next = await createPost(renderer, scene, fxScene, camera, settings(), depthUniforms);
    next.setSize(stage.width, stage.height);
    const old = post;
    post = next;
    old?.dispose();
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
      governor?.settle(performance.now());
      o.onTierChange?.(tier);
      stage.requestFrame();
    })();
    try {
      await rebuilding;
    } finally {
      rebuilding = null;
    }
  }

  /**
   * Compiles every setup's shaders, effects included, so switching setups never stalls or blanks
   * the view. three keys programs on the render target, so this compiles against an offscreen
   * target like the post chain's, not the canvas. Async needs KHR_parallel_shader_compile; three
   * warns without it.
   */
  async function precompile() {
    setups.steel.visible = true;
    setups.plastic.visible = true;
    fx.showAll();
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
    renderer.setRenderTarget(target);
    // compileAsync starts compiling before it returns, so the target only needs binding until then.
    let ready: Promise<unknown> | null = null;
    if (renderer.extensions.has('KHR_parallel_shader_compile')) {
      ready = Promise.all([
        renderer.compileAsync(scene, camera),
        renderer.compileAsync(fxScene, camera),
      ]);
    } else {
      renderer.compile(scene, camera);
      renderer.compile(fxScene, camera);
    }
    renderer.setRenderTarget(null);
    target.dispose();
    await ready;
  }

  // Everything is built and compiled before the loop starts, so the first frame is the real one.
  stage.resize();
  const firstPost = await buildPost();
  await cam.goTo(VIEWS[setup], false);
  await precompile();
  // The screen draws with its own font from the first frame. If the font is slow, it shows a
  // fallback and redraws when the font arrives.
  const timeout = new Promise<boolean>((resolve) => setTimeout(resolve, 2000, false));
  if (await Promise.race([screenFonts, timeout])) {
    shared.screen.draw();
  } else {
    void screenFonts.then((loaded) => {
      if (!loaded || disposed) return;
      shared.screen.draw();
      stage.requestFrame();
    });
  }
  applyState();
  stage.start();

  if (o.capture) {
    // One settled frame, then hold still for the screenshot.
    cam.update(1);
    camera.updateMatrixWorld();
    labels.update(stage.width, stage.height, freeArea());
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
      // A setup switch swaps what's underground; the view stays where the learner left it.
      if (nextSetup !== setup) governor?.settle(performance.now());
      setup = nextSetup;
      frequency = nextFrequency;
      applyState();
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
    refreshLabels() {
      labelsDirty = true;
      stage.requestFrame();
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
