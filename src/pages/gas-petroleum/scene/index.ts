/**
 * The Gas & Petroleum diorama's 3D scene: the block and its thirteen stops, the routes and what
 * flows along them, the formation time-lapse, the stops' markers, and a camera the reader turns
 * all the way round, tilts, zooms and pans, framing the overview or a stop in the room the panel
 * leaves, behind a small API the UI drives.
 *
 * The overview stays alive while motion is on: beads flow along the routes and the machines run.
 * At a stop, its path's flow and its own machines lead, and the rest calm down. Pausing motion, or
 * reduced motion, stills all of it, and the loop sleeps until the camera moves.
 */
import { Box3, MathUtils, PerspectiveCamera, Ray, Raycaster, Scene, Vector2, Vector3 } from 'three';
import { STOPS, type StopId } from '../../../../content/utilities/gas-petroleum.ts';
import type { PathId } from '../../../design/paths.ts';
import { LABEL_LIMITS, MOTION, THEMES, easeInOut, type ThemeName } from '../../../design/tokens.ts';
import {
  LabCamera,
  areaBetween,
  type CameraPose,
  type View,
  type VisibleArea,
} from '../../../kit3d/camera.ts';
import { disposeObject } from '../../../kit3d/dispose.ts';
import { CENTERED, type Shift } from '../../../kit3d/fit.ts';
import { LabelLayer, type Label } from '../../../kit3d/labels.ts';
import { placeMarkers } from '../../../kit3d/placement.ts';
import { createLighting } from '../../../kit3d/lighting.ts';
import { setGroundGrade } from '../../../kit3d/materials.ts';
import { OrbitRig, type AtLimits } from '../../../kit3d/orbit.ts';
import { createPost, preloadPost } from '../../../kit3d/post.ts';
import type { Tier } from '../../../kit3d/quality.ts';
import { SceneRuntime } from '../../../kit3d/runtime.ts';
import { stopsInSight } from '../journey.ts';
import { clockText } from '../summary.ts';
import { padsOn, setDimColor } from './build.ts';
import { DetailLayer, type Rect } from './details.ts';
import { buildGround } from './ground.ts';
import { MODEL_BOX } from './layout.ts';
import { buildRoutes } from './routes.ts';
import {
  ORBIT,
  ORBIT_STEP,
  nearestAt,
  nightGradeAt,
  orbitBounds,
  overviewPoints,
  overviewView,
  stopShot,
} from './shots.ts';
import { buildStops } from './stops/index.ts';
import { CLOCK_AT, type TimeLapse, type TimeLapseState } from './timelapse.ts';

export type { Rect };
export type { AtLimits };
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
  /**
   * With `capture`: the view held where the establishing move starts, as the loader's poster shows
   * it, so the view takes over from the poster with no jump (`npm run thumbnails` shoots it so).
   */
  arrival?: boolean;
  perf: boolean;
  /** The part of the canvas the panel and controls leave free, in CSS pixels. */
  visibleArea: () => VisibleArea;
  /** Rectangles labels must avoid, in the canvas's CSS pixels. */
  noGo: () => Rect[];
  /** Told as the time-lapse plays: its clock, caption and progress. */
  onTimeLapse?: (state: TimeLapseState) => void;
  /** Told the limits the camera now stands at, as they change, for the camera buttons. */
  onLimits?: (limits: AtLimits) => void;
  /** Told the reader has moved the camera themselves: by drag, wheel, pinch or touch. */
  onMoved?: () => void;
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
  /** Turns the camera round what it looks at, a step to the left (-1) or right (1). */
  turn(direction: -1 | 1): void;
  /** Tilts the camera a step toward level (1, up) or toward overhead (-1, down). */
  tilt(direction: -1 | 1): void;
  /** Zooms a step in (1) or out (-1). */
  zoom(direction: -1 | 1): void;
  /** Pans a step across the view: right (1) or left (-1), and up (1) or down (-1). */
  pan(across: -1 | 0 | 1, up: -1 | 0 | 1): void;
  /** Back to the open view's own framing: the overview's, or the stop's. */
  resetView(): void;
  /** Centers the view on what's under a point of the canvas, in CSS pixels, if anything. */
  centerAt(x: number, y: number): void;
  /** The limits the camera stands at, or is headed to. */
  readonly limits: AtLimits;
  /** The stop under a point of the canvas, in CSS pixels, or null. */
  pick(x: number, y: number): StopId | null;
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
  /**
   * Frames the view again for the room it has; with `ease`, it glides there. A view the reader
   * has moved stays as they left it, centered in its new room.
   */
  relayout(ease?: boolean): void;
  /** Places labels again, now: when a label gains focus. */
  refreshLabels(): void;
  /**
   * The stop whose marker is under the mouse, or null: it's named as a focused one is, on a side of
   * its badge with room for its name, clear of the controls.
   */
  setHovered(id: StopId | null): void;
  /**
   * Shows or hides every name in the view: the small labels on the stops' parts, and the stops'
   * names, which then show only on a marker that's hovered or focused. The numbered markers always
   * show, since they're how to get around.
   */
  setLabels(shown: boolean): void;
  dispose(): void;
}

/** A free area this much taller than wide gets the overview from the east. */
const TALL = 1.05;

/** How long the establishing move takes to settle, in seconds: most of `MOTION.establish`. */
const ESTABLISH_SETTLE = MOTION.establish / 1000 / 3;

/**
 * The establishing move has settled, to the eye, once what's left of it is this share of the
 * camera's distance: a pixel or two at the view's edges. Its ease goes on for seconds more, too
 * little to see, and the stops' names needn't wait for it.
 */
const ARRIVED_WITHIN = 0.002;

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
  /** Whether the view shows its names (the labels setting). */
  let named = true;
  /** The stop whose marker is under the mouse. */
  let hovered: StopId | null = null;
  /** Seconds of motion so far: the clock every machine and bead runs on. */
  let time = 3;
  let shown: StopId | null = null;
  let filter: Filter = 'both';
  /** The free area the view is framed for now. */
  let shownArea: VisibleArea | null = null;
  /** How far the picture slides off that area's middle, clear of controls over a corner of it. */
  let shift: Shift = CENTERED;
  /**
   * A glide under way to new room, or a new slide, over `MOTION.panel`: the picture moves along
   * with the camera rather than jumping. `eased` is how far along it is, eased.
   */
  let glide: {
    from: VisibleArea;
    to: VisibleArea;
    fromShift: Shift;
    toShift: Shift;
    start: number;
    eased: number;
  } | null = null;
  /** The reader has moved the camera since the view was last framed for them. */
  let movedByReader = false;
  /**
   * The establishing move is under way: framed again meanwhile (the fonts in, say), it heads there.
   * Meanwhile the stops show by number alone, as names would come and go as the view closes in.
   */
  let arriving = false;
  /** Ends the establishing move's hold on the stops' names: they're placed again, now. */
  function arrived() {
    if (!arriving) return;
    arriving = false;
    labelsDirty = true;
    redraw();
  }
  /** Held where the establishing move starts (`arrival`, with capture): framed again, it stays there. */
  let heldArriving = false;
  /** The limits last told to the UI. */
  let toldLimits = '';
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
        glide = null;
        reframe(false);
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
  const stops = models.map((model) => ({
    id: model.id,
    model,
    path: STOPS.find((s) => s.id === model.id)?.path ?? 'shared',
    /** Its place in its path's story, counting the shared start. */
    step: STOPS.find((s) => s.id === model.id)?.step ?? 0,
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
  timeLapse.current?.onChange((state) => {
    details.setClock(clockShown() ? clockText(state.ma) : null);
    labelsDirty = true;
    o.onTimeLapse?.(state);
  });

  const cam = new LabCamera(camera);
  const labels = new LabelLayer(camera, o.noGo, placeMarkers);
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
   * fading, the free area gliding, and the camera. Returns whether anything still moves. In
   * capture mode it's run once per change, with every ease landed at once.
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
    if (glide) {
      const t = Math.min(1, (performance.now() - glide.start) / MOTION.panel);
      const e = easeInOut(t);
      glide.eased = e;
      shift = {
        x: MathUtils.lerp(glide.fromShift.x, glide.toShift.x, e),
        y: MathUtils.lerp(glide.fromShift.y, glide.toShift.y, e),
      };
      applyArea(areaBetween(glide.from, glide.to, e));
      if (t >= 1) glide = null;
    }
    // The camera, settling into a move or following the reader's hand.
    const turning = rig.update(o.capture ? 0 : dt);
    if (turning) {
      labelsDirty = true;
      tellLimits();
      markCamera();
    }
    if (!turning || (arriving && rig.remaining() < ARRIVED_WITHIN)) arrived();
    gradeGround();
    const following = moving && stops.some((s) => s.id === shown && s.follows);
    if (labelsDirty || lapsing || following) {
      placeLabels();
      labelsDirty = false;
    }
    return moving || lapsing || easing || glide !== null || turning;
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

  /**
   * What the theme sets besides the light: the quiet gray faded stops and routes lean toward, the
   * ground's night grade, and the lamps and lit windows.
   */
  function applyTheme() {
    const tokens = THEMES[theme].scene;
    setDimColor(tokens.fade);
    routes.setDimColor(tokens.fade);
    gradeGround();
    ground.setLamps(tokens.lamps);
    for (const m of models) m.setLamps?.(tokens.lamps);
  }

  const overviewMustSee = overviewPoints(models);
  const modelOf = (id: StopId | null | undefined) =>
    id ? models.find((m) => m.id === id) : undefined;
  const tallArea = (area: VisibleArea) => area.height > area.width * TALL;

  /** The pose that frames a view in a room, the camera framed as it is meanwhile. */
  function fitIn(area: VisibleArea, view: View): CameraPose {
    cam.setLayout(runtime.stage.width, runtime.stage.height, area);
    const pose = cam.poseFor(view);
    if (shownArea) cam.setLayout(runtime.stage.width, runtime.stage.height, shownArea, shift);
    return pose;
  }

  /**
   * The overview's framing in a room, kept for the last few rooms (by where they are and what's
   * over them): fitting it can mean trying many slides clear of the camera's buttons.
   */
  const overviews = new Map<string, CameraPose>();
  function overviewPoseIn(area: VisibleArea): CameraPose {
    const { width, height } = runtime.stage;
    const key = JSON.stringify([
      width,
      height,
      area.x,
      area.y,
      area.width,
      area.height,
      area.keepOut,
    ]);
    const kept = overviews.get(key);
    if (kept) return kept;
    const pose = fitIn(area, overviewView(overviewMustSee, tallArea(area)));
    overviews.set(key, pose);
    const oldest = overviews.keys().next().value;
    if (overviews.size > 8 && oldest !== undefined) overviews.delete(oldest);
    return pose;
  }

  /** How far the overview's camera stands from what it looks at, in a room. */
  const overviewReach = (area: VisibleArea) => {
    const pose = overviewPoseIn(area);
    return pose.position.distanceTo(pose.target);
  };

  /** The open view's framing in a room: the overview, or the open stop's shot. */
  function poseIn(area: VisibleArea): CameraPose {
    const model = modelOf(shown);
    if (!model) return overviewPoseIn(area);
    const inSight = stopsInSight(model.id).flatMap((id) => modelOf(id) ?? []);
    return fitIn(area, stopShot(model, inSight, overviewReach(area)));
  }

  /**
   * The overview's distance in the room the view is framed for (`shownArea`), for the ground's
   * night grade and the canvas's zoom: eased between the rooms while the view glides, so neither
   * jumps.
   */
  function overviewDistance(): number {
    if (glide) {
      return MathUtils.lerp(overviewReach(glide.from), overviewReach(glide.to), glide.eased);
    }
    return shownArea ? overviewReach(shownArea) : 1;
  }

  /**
   * How far the camera must stand to show the whole model in a room from whichever side it's
   * turned to: on a tall screen, the long side needs much more room than the overview's end-on view.
   * Kept per room, like the overview.
   */
  const allRound = new Map<string, number>();
  function allRoundReach(area: VisibleArea): number {
    const { width, height } = runtime.stage;
    const key = JSON.stringify([width, height, area.x, area.y, area.width, area.height]);
    const kept = allRound.get(key);
    if (kept !== undefined) return kept;
    const reach = Math.max(
      overviewReach(area),
      ...[1, 2, 3].map((quarter) => {
        const view = overviewView(overviewMustSee, tallArea(area), (quarter * Math.PI) / 2);
        const pose = fitIn(area, { ...view, slide: false });
        return pose.position.distanceTo(pose.target);
      }),
    );
    allRound.set(key, reach);
    const oldest = allRound.keys().next().value;
    if (allRound.size > 8 && oldest !== undefined) allRound.delete(oldest);
    return reach;
  }

  /** The camera's limits in a room: it zooms out a little past where the whole model shows. */
  const limitsIn = (area: VisibleArea) => ({
    polar: ORBIT.polar,
    distance: [ORBIT.near, allRoundReach(area) * ORBIT.far] as const,
    bounds: orbitBounds(),
    nearestAt,
  });

  const rig = new OrbitRig(
    camera,
    o.canvas,
    { polar: ORBIT.polar, distance: [ORBIT.near, 1000], bounds: orbitBounds(), nearestAt },
    {
      wake() {
        redraw();
      },
      moved() {
        movedByReader = true;
        arrived();
        o.onMoved?.();
      },
    },
  );
  rig.setInstant(reducedMotion || o.capture);

  /**
   * The free area the view is framed in, now, with the picture slid by `shift`: the camera's
   * projection and its zoom toward the pointer both follow.
   */
  function applyArea(area: VisibleArea) {
    shownArea = area;
    cam.setLayout(runtime.stage.width, runtime.stage.height, area, shift);
    rig.setArea(area, runtime.stage, shift);
    labelsDirty = true;
  }

  /**
   * Where the camera stands, as data on the canvas, for tests and tools: its heading and tilt in
   * whole degrees, its distance as a share of the overview's, and the point it looks at.
   */
  function markCamera() {
    const { heading, tilt, distance, target } = rig.where();
    const degrees = (radians: number) => String(Math.round(MathUtils.radToDeg(radians)));
    const data = o.canvas.dataset;
    data.heading = degrees(MathUtils.euclideanModulo(heading, Math.PI * 2));
    data.tilt = degrees(tilt);
    data.zoom = (distance / overviewDistance()).toFixed(2);
    data.at = target
      .toArray()
      .map((n) => n.toFixed(1))
      .join(',');
  }

  /** Tells the UI the limits the camera stands at, when they change. */
  function tellLimits() {
    const now = rig.atLimits();
    const key = JSON.stringify(now);
    if (key === toldLimits) return;
    toldLimits = key;
    o.onLimits?.(now);
  }

  /**
   * The ground's night grade, by how near the camera is (`nightGradeAt`), measured against the
   * overview in the room the view is framed for now. That room eases along with every move, as
   * when the guide opens, so the grade never jumps. By day there's none.
   */
  let graded = { theme: '', strength: -1 };
  function gradeGround() {
    const strength = nightGradeAt(rig.distance / overviewDistance());
    if (graded.theme === theme && graded.strength === strength) return;
    graded = { theme, strength };
    setGroundGrade(THEMES[theme].scene.ground, strength);
  }

  /** Camera moves are cuts with motion reduced, and in capture mode. */
  const instantMoves = () => reducedMotion || o.capture;

  /** Where the establishing move into a pose starts: farther out and higher, looking the same way. */
  function arrivalFrom(to: CameraPose): CameraPose {
    const out = to.position.clone().sub(to.target).multiplyScalar(1.8);
    return {
      position: to.target
        .clone()
        .add(out)
        .add(new Vector3(0, 30, 0)),
      target: to.target.clone(),
      fov: to.fov,
    };
  }

  /**
   * Frames the open view in the room the view has now: the camera moves to the view's framing in
   * it (a cut, unless `move`), and the area and the picture's slide glide there along with it
   * (with `ease` or `move`). A view the reader has moved keeps its pose and slide, in the new
   * room, unless `refit`.
   */
  function reframe(ease: boolean, { move = ease, refit = !movedByReader } = {}) {
    const area = o.visibleArea();
    const pose = refit ? poseIn(area) : null;
    const toShift = pose?.shift ?? shift;
    if ((ease || move) && !instantMoves() && shownArea) {
      glide = {
        from: shownArea,
        to: area,
        fromShift: shift,
        toShift,
        start: performance.now(),
        eased: 0,
      };
    } else {
      glide = null;
      shift = toShift;
      applyArea(area);
    }
    rig.setLimits(limitsIn(area));
    if (pose) {
      movedByReader = false;
      if (heldArriving) rig.lookAt(arrivalFrom(pose), false);
      else if (arriving) rig.lookAt(pose, true, ESTABLISH_SETTLE);
      else rig.lookAt(pose, move);
    }
    tellLimits();
    labelsDirty = true;
    redraw();
  }

  /** The time-lapse's clock shows while it plays, and while it's held at a step before today. */
  function clockShown(): boolean {
    const state = timeLapse.current?.state;
    return state !== undefined && (state.playing || state.progress < 1);
  }

  function placeLabels() {
    const area = shownArea ?? o.visibleArea();
    const free = { x: area.x, y: area.y, w: area.width, h: area.height };
    // Every stop's marker shows. The open stop's is named however crowded; the rest are named in
    // the story's order where there's room, step by step, the path the view shows first after the
    // fork; a path faded back shows by number alone, and comes last. With the labels off, every
    // marker shows by number alone, the open stop's too, but for one hovered or focused; and so
    // while the view arrives, until it has settled, when the names come in.
    const first = filter === 'gasoline' ? 'gasoline' : 'gas';
    for (const label of labelList) {
      const stop = stops.find((s) => s.id === label.id);
      if (!stop) continue;
      const faded = dimmed(stop.path) && label.id !== shown;
      const rank = stop.step * 2 + (stop.path === 'shared' || stop.path === first ? 0 : 1);
      // The open stop's marker first, named or not, so no other badge takes its place.
      label.priority = (label.id === shown ? 1000 : 0) - rank - (faded ? 100 : 0);
      label.highlight = named && label.id === shown;
      label.hovered = label.id === hovered;
      // Faded back, with the labels off or while the view arrives, by its badge alone, unless
      // it's focused.
      label.badgeOnly = faded || !named || arriving;
    }
    // A view too short for names, as on a phone with the guide open, shows them by number alone,
    // but for the open stop and a focused one.
    labels.update(
      runtime.stage.width,
      runtime.stage.height,
      free,
      Infinity,
      Math.min(area.width, area.height) < LABEL_LIMITS.iconsBelow,
    );
    // The small labels on the open stop's parts keep clear of the controls and the stops' labels.
    details.update(
      camera,
      runtime.stage.width,
      runtime.stage.height,
      shown,
      [...o.noGo(), ...labels.shown],
      clockShown(),
    );
  }

  // Built: the first framing, compiled, then the loop.
  await runtime.init();
  reframe(false);
  applyTheme();
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
  const raycaster = new Raycaster();

  /** Points the ray from the camera through a point of the canvas, in CSS pixels. */
  function aim(x: number, y: number) {
    const { width, height } = runtime.stage;
    ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
    ray.origin.setFromMatrixPosition(camera.matrixWorld);
    ray.direction.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(ray.origin).normalize();
  }

  return {
    get limits() {
      return rig.atLimits();
    },
    show(stop, options = {}) {
      // Opened while the view arrives, as by a screen reader's click, which lands nothing first: the
      // arrival ends, so the stop's marker is named and the view moves to it as to any stop.
      arrived();
      // Leaving the formation, a time-lapse held at a step goes back to today.
      const lapse = timeLapse.current;
      if (stop !== 'formation' && lapse && !lapse.playing && lapse.state.progress < 1) {
        lapse.reset();
      }
      shown = stop;
      labelsDirty = true;
      reframe(options.fly !== false, { refit: true });
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
      applyTheme();
      renderer.shadowMap.needsUpdate = true;
      redraw();
    },
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      rig.setInstant(reducedMotion || o.capture);
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
    turn(direction) {
      movedByReader = true;
      rig.turn(direction * ORBIT_STEP.turn);
    },
    tilt(direction) {
      movedByReader = true;
      rig.tilt(direction * ORBIT_STEP.tilt);
    },
    zoom(direction) {
      movedByReader = true;
      rig.zoom(direction * ORBIT_STEP.zoom);
    },
    pan(across, up) {
      movedByReader = true;
      rig.pan(across * ORBIT_STEP.pan, up * ORBIT_STEP.pan);
    },
    resetView() {
      reframe(false, { move: true, refit: true });
    },
    centerAt(x, y) {
      aim(x, y);
      raycaster.ray.copy(ray);
      const hit = raycaster.intersectObjects([ground.group, ...models.map((m) => m.root)], true)[0];
      if (!hit) return;
      movedByReader = true;
      rig.centerOn(hit.point);
    },
    pick(x, y) {
      aim(x, y);
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
    establish() {
      const held = o.capture && o.arrival === true;
      if ((instantMoves() && !held) || shown !== null || !shownArea) return;
      // From farther out and higher, looking the same way: the whole site comes into view.
      const to = rig.pose(camera.fov, true);
      rig.lookAt(arrivalFrom(to), false);
      // Held where it starts, for the poster: the move's first frame.
      if (held) {
        heldArriving = true;
        redraw();
        return;
      }
      rig.lookAt(to, true, ESTABLISH_SETTLE);
      arriving = true;
    },
    land() {
      arrived();
      rig.land();
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
      reframe(ease);
    },
    refreshLabels() {
      placeLabels();
    },
    setHovered(id) {
      if (hovered === id) return;
      hovered = id;
      placeLabels();
    },
    setLabels(shown) {
      named = shown;
      details.setPartsShown(shown);
      labelsDirty = true;
      redraw();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rig.dispose();
      runtime.dispose();
      lighting.dispose();
      details.dispose();
      disposeObject(scene);
    },
  };
}
