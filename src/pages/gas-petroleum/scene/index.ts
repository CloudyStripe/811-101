/**
 * The Gas & Petroleum diorama's 3D scene: the block and its thirteen stops, the routes and what
 * flows along them, the formation time-lapse, the labels, and a camera that frames the overview
 * or a stop in the room the panel leaves, behind a small API the UI drives.
 *
 * The overview stays alive while motion is on: beads flow along the routes and the machines run.
 * At a stop, its path's flow and its own machines lead, and the rest calm down. Pausing motion, or
 * reduced motion, stills all of it, and the loop sleeps.
 */
import { Box3, PerspectiveCamera, Ray, Scene, Vector2, Vector3 } from 'three';
import { STOPS, type StopId } from '../../../../content/utilities/gas-petroleum.ts';
import type { PathId } from '../../../design/paths.ts';
import { LABEL_LIMITS, MOTION, THEMES, easeInOut, type ThemeName } from '../../../design/tokens.ts';
import {
  LabCamera,
  areaBetween,
  lerpPose,
  type CameraPose,
  type VisibleArea,
} from '../../../kit3d/camera.ts';
import { disposeObject } from '../../../kit3d/dispose.ts';
import { LabelLayer, type Label } from '../../../kit3d/labels.ts';
import { createLighting } from '../../../kit3d/lighting.ts';
import { createPost, preloadPost } from '../../../kit3d/post.ts';
import type { Tier } from '../../../kit3d/quality.ts';
import { SceneRuntime } from '../../../kit3d/runtime.ts';
import { clockText } from '../summary.ts';
import { padsOn, setDimColor } from './build.ts';
import { DetailLayer, type Rect } from './details.ts';
import { buildGround } from './ground.ts';
import { MODEL_BOX } from './layout.ts';
import { buildRoutes } from './routes.ts';
import { TURN_LIMIT, clampYaw, overviewPoints, overviewView, stopView } from './shots.ts';
import { buildStops } from './stops/index.ts';
import { CLOCK_AT, type TimeLapse, type TimeLapseState } from './timelapse.ts';

export type { Rect };
export type Filter = PathId | 'both';

export interface DioramaSceneOptions {
  canvas: HTMLCanvasElement;
  /** Each stop's 3D label, a button the UI renders. */
  labelElements: Map<StopId, HTMLElement>;
  /** Where the small labels on a stop's parts go. */
  detailLayer: HTMLElement;
  tier: Tier | 'auto';
  theme: ThemeName;
  reducedMotion: boolean;
  capture: boolean;
  perf: boolean;
  /** The part of the canvas the panel and controls leave free, in CSS pixels. */
  visibleArea: () => VisibleArea;
  /** Rectangles labels must avoid, in the canvas's CSS pixels. */
  noGo: () => Rect[];
  /** Told as the time-lapse plays: its clock, caption and progress. */
  onTimeLapse?: (state: TimeLapseState) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

export interface DioramaScene {
  /** Opens a stop, or the overview for null. The view flies there, unless `fly` is false. */
  show(stop: StopId | null, options?: { fly?: boolean }): void;
  /** Fades back the path not chosen; 'both' shows both. The open stop never fades. */
  setFilter(filter: Filter): void;
  setTheme(theme: ThemeName): void;
  setReducedMotion(reduced: boolean): void;
  /**
   * Stills every motion while the reader has paused it, whatever the motion setting, but for a
   * time-lapse they ask for while paused, until they pause or play again.
   */
  setPaused(paused: boolean): void;
  setTier(tier: Tier | 'auto'): Promise<void>;
  /** Turns the overview about its middle by `yaw` radians, within its bounds. Not at a stop. */
  turn(yaw: number, options?: { ease?: boolean }): void;
  /** Back to the overview's own framing. */
  resetTurn(): void;
  /** How far the overview is turned: -1 as far left as it goes, 1 as far right. */
  readonly turned: number;
  /** The stop under a point of the canvas, in CSS pixels, or null. */
  pick(x: number, y: number): StopId | null;
  /** The stops whose labels show, besides the open one's; the rest show while focused. */
  nameLabels(stops: readonly StopId[]): void;
  /**
   * On arrival, the establishing move: in from farther out to the overview, unless motion is
   * reduced. Any input lands it (see `land`).
   */
  establish(): void;
  /** Lands a camera move under way at once. */
  land(): void;
  playTimeLapse(): void;
  /** Holds the time-lapse still at a step of its story, one per caption; the last is today. */
  stepTimeLapse(step: number): void;
  /** Frames the view again for the room it has; with `ease`, it glides there. */
  relayout(ease?: boolean): void;
  /** Places labels again, now: when a label gains focus. */
  refreshLabels(): void;
  dispose(): void;
}

const maxLabels = (width: number) =>
  width < LABEL_LIMITS.narrowBelow ? LABEL_LIMITS.narrow : LABEL_LIMITS.wide;

/** Builds the scene. If building fails, the renderer it made is released before the error. */
export async function createDioramaScene(o: DioramaSceneOptions): Promise<DioramaScene> {
  let runtime: SceneRuntime | null = null;
  try {
    return await buildDiorama(o, (r) => {
      runtime = r;
    });
  } catch (error) {
    (runtime as SceneRuntime | null)?.dispose();
    throw error;
  }
}

async function buildDiorama(
  o: DioramaSceneOptions,
  onRuntime: (runtime: SceneRuntime) => void,
): Promise<DioramaScene> {
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.5, 3000);
  let theme = o.theme;
  let reducedMotion = o.reducedMotion;
  let paused = false;
  /** A time-lapse asked for while paused plays through the pause, until the pause is changed. */
  let lapseThroughPause = false;
  let disposed = false;
  let labelsDirty = true;
  /** Seconds of motion so far: the clock every machine and bead runs on. */
  let time = 3;
  let shown: StopId | null = null;
  /** The stops whose labels the story names, besides the open one's. */
  let named: ReadonlySet<string> = new Set();
  let filter: Filter = 'both';
  /** How far the overview is turned about its middle, in radians. */
  let yaw = 0;
  /**
   * A camera move under way: a flight to a stop, a turn, or a glide to new room. The free area
   * eases along with the pose, so the view never jumps to its new room.
   */
  let flight: {
    from: CameraPose;
    to: CameraPose;
    fromArea: VisibleArea;
    toArea: VisibleArea;
    start: number;
    duration: number;
    /** How high the flight arcs on its way. */
    lift: number;
  } | null = null;
  /** The free area the view is framed for now. */
  let shownArea: VisibleArea | null = null;
  const timeLapse: { current: TimeLapse | null } = { current: null };

  const runtime: SceneRuntime = new SceneRuntime(
    {
      canvas: o.canvas,
      tier: o.tier,
      capture: o.capture,
      perf: o.perf,
      camera,
      // Ambient occlusion in the model's own units: smaller than the lab's feet.
      post: (tierSettings) =>
        createPost(runtime.renderer, scene, camera, tierSettings, {
          ao: { radius: 0.9, falloff: 0.9, intensity: 2 },
        }),
    },
    {
      frame: step,
      resize() {
        flight = null;
        frameNow();
      },
      tierChanged(tierSettings) {
        lighting.setShadowQuality(tierSettings.shadowMapSize, tierSettings.shadowRadius);
      },
      contextLost() {
        o.onContextLost?.();
      },
      contextRestored() {
        lighting.restore(THEMES[theme].scene);
        labelsDirty = true;
        o.onContextRestored?.();
      },
    },
  );
  onRuntime(runtime);
  const { renderer } = runtime;

  const bounds = new Box3(new Vector3(...MODEL_BOX.min), new Vector3(...MODEL_BOX.max));
  preloadPost(runtime.settings);
  const lighting = createLighting(renderer, scene, bounds, THEMES[o.theme].scene, {
    shadow: { mapSize: runtime.settings.shadowMapSize, radius: runtime.settings.shadowRadius },
  });
  const models = buildStops(timeLapse);
  const ground = buildGround(models.flatMap((m) => padsOn(m.root)));
  const routes = buildRoutes();
  for (const m of models) m.setLamps?.(THEMES[o.theme].scene.lamps);
  const stops = models.map((model) => ({
    id: model.id,
    model,
    path: STOPS.find((s) => s.id === model.id)?.path ?? 'shared',
    animate: model.animate?.bind(model),
    pops: model.pops,
    /** Its small labels ride on moving parts, so they're placed every frame it's open. */
    follows: model.details.some((d) => d.follow),
  }));
  const open = new Map<StopId, number>();
  const dims = new Map<StopId, number>();
  const pathDims: Record<'gas' | 'gasoline', number> = { gas: 0, gasoline: 0 };
  scene.add(ground.group, routes.group, ...models.map((m) => m.root));
  for (const m of models) for (const pop of m.pops) pop.visible = false;
  applyFade();
  timeLapse.current?.onChange((state) => {
    details.setClock(clockShown() ? clockText(state.ma) : null);
    labelsDirty = true;
    o.onTimeLapse?.(state);
  });

  const cam = new LabCamera(camera);
  const labels = new LabelLayer(camera, o.noGo);
  const details = new DetailLayer(o.detailLayer, models, CLOCK_AT);
  const labelList: Label[] = models.flatMap((m) => {
    const element = o.labelElements.get(m.id);
    if (!element) return [];
    return [
      {
        id: m.id,
        element,
        anchor: new Vector3(...m.label.at),
        priority: 1,
        ...(m.label.facing ? { facing: new Vector3(...m.label.facing) } : {}),
      },
    ];
  });
  labels.setLabels(labelList);

  /**
   * One frame of everything that moves or eases: the machines and the flow, stops opening, paths
   * fading, and the camera. Returns whether anything still moves. In capture mode it's run once
   * per change, with every ease landed at once.
   */
  function step(dt: number): boolean {
    const moving = !reducedMotion && !paused && !o.capture;
    const motionDt = moving ? dt : 0;
    const instant = reducedMotion || o.capture;
    time += motionDt;
    // The time-lapse plays on request, even with motion reduced or paused; pausing it holds it.
    const lapse = timeLapse.current;
    const lapsing = lapse?.playing === true && (!paused || lapseThroughPause) && !o.capture;
    let easing = false;
    for (const stop of stops) {
      const want = shown === stop.id ? 1 : 0;
      const was = open.get(stop.id) ?? 0;
      // Exhibits grow in and out quickly, or at once.
      const now = instant ? want : was + (want - was) * Math.min(1, dt * 5);
      const k = Math.abs(want - now) < 0.003 ? want : now;
      open.set(stop.id, k);
      if (k !== want) easing = true;
      for (const pop of stop.pops) {
        pop.visible = k > 0.01;
        pop.scale.setScalar(Math.max(0.001, easeInOut(k)));
      }
      stop.animate?.({ time, dt: stop.id === 'formation' && lapsing ? dt : motionDt, open: k });
    }
    routes.update(motionDt, pace());
    for (const stop of stops) {
      const want = dimmed(stop.path) && shown !== stop.id ? 1 : 0;
      const was = dims.get(stop.id) ?? 0;
      const k = instant ? want : was + (want - was) * Math.min(1, dt * 6);
      const settled = Math.abs(want - k) < 0.01 ? want : k;
      if (settled !== was) {
        dims.set(stop.id, settled);
        stop.model.finishes.setDim(settled);
        easing ||= settled !== want;
      }
    }
    for (const path of ['gas', 'gasoline'] as const) {
      const want = dimmed(path) ? 1 : 0;
      const was = pathDims[path];
      const k = instant ? want : was + (want - was) * Math.min(1, dt * 6);
      const settled = Math.abs(want - k) < 0.01 ? want : k;
      if (settled !== was) {
        pathDims[path] = settled;
        routes.setDim(path, settled);
        easing ||= settled !== want;
      }
    }
    if (flight) {
      const t = Math.min(1, (performance.now() - flight.start) / flight.duration);
      const e = easeInOut(t);
      shownArea = areaBetween(flight.fromArea, flight.toArea, e);
      cam.setLayout(runtime.stage.width, runtime.stage.height, shownArea);
      const pose = lerpPose(flight.from, flight.to, e);
      pose.position.y += Math.sin(Math.PI * e) * flight.lift;
      cam.setPose(pose);
      if (t >= 1) flight = null;
      labelsDirty = true;
    }
    const following = moving && stops.some((s) => s.id === shown && s.follows);
    if (labelsDirty || lapsing || following) {
      placeLabels();
      labelsDirty = false;
    }
    return moving || lapsing || easing || flight !== null;
  }

  /** In capture mode, a draw already asked for in this turn of the event loop. */
  let drawPending = false;

  /**
   * Asks for a frame. In capture mode the loop has stopped, so what changed is settled and drawn
   * once, after the rest of this turn's changes (a stop and its path, say).
   */
  function redraw() {
    if (!o.capture) {
      runtime.requestFrame();
      return;
    }
    if (drawPending) return;
    drawPending = true;
    queueMicrotask(() => {
      drawPending = false;
      if (disposed) return;
      step(0);
      runtime.renderOnce();
    });
  }

  /** Whether a path is faded back by the filter. */
  function dimmed(path: PathId): boolean {
    return path !== 'shared' && filter !== 'both' && path !== filter;
  }

  /** How fast each path's flow runs: gently everywhere, and fully on the open stop's path. */
  function pace(): Record<PathId, number> {
    const path = shown ? (stops.find((s) => s.id === shown)?.path ?? 'shared') : null;
    if (!path) return { shared: 0.6, gas: 0.6, gasoline: 0.6 };
    if (path === 'shared') return { shared: 1, gas: 0.45, gasoline: 0.45 };
    return { shared: 0.35, gas: path === 'gas' ? 1 : 0.3, gasoline: path === 'gasoline' ? 1 : 0.3 };
  }

  /** The quiet gray faded stops and routes lean toward, for the theme. */
  function applyFade() {
    const tokens = THEMES[theme].scene;
    setDimColor(tokens.fade);
    routes.setDimColor(tokens.fade);
  }

  const overviewMustSee = overviewPoints(models);
  const currentView = () => {
    const model = shown ? models.find((m) => m.id === shown) : undefined;
    return model ? stopView(model) : overviewView(overviewMustSee, yaw);
  };

  /** The room the view has now, and the pose that frames the current view in it. */
  function target(): { area: VisibleArea; pose: CameraPose } {
    const area = o.visibleArea();
    cam.setLayout(runtime.stage.width, runtime.stage.height, area);
    return { area, pose: cam.poseFor(currentView()) };
  }

  /** Frames the current view at once. */
  function frameNow() {
    const { area, pose } = target();
    shownArea = area;
    cam.setPose(pose);
    labelsDirty = true;
  }

  /** Camera moves are cuts with motion reduced, and in capture mode. */
  const instantMoves = () => reducedMotion || o.capture;

  /**
   * Moves the camera to frame the current view in the room it has: a flight over `duration` ms
   * (by default, longer for farther), arcing up on the way if `arc`, or a cut with motion reduced.
   */
  function moveTo({ duration, arc = false }: { duration?: number; arc?: boolean } = {}) {
    const from = cam.pose();
    const fromArea = shownArea;
    const { area, pose: to } = target();
    const distance = from.position.distanceTo(to.position);
    const ms = duration ?? flightTime(distance);
    if (instantMoves() || ms <= 0 || !fromArea) {
      flight = null;
      shownArea = area;
      cam.setPose(to);
      labelsDirty = true;
      redraw();
      return;
    }
    // Until the flight's first frame, the view stays framed as it is.
    cam.setLayout(runtime.stage.width, runtime.stage.height, fromArea);
    flight = {
      from,
      to,
      fromArea,
      toArea: area,
      start: performance.now(),
      duration: ms,
      lift: arc ? Math.min(22, distance * 0.22) : 0,
    };
    runtime.requestFrame();
  }

  /** A flight's length: longer for farther, within the motion tokens' range. */
  function flightTime(distance: number): number {
    const [short, long] = MOTION.flight;
    return short + (long - short) * Math.min(1, distance / 140);
  }

  /** The time-lapse's clock shows while it plays, and while it's held at a step before today. */
  function clockShown(): boolean {
    const state = timeLapse.current?.state;
    return state !== undefined && (state.playing || state.progress < 1);
  }

  function placeLabels() {
    const area = shownArea ?? o.visibleArea();
    const free = { x: area.x, y: area.y, w: area.width, h: area.height };
    // The open stop's label, then those the story names (where it goes next, or in the overview,
    // its landmarks), but not on a path faded back; the rest are quiet, shown only while focused.
    for (const label of labelList) {
      const stop = stops.find((s) => s.id === label.id);
      const faded = stop !== undefined && dimmed(stop.path) && label.id !== shown;
      label.priority = label.id === shown ? 10 : 5;
      label.highlight = label.id === shown;
      label.quiet = label.id !== shown && (faded || !named.has(label.id));
    }
    labels.update(runtime.stage.width, runtime.stage.height, free, maxLabels(area.width));
    details.update(
      camera,
      runtime.stage.width,
      runtime.stage.height,
      shown,
      o.noGo(),
      clockShown(),
    );
  }

  // Built: the first framing, compiled, then the loop.
  await runtime.init();
  frameNow();
  document.documentElement.dataset.sceneStage = 'compile';
  for (const m of models) for (const pop of m.pops) pop.visible = true;
  await runtime.compile([scene]);
  for (const m of models) for (const pop of m.pops) pop.visible = false;
  renderer.shadowMap.needsUpdate = true;
  runtime.start(() => {
    step(0);
  });

  const ray = new Ray();
  const hitPoint = new Vector3();
  const ndc = new Vector2();
  const box = new Box3();

  return {
    get turned() {
      return yaw / TURN_LIMIT;
    },
    show(stop, options = {}) {
      // Leaving the formation, a time-lapse held at a step goes back to today.
      const lapse = timeLapse.current;
      if (stop !== 'formation' && lapse && !lapse.playing && lapse.state.progress < 1) {
        lapse.reset();
      }
      shown = stop;
      if (stop !== null) yaw = 0;
      labelsDirty = true;
      moveTo(options.fly === false ? { duration: 0 } : { arc: true });
    },
    setFilter(next) {
      filter = next;
      labelsDirty = true;
      redraw();
    },
    setTheme(next) {
      theme = next;
      const tokens = THEMES[theme].scene;
      lighting.setTheme(tokens);
      for (const m of models) m.setLamps?.(tokens.lamps);
      applyFade();
      renderer.shadowMap.needsUpdate = true;
      redraw();
    },
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      redraw();
    },
    setPaused(next) {
      paused = next;
      lapseThroughPause = false;
      redraw();
    },
    setTier(next) {
      return runtime.setTier(next).then(() => {
        renderer.shadowMap.needsUpdate = true;
      });
    },
    turn(by, options = {}) {
      if (shown !== null) return;
      yaw = clampYaw(yaw + by);
      moveTo({ duration: options.ease ? MOTION.panel : 0 });
    },
    resetTurn() {
      yaw = 0;
      moveTo({ duration: MOTION.flight[0] });
    },
    pick(x, y) {
      const { width, height } = runtime.stage;
      ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
      ray.origin.setFromMatrixPosition(camera.matrixWorld);
      ray.direction.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(ray.origin).normalize();
      let best: StopId | null = null;
      let nearest = Infinity;
      for (const m of models) {
        const volumes = [
          ...m.hits,
          ...(m.followHits ?? []).map((h) =>
            box.copy(h.box).applyMatrix4(h.follow.matrixWorld).clone(),
          ),
        ];
        for (const v of volumes) {
          if (!ray.intersectBox(v, hitPoint)) continue;
          const d = hitPoint.distanceTo(ray.origin);
          if (d < nearest) {
            nearest = d;
            best = m.id;
          }
        }
      }
      return best;
    },
    nameLabels(next) {
      named = new Set(next);
      labelsDirty = true;
      redraw();
    },
    establish() {
      if (instantMoves() || shown !== null || !shownArea) return;
      // From farther out and higher, looking the same way: the whole site comes into view.
      const to = cam.pose();
      const out = to.position.clone().sub(to.target).multiplyScalar(1.8);
      const from = {
        position: to.target
          .clone()
          .add(out)
          .add(new Vector3(0, 30, 0)),
        target: to.target.clone(),
        fov: to.fov,
      };
      cam.setPose(from);
      flight = {
        from,
        to,
        fromArea: shownArea,
        toArea: shownArea,
        start: performance.now(),
        duration: MOTION.establish,
        lift: 0,
      };
      runtime.requestFrame();
    },
    land() {
      if (!flight) return;
      flight.start = performance.now() - flight.duration;
      runtime.requestFrame();
    },
    playTimeLapse() {
      lapseThroughPause = paused;
      timeLapse.current?.play();
      redraw();
    },
    stepTimeLapse(step) {
      timeLapse.current?.seekStep(step);
      redraw();
    },
    relayout(ease = false) {
      labels.measure();
      const under = flight;
      if (under && !instantMoves()) {
        const elapsed = performance.now() - under.start;
        if (elapsed < under.duration * 0.1) {
          // A flight just begun, as when a stop opens along with its panel: aimed anew at the new
          // room, keeping its arc and its pace.
          const { area, pose } = target();
          cam.setLayout(runtime.stage.width, runtime.stage.height, shownArea ?? area);
          under.to = pose;
          under.toArea = area;
          runtime.requestFrame();
        } else {
          // Well under way: on from where it is now to the new room, over what was left of it.
          moveTo({ duration: Math.max(MOTION.panel, under.duration - elapsed) });
        }
        return;
      }
      if (ease) {
        moveTo({ duration: MOTION.panel });
        return;
      }
      flight = null;
      frameNow();
      redraw();
    },
    refreshLabels() {
      placeLabels();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      runtime.dispose();
      lighting.dispose();
      details.dispose();
      disposeObject(scene);
    },
  };
}
