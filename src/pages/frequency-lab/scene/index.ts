/**
 * The Frequency Lab's 3D scene: the street block, both setups, the signal effects and the
 * labels, behind a small API the UI drives. The block is built for the view the screen asks for,
 * its ground drawn deeper in the tall view, and built again when the screen turns.
 */
import { Box3, PerspectiveCamera, Scene, Vector3, type Group } from 'three';
import { FREQUENCIES, frequencyLabel, type Frequency } from '../../../../config/equipment.ts';
import {
  LABEL_LIMITS,
  MOTION,
  easeInOut,
  labSceneTokens,
  type ThemeName,
} from '../../../design/tokens.ts';
import {
  LabCamera,
  areaBetween,
  lerpPose,
  type CameraPose,
  type VisibleArea,
} from '../../../kit3d/camera.ts';
import { disposeObject } from '../../../kit3d/dispose.ts';
import { LabelLayer } from '../../../kit3d/labels.ts';
import { createLighting } from '../../../kit3d/lighting.ts';
import { createPost, preloadPost } from '../../../kit3d/post.ts';
import type { Tier } from '../../../kit3d/quality.ts';
import { SceneRuntime } from '../../../kit3d/runtime.ts';
import { createDepthUniforms } from '../../../kit3d/signal-pass.ts';
import { labState, type SetupId } from '../../../signal/model.ts';
import type { Label } from '../../../kit3d/labels.ts';
import { LABEL_SPECS, labelPlaces, type LabelId } from './labels.ts';
import { buildContactShadows } from './contact.ts';
import { layoutFor, viewKind, viewOf, type LabLayout, type ViewKind } from './layout.ts';
import {
  TransmitterScreen,
  buildSetup,
  buildShared,
  setLineGlow,
  type SharedLines,
} from './lines.ts';
import { SignalEffects } from './signal.ts';
import { buildStreet, type Street } from './street.ts';
import { buildScenery, type Scenery } from './world.ts';

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
  /** Told which view the block is built for: from in front, or at three-quarters, deeper. */
  onView?: (kind: ViewKind) => void;
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

/** What the transmitter's screen can show: the frequency it's set to. */
const READINGS = FREQUENCIES.map(frequencyLabel);

/** How many labels may show at once in a free area this wide: fewer on a phone, so the scene leads. */
const maxLabels = (width: number) =>
  width < LABEL_LIMITS.narrowBelow ? LABEL_LIMITS.narrow : LABEL_LIMITS.wide;

/** What's built for one view: the block at the depth that view draws it, and all on and in it. */
interface Built {
  kind: ViewKind;
  layout: LabLayout;
  street: Street;
  scenery: Scenery;
  shared: SharedLines;
  setups: Record<SetupId, Group>;
  contact: Group;
  fx: SignalEffects;
}

/** Everything a build puts in the main scene. */
const sceneParts = (b: Built): Group[] => [
  b.street.group,
  b.scenery.group,
  b.shared.group,
  b.setups.steel,
  b.setups.plastic,
  b.contact,
];

function labelsFor(
  layout: LabLayout,
  elements: Map<LabelId, HTMLElement>,
  setup: SetupId,
): Label[] {
  const places = labelPlaces(layout);
  return LABEL_SPECS.flatMap((spec) => {
    const element = elements.get(spec.id);
    if (!element) return [];
    const place = places[spec.id];
    return [
      {
        id: spec.id,
        element,
        anchor: new Vector3(...place.anchor[setup]),
        ...(place.point ? { point: new Vector3(...place.point[setup]) } : {}),
        priority: spec.priority,
        hidden: spec.text[setup] === null,
        ...(spec.below ? { below: true } : {}),
        ...(spec.onFace ? { facing: FACE_NORMAL } : {}),
      },
    ];
  });
}

/** Builds the scene. If building fails, the renderer it created is released before the error is passed on. */
export async function createLabScene(o: LabSceneOptions): Promise<LabScene> {
  let runtime: SceneRuntime | null = null;
  try {
    return await buildLabScene(o, (r) => {
      runtime = r;
    });
  } catch (error) {
    (runtime as SceneRuntime | null)?.dispose();
    throw error;
  }
}

async function buildLabScene(
  o: LabSceneOptions,
  onRuntime: (runtime: SceneRuntime) => void,
): Promise<LabScene> {
  const scene = new Scene();
  const fxScene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.5, 2400);
  const depthUniforms = createDepthUniforms();

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
  let theme = o.theme;
  let disposed = false;
  /** Builds for a view the screen has turned from: kept until the new build has drawn. */
  const stale: Built[] = [];
  let staleFrames = 0;

  const runtime: SceneRuntime = new SceneRuntime(
    {
      canvas: o.canvas,
      tier: o.tier,
      capture: o.capture,
      perf: o.perf,
      camera,
      post: (tierSettings) =>
        createPost(runtime.renderer, scene, camera, tierSettings, {
          signal: { scene: fxScene, depth: depthUniforms },
        }),
    },
    {
      frame(dt) {
        const animating = !reducedMotion && !paused && !o.capture;
        if (animating) {
          animTime += dt;
          built.fx.setTime(animTime);
        }
        // An old build goes once the new one has drawn, so the shaders they share stay compiled.
        if (stale.length > 0 && --staleFrames <= 0) for (const b of stale.splice(0)) release(b);
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
        return animating || glide !== null || stale.length > 0;
      },
      resize() {
        glide = null;
        frameArea(o.visibleArea());
      },
      tierChanged(tierSettings) {
        lighting.setShadowQuality(tierSettings.shadowMapSize, tierSettings.shadowRadius);
        built.street.setDetail(tierSettings.detail);
        built.contact.visible = !tierSettings.ao;
      },
      contextLost() {
        o.onContextLost?.();
      },
      contextRestored() {
        // The sky and its lighting were rendered into a texture the lost context took with it.
        lighting.restore(labSceneTokens(theme));
        labelsDirty = true;
        o.onContextRestored?.();
      },
    },
  );
  onRuntime(runtime);
  const { stage, renderer } = runtime;

  // Everything that casts a shadow, in either view: the slab at its deepest, and the trees and
  // lamps on it.
  const deepest = layoutFor('tall').block;
  const bounds = new Box3(
    new Vector3(deepest.x0, deepest.bottom, deepest.z0),
    new Vector3(deepest.x1, 15, deepest.z1),
  );
  const settings = () => runtime.settings;
  // The ambient-occlusion chunk downloads while the scene is built and compiled.
  preloadPost(settings());
  const lighting = createLighting(renderer, scene, bounds, labSceneTokens(o.theme), {
    shadow: { mapSize: settings().shadowMapSize, radius: settings().shadowRadius },
  });
  const screenFonts = Promise.all(TransmitterScreen.FONTS.map((f) => document.fonts.load(f))).then(
    () => true,
    () => false,
  );

  /** Builds the block for a view, in the scenes. */
  function build(kind: ViewKind): Built {
    const layout = layoutFor(kind);
    const street = buildStreet(layout);
    street.setDetail(settings().detail);
    const scenery = buildScenery(layout);
    scenery.setTheme(labSceneTokens(theme));
    const b: Built = {
      kind,
      layout,
      street,
      scenery,
      shared: buildShared(layout, READINGS),
      setups: { steel: buildSetup(layout, 'steel'), plastic: buildSetup(layout, 'plastic') },
      // Baked contact shadows stand in for ambient occlusion on the tier without it.
      contact: buildContactShadows(layout),
      fx: new SignalEffects(depthUniforms, layout),
    };
    b.contact.visible = !settings().ao;
    b.fx.setTime(animTime);
    scene.add(...sceneParts(b));
    fxScene.add(b.fx.group);
    setLineGlow(scene, labSceneTokens(theme).lineGlow);
    return b;
  }

  /** Lets a build go: out of the scenes, and its GPU resources freed. */
  function release(b: Built) {
    scene.remove(...sceneParts(b));
    fxScene.remove(b.fx.group);
    b.shared.screen.dispose();
    for (const part of [...sceneParts(b), b.fx.group]) disposeObject(part);
  }

  let built = build(viewKind(o.visibleArea(), stage));
  o.onView?.(built.kind);

  /**
   * Builds the block for the view the screen now asks for, with the labels placed on it and the
   * shadows drawn again. The old build stays, out of sight, until the new one has drawn.
   */
  function rebuild(kind: ViewKind) {
    const old = built;
    scene.remove(...sceneParts(old));
    fxScene.remove(old.fx.group);
    stale.push(old);
    staleFrames = 2;
    built = build(kind);
    o.onView?.(kind);
    labelsFor_ = null;
    shadowsFor = null;
    applyState();
  }

  const cam = new LabCamera(camera);
  const labels = new LabelLayer(camera, o.noGo);
  /** The part of the view the panel or sheet leaves free, as the label layer wants it. */
  const freeArea = () => {
    const v = o.visibleArea();
    return { x: v.x, y: v.y, w: v.width, h: v.height };
  };
  /** Frames the view for a free area of the canvas, with the block built for the view that suits it. */
  function frameArea(area: VisibleArea) {
    const kind = viewKind(area, stage);
    if (kind !== built.kind) rebuild(kind);
    cam.setLayout(stage.width, stage.height, area);
    cam.frame(viewOf(built.layout, kind));
    shownArea = area;
    labelsDirty = true;
  }

  /** A glide part way, at `e` along its eased course. */
  function showGlide(e: number) {
    if (!glide) return;
    const area = areaBetween(glide.from, glide.to, e);
    cam.setLayout(stage.width, stage.height, area);
    cam.setPose(lerpPose(glide.fromPose, glide.toPose, e));
    shownArea = area;
    labelsDirty = true;
  }

  let shadowsFor: SetupId | null = null;
  let labelsFor_: SetupId | null = null;

  function applyState() {
    built.setups.steel.visible = setup === 'steel';
    built.setups.plastic.visible = setup === 'plastic';
    built.fx.setState(labState(setup, frequency));
    built.shared.screen.show(FREQUENCIES.indexOf(frequency));
    // Label text only changes with the setup, so a frequency change needn't re-measure them.
    if (labelsFor_ !== setup) {
      labelsFor_ = setup;
      current = labelsFor(built.layout, o.labelElements, setup);
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

  /**
   * Compiles every setup's shaders, effects included, so switching setups never stalls or blanks
   * the view.
   */
  async function precompile() {
    built.setups.steel.visible = true;
    built.setups.plastic.visible = true;
    built.fx.showAll();
    await runtime.compile([scene, fxScene]);
  }

  // Everything is built and compiled before the loop starts, so the first frame is the real one.
  await runtime.init();
  frameArea(o.visibleArea());
  document.documentElement.dataset.sceneStage = 'compile';
  await precompile();
  // The screen draws with its own font from the first frame. If the font is slow, it shows a
  // fallback and redraws when the font arrives.
  const timeout = new Promise<boolean>((resolve) => setTimeout(resolve, 2000, false));
  if (await Promise.race([screenFonts, timeout])) {
    built.shared.screen.draw();
  } else {
    void screenFonts.then((loaded) => {
      if (!loaded || disposed) return;
      built.shared.screen.draw();
      stage.requestFrame();
    });
  }
  applyState();
  // In capture mode, one settled frame, labels placed, then still for the screenshot.
  runtime.start(() => {
    labels.update(stage.width, stage.height, freeArea(), maxLabels(freeArea().w));
  });

  return {
    get tier() {
      return runtime.tier;
    },
    setState(nextSetup, nextFrequency) {
      // A setup switch swaps only what's underground; the view stays as it is.
      if (nextSetup !== setup) runtime.settle();
      setup = nextSetup;
      frequency = nextFrequency;
      applyState();
    },
    setTheme(next) {
      theme = next;
      const tokens = labSceneTokens(theme);
      lighting.setTheme(tokens);
      setLineGlow(scene, tokens.lineGlow);
      built.scenery.setTheme(tokens);
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
    setTier(next) {
      return runtime.setTier(next);
    },
    refreshLabels() {
      // Labels are HTML and the camera hasn't moved, so they're placed now, without waiting for a
      // frame: a label just focused is where it belongs before anything measures it.
      labels.update(stage.width, stage.height, freeArea(), maxLabels(freeArea().w));
    },
    relayout(ease = false) {
      labels.measure();
      const area = o.visibleArea();
      // A glide from the framing shown now, unless motion is reduced, there's nothing to glide
      // from, or the new room asks for the other view, whose block is built anew.
      const kind = viewKind(area, stage);
      if (ease && !reducedMotion && !o.capture && shownArea && kind === built.kind) {
        // Where it lands: the pose that frames the new area, fitted without moving the camera.
        cam.setLayout(stage.width, stage.height, area);
        const toPose = cam.poseFor(viewOf(built.layout, kind));
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
        runtime.renderOnce();
        return;
      }
      labelsDirty = true;
      stage.requestFrame();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      runtime.dispose();
      lighting.dispose();
      for (const b of stale.splice(0)) release(b);
      built.shared.screen.dispose();
      disposeObject(scene);
      disposeObject(fxScene);
    },
  };
}
