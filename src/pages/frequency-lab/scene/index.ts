/**
 * The Frequency Lab's 3D scene: the street block, both setups, the signal effects and the
 * labels, behind a small API the UI drives.
 */
import {
  Box3,
  FogExp2,
  HalfFloatType,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import { FREQUENCIES, frequencyLabel, type Frequency } from '../../../../config/equipment.ts';
import { LABEL_LIMITS, MOTION, THEMES, easeInOut, type ThemeName } from '../../../design/tokens.ts';
import { LabCamera, lerpPose, type CameraPose, type VisibleArea } from '../../../kit3d/camera.ts';
import { disposeObject } from '../../../kit3d/dispose.ts';
import { LabelLayer } from '../../../kit3d/labels.ts';
import { createLighting } from '../../../kit3d/lighting.ts';
import { PerfHud } from '../../../kit3d/perf.ts';
import { createPost, preloadPost, type Post } from '../../../kit3d/post.ts';
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
import { buildContactShadows } from './contact.ts';
import { BLOCK, MUST_SEE, WORLD_EDGE, viewFor } from './layout.ts';
import { TransmitterScreen, buildSetup, buildShared, setLineGlow } from './lines.ts';
import { SignalEffects } from './signal.ts';
import { buildStreet } from './street.ts';
import { buildNeighborhood } from './world.ts';

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
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

export interface LabScene {
  setState(setup: SetupId, frequency: Frequency): void;
  setTheme(theme: ThemeName): void;
  setReducedMotion(reduced: boolean): void;
  /** Stops the signal's motion while the reader has paused it, whatever the motion setting. */
  setPaused(paused: boolean): void;
  setTier(tier: Tier | 'auto'): Promise<void>;
  readonly tier: Tier;
  /**
   * Re-measures labels and frames the view for the room it has, e.g. after fonts load or the panel
   * changes. With `ease`, the view glides to its new framing (at once when motion is reduced).
   */
  relayout(ease?: boolean): void;
  /** Shows one label however crowded the view, while the key points at its line; null for none. */
  highlight(id: LabelId | null): void;
  /** Places labels again, now, without touching the camera: when a label gains focus or a sheet opens. */
  refreshLabels(): void;
  dispose(): void;
}

const FACE_NORMAL = new Vector3(0, 0, 1);

/** A free area part way from one to another, for a glide between framings. */
function between(a: VisibleArea, b: VisibleArea, t: number): VisibleArea {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    x: mix(a.x, b.x),
    y: mix(a.y, b.y),
    width: mix(a.width, b.width),
    height: mix(a.height, b.height),
    ...(b.portrait === undefined ? {} : { portrait: b.portrait }),
    ...(b.keepOut === undefined ? {} : { keepOut: b.keepOut }),
  };
}

/** What the transmitter's screen can show: the frequency it's set to. */
const READINGS = FREQUENCIES.map(frequencyLabel);

/** How many labels may show at once in a free area this wide: fewer on a phone, so the scene leads. */
const maxLabels = (width: number) =>
  width < LABEL_LIMITS.narrowBelow ? LABEL_LIMITS.narrow : LABEL_LIMITS.wide;

function labelsFor(elements: Map<LabelId, HTMLElement>, setup: SetupId): Label[] {
  return LABEL_SPECS.flatMap((spec) => {
    const element = elements.get(spec.id);
    if (!element) return [];
    return [
      {
        id: spec.id,
        element,
        anchor: new Vector3(...spec.anchor[setup]),
        ...(spec.point ? { point: new Vector3(...spec.point[setup]) } : {}),
        priority: spec.priority,
        hidden: spec.text[setup] === null,
        ...(spec.onFace ? { facing: FACE_NORMAL } : {}),
      },
    ];
  });
}

/** Builds the scene. If building fails, the renderer it created is released before the error is passed on. */
export async function createLabScene(o: LabSceneOptions): Promise<LabScene> {
  let stage: Stage | null = null;
  try {
    return await buildLabScene(o, (s) => {
      stage = s;
    });
  } catch (error) {
    (stage as Stage | null)?.dispose();
    throw error;
  }
}

async function buildLabScene(
  o: LabSceneOptions,
  onStage: (stage: Stage) => void,
): Promise<LabScene> {
  const scene = new Scene();
  const fxScene = new Scene();
  // Far enough that the fog, not the far plane, is what hides the distance.
  const camera = new PerspectiveCamera(34, 1, 0.5, 2400);
  const depthUniforms = createDepthUniforms();

  let tier: Tier = o.tier === 'auto' ? 'medium' : o.tier;
  let governor: Governor | null = null;
  let post: Post | null = null;
  let labelsDirty = true;
  let animTime = 1.25;
  let reducedMotion = o.reducedMotion;
  let paused = false;
  /**
   * The free area the view is framed for, and a glide under way to a new framing: the area and the
   * camera's pose both ease from where they were, so a change of view (and lens) eases too.
   */
  let shownArea: VisibleArea | null = null;
  let glide: {
    from: VisibleArea;
    to: VisibleArea;
    fromPose: CameraPose;
    toPose: CameraPose;
    start: number;
  } | null = null;
  let current: Label[] = [];
  let setup = o.setup;
  let frequency = o.frequency;
  let rebuilding = false;
  let theme = o.theme;
  /** The tier asked for most recently, which a rebuild in progress picks up when it's done. */
  let wantedTier: Tier | null = null;
  let disposed = false;

  const stage = new Stage(
    o.canvas,
    {
      frame(dt) {
        if (!post) return false;
        const animating = !reducedMotion && !paused && !o.capture;
        if (animating) {
          animTime += dt;
          fx.setTime(animTime);
        }
        if (glide) {
          const t = Math.min(1, (performance.now() - glide.start) / MOTION.panel);
          if (t < 1) showGlide(easeInOut(t));
          else {
            // Landed: frame the new area exactly.
            const to = glide.to;
            glide = null;
            frameArea(to);
          }
        }
        if (labelsDirty) {
          labels.update(stage.width, stage.height, freeArea(), maxLabels(freeArea().w));
          labelsDirty = false;
        }
        post.render(dt);
        const now = performance.now();
        hud?.frame(dt * 1000, now, stage.renderer, tier, stage.pixelRatio);
        const next = governor?.sample(dt * 1000, now);
        if (next) void changeTier(next);
        return animating || glide !== null;
      },
      resize(width, height) {
        glide = null;
        post?.setSize(width, height);
        frameArea(o.visibleArea());
      },
      contextLost() {
        o.onContextLost?.();
      },
      contextRestored() {
        // The sky and its lighting were rendered into a texture the lost context took with it.
        lighting.restore(THEMES[theme].scene);
        labelsDirty = true;
        o.onContextRestored?.();
      },
    },
    (w, h) => pixelRatioFor(tier, w, h, window.devicePixelRatio || 1),
  );
  const { renderer } = stage;
  onStage(stage);
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
  // The ambient-occlusion chunk downloads while the scene is built and compiled.
  preloadPost(settings());
  const lighting = createLighting(renderer, scene, bounds, THEMES[o.theme].scene, {
    shadow: { mapSize: settings().shadowMapSize, radius: settings().shadowRadius },
    // Well inside the camera's far plane from anywhere the camera goes.
    skyRadius: 700,
  });
  const street = buildStreet();
  street.setDetail(settings().detail);
  street.setEdge(THEMES[o.theme].scene.edge);
  const neighborhood = buildNeighborhood();
  neighborhood.setTheme(THEMES[o.theme].scene);
  const shared = buildShared(READINGS);
  const screenFonts = Promise.all(TransmitterScreen.FONTS.map((f) => document.fonts.load(f))).then(
    () => true,
    () => false,
  );
  const setups = { steel: buildSetup('steel'), plastic: buildSetup('plastic') };
  // Baked contact shadows stand in for ambient occlusion on the tier without it.
  const contact = buildContactShadows();
  contact.visible = !settings().ao;
  scene.add(street.group, neighborhood.group, shared.group, setups.steel, setups.plastic, contact);
  setLineGlow(scene, THEMES[o.theme].scene.lineGlow);
  const fx = new SignalEffects(depthUniforms);
  fx.setTime(animTime);
  fxScene.add(fx.group);

  const cam = new LabCamera(camera);
  const labels = new LabelLayer(camera, o.noGo);
  /** The part of the view the panel or sheet leaves free, as the label layer wants it. */
  const freeArea = () => {
    const v = o.visibleArea();
    return { x: v.x, y: v.y, w: v.width, h: v.height };
  };
  const hud = o.perf ? new PerfHud(document.body) : null;
  const mustSee = MUST_SEE.map((p) => new Vector3(...p));
  const worldEdge = new Vector3(...WORLD_EDGE);
  /** Frames the view for a free area of the canvas, with the view that suits it unless given. */
  function frameArea(area: VisibleArea, view = viewFor(area, stage)) {
    cam.setLayout(stage.width, stage.height, area);
    cam.frame(view);
    framed();
    shownArea = area;
    labelsDirty = true;
  }

  /** A glide part way, at `e` along its eased course. */
  function showGlide(e: number) {
    if (!glide) return;
    const area = between(glide.from, glide.to, e);
    cam.setLayout(stage.width, stage.height, area);
    cam.setPose(lerpPose(glide.fromPose, glide.toPose, e));
    framed();
    shownArea = area;
    labelsDirty = true;
  }

  /**
   * After the camera moves: the sky follows it, and the fog is set by how far the lesson reaches,
   * and so the world's far edge stays hidden.
   */
  function framed() {
    const far = Math.max(...mustSee.map((p) => p.distanceTo(camera.position)));
    lighting.setViewpoint(camera.position, far, worldEdge.distanceTo(camera.position));
    if (scene.fog instanceof FogExp2) fx.setFogDensity(scene.fog.density);
  }

  let shadowsFor: SetupId | null = null;
  let labelsFor_: SetupId | null = null;

  function applyState() {
    setups.steel.visible = setup === 'steel';
    setups.plastic.visible = setup === 'plastic';
    fx.setState(labState(setup, frequency));
    shared.screen.show(FREQUENCIES.indexOf(frequency));
    // Label text only changes with the setup, so a frequency change needn't re-measure them.
    if (labelsFor_ !== setup) {
      labelsFor_ = setup;
      current = labelsFor(o.labelElements, setup);
      labels.setLabels(current);
    }
    // Only the setup changes what casts shadows, so a frequency change leaves the shadow map be.
    if (shadowsFor !== setup) {
      shadowsFor = setup;
      renderer.shadowMap.needsUpdate = true;
    }
    labelsDirty = true;
    stage.requestFrame();
  }

  /** Builds the new post chain before retiring the old one, so no frame renders without one. */
  /** Builds a post chain for a tier. The current one keeps rendering until it's swapped in. */
  async function buildPost(forTier: Tier): Promise<Post> {
    const next = await createPost(
      renderer,
      scene,
      fxScene,
      camera,
      TIER_SETTINGS[forTier],
      depthUniforms,
    );
    next.setSize(stage.width, stage.height);
    return next;
  }

  function swapPost(next: Post) {
    const old = post;
    post = next;
    old?.dispose();
  }

  /** Rebuilds for a new tier. A tier asked for during a rebuild is applied right after it. */
  async function changeTier(next: Tier) {
    wantedTier = next;
    if (rebuilding) return;
    rebuilding = true;
    // Read through functions: other calls can change these during the await below.
    const wanted = (): Tier | null => wantedTier;
    const gone = () => disposed;
    try {
      for (let want = wanted(); want !== null && want !== tier && !gone(); want = wanted()) {
        // The tier changes only once its post chain is built, so a failed build changes nothing.
        const next = await buildPost(want);
        if (gone()) {
          next.dispose();
          break;
        }
        swapPost(next);
        tier = want;
        lighting.setShadowQuality(settings().shadowMapSize, settings().shadowRadius);
        street.setDetail(settings().detail);
        contact.visible = !settings().ao;
        stage.resize();
        governor?.settle(performance.now());
        stage.requestFrame();
      }
    } catch (error) {
      // E.g. the ambient-occlusion chunk failed to load; the current tier keeps working.
      console.error(error);
    } finally {
      rebuilding = false;
      wantedTier = null;
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
  const firstPost = await buildPost(tier);
  swapPost(firstPost);
  frameArea(o.visibleArea());
  document.documentElement.dataset.sceneStage = 'compile';
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
    labels.update(stage.width, stage.height, freeArea(), maxLabels(freeArea().w));
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
      // A setup switch swaps only what's underground; the view stays as it is.
      if (nextSetup !== setup) governor?.settle(performance.now());
      setup = nextSetup;
      frequency = nextFrequency;
      applyState();
    },
    setTheme(next) {
      theme = next;
      const tokens = THEMES[theme].scene;
      lighting.setTheme(tokens);
      // Each theme has its own share of fog; the signal fades with it.
      framed();
      setLineGlow(scene, tokens.lineGlow);
      street.setEdge(tokens.edge);
      neighborhood.setTheme(tokens);
      stage.requestFrame();
    },
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      stage.requestFrame();
    },
    setPaused(next) {
      paused = next;
      stage.requestFrame();
    },
    highlight(id) {
      for (const label of current) label.highlight = label.id === id;
      labels.update(stage.width, stage.height, freeArea(), maxLabels(freeArea().w));
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
      // Labels are HTML and the camera hasn't moved, so they're placed now, without waiting for a
      // frame: a label just focused is where it belongs before anything measures it.
      labels.update(stage.width, stage.height, freeArea(), maxLabels(freeArea().w));
    },
    relayout(ease = false) {
      labels.measure();
      const area = o.visibleArea();
      // A glide from the framing shown now, unless motion is reduced or there's nothing to glide from.
      if (ease && !reducedMotion && !o.capture && shownArea) {
        // Where it lands: the pose that frames the new area, fitted without moving the camera.
        cam.setLayout(stage.width, stage.height, area);
        const toPose = cam.poseFor(viewFor(area, stage));
        cam.setLayout(stage.width, stage.height, shownArea);
        glide = {
          from: shownArea,
          to: area,
          fromPose: cam.pose(),
          toPose,
          start: performance.now(),
        };
        stage.requestFrame();
        return;
      }
      glide = null;
      frameArea(area);
      if (o.capture) {
        // The loop has stopped, so render the new framing once for the screenshot.
        labels.update(stage.width, stage.height, freeArea(), maxLabels(freeArea().w));
        post?.render(1 / 60);
        return;
      }
      labelsDirty = true;
      stage.requestFrame();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stage.dispose();
      post?.dispose();
      hud?.dispose();
      lighting.dispose();
      shared.screen.dispose();
      disposeObject(scene);
      disposeObject(fxScene);
    },
  };
}
