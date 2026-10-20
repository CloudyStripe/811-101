/**
 * Read the Marks' 3D scene: the yard, its marks, and the lines under them, behind a small API the
 * game drives. The view holds still, framed from the street and the right on wide screens and from
 * the street and above on upright ones, in the room the panel or sheet leaves it.
 *
 * The game says which mark it's on (the others dim; asked about, it glows) and which lines' ground is
 * open. Opening a line cuts the ground along it (the ground is built again, cut there) and slides
 * the cut's cover aside, its flags stepping off onto solid ground; closing slides it back, and the
 * ground is built whole again. The shadow map renders again only when the ground is built again.
 */
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { LABEL_LIMITS, easeInOut, labSceneTokens, type ThemeName } from '../../../design/tokens.ts';
import { LabCamera, type View, type VisibleArea } from '../../../kit3d/camera.ts';
import { disposeObject } from '../../../kit3d/dispose.ts';
import { LabelLayer, type Label, type Rect } from '../../../kit3d/labels.ts';
import { createLighting } from '../../../kit3d/lighting.ts';
import { createPost, preloadPost } from '../../../kit3d/post.ts';
import type { Tier } from '../../../kit3d/quality.ts';
import { SceneRuntime } from '../../../kit3d/runtime.ts';
import type { MarkId } from '../game.ts';
import { buildBuildings } from './buildings.ts';
import { buildFixtures } from './fixtures.ts';
import { buildGround, groundMaterials, type Ground } from './ground.ts';
import { BANDS, BLOCK, GARAGE, HOUSE, MARKS, segmentsOf, topAt } from './layout.ts';
import { buildLines } from './lines.ts';
import { buildMarks } from './marks.ts';
import { OPEN_MS } from './palette.ts';

export type { Rect } from '../../../kit3d/labels.ts';

/**
 * What the scene shows: the mark the round is on (the rest dim), whether it's being asked about
 * (it glows), and the lines whose ground is open.
 */
export interface SceneState {
  focus: MarkId | null;
  glow: boolean;
  open: readonly MarkId[];
}

export interface MarksSceneOptions {
  canvas: HTMLCanvasElement;
  /** Each open line's name, in the view. */
  labelElements: Map<MarkId, HTMLElement>;
  tier: Tier | 'auto';
  theme: ThemeName;
  reducedMotion: boolean;
  /** Deterministic frames for screenshots: one frame per change, no motion. */
  capture: boolean;
  perf: boolean;
  state: SceneState;
  /** The part of the canvas the panel or sheet and the header leave free, in CSS pixels. */
  visibleArea: () => VisibleArea;
  /** Rectangles labels must avoid, in the canvas's CSS pixels. */
  noGo: () => Rect[];
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

export interface MarksScene {
  setState(state: SceneState): void;
  setTheme(theme: ThemeName): void;
  setReducedMotion(reduced: boolean): void;
  /** Shows or hides the open lines' names. */
  setLabelsShown(shown: boolean): void;
  setTier(tier: Tier | 'auto'): Promise<void>;
  readonly tier: Tier;
  /** Frames the view for the room it has now, e.g. after fonts load or the layout changes. */
  relayout(): void;
  /** Places the labels again, now. */
  refreshLabels(): void;
  dispose(): void;
}

/** A free area this much taller than wide is seen from the street and above. */
const TALL = 1.05;

/** What frames the view: the block's corners, the house's ridge. */
const MUST_SEE = [
  [BLOCK.x0, 0.3, BLOCK.z0],
  [BLOCK.x1, 0.3, BLOCK.z0],
  [BLOCK.x0, 0.3, BLOCK.z1],
  [BLOCK.x1, 0.3, BLOCK.z1],
  [BLOCK.x0, BLOCK.bottom, BLOCK.z1],
  [BLOCK.x1, BLOCK.bottom, BLOCK.z1],
  [BLOCK.x1, BLOCK.bottom, BLOCK.z0],
  [BLOCK.x0, GARAGE.ridge, HOUSE.z0],
  [BLOCK.x1, 12, BLOCK.z0],
].map(([x = 0, y = 0, z = 0]) => [x, y, z] as const);

const TARGET = [0, -2, -12] as const;

/** The view for a free area: from the street and the right, or, upright, from the street and above. */
export function viewFor(tall: boolean): View {
  const dir = tall ? [0.16, 1.1, 1] : [0.42, 0.74, 1];
  const [dx = 0, dy = 0, dz = 0] = dir;
  const n = Math.hypot(dx, dy, dz);
  const [tx, ty, tz] = TARGET;
  return {
    position: [tx + (dx / n) * 200, ty + (dy / n) * 200, tz + (dz / n) * 200],
    target: TARGET,
    mustSee: MUST_SEE,
    margin: 0.04,
  };
}

/** How far a lid drops before it slides, so it passes under the ground beside it. */
const DROP = 0.34;

/** Builds the scene. If building fails, the renderer it made is released before the error. */
export async function createMarksScene(o: MarksSceneOptions): Promise<MarksScene> {
  let runtime: SceneRuntime | null = null;
  try {
    return await buildMarksScene(o, (r) => {
      runtime = r;
    });
  } catch (error) {
    (runtime as SceneRuntime | null)?.dispose();
    throw error;
  }
}

async function buildMarksScene(
  o: MarksSceneOptions,
  onRuntime: (runtime: SceneRuntime) => void,
): Promise<MarksScene> {
  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 1, 1, 3000);
  let reducedMotion = o.reducedMotion;
  let theme = o.theme;
  let labelsShown = true;
  let labelsDirty = true;
  let disposed = false;
  /** While the graphics context is lost, the ground waits to be built again until it's back. */
  let lost = false;
  let state = o.state;
  /** How open each line's ground is, 0 to 1, and where it's headed. */
  const openness = new Map<MarkId, { t: number; want: number }>(
    MARKS.map((m) => {
      const t = state.open.includes(m.id) ? 1 : 0;
      return [m.id, { t, want: t }];
    }),
  );

  const runtime: SceneRuntime = new SceneRuntime(
    {
      canvas: o.canvas,
      tier: o.tier,
      capture: o.capture,
      perf: o.perf,
      camera,
      post: (tierSettings) => createPost(runtime.renderer, scene, camera, tierSettings),
    },
    {
      frame(dt) {
        const moving = step(dt);
        if (labelsDirty) {
          placeLabels();
          labelsDirty = false;
        }
        return moving;
      },
      resize() {
        frameView();
      },
      tierChanged(settings) {
        lighting.setShadowQuality(settings.shadowMapSize, settings.shadowRadius);
      },
      contextLost() {
        lost = true;
        o.onContextLost?.();
      },
      contextRestored() {
        lost = false;
        lighting.restore(labSceneTokens(theme));
        // What the ground had uploaded went with the context: it's built afresh, for the lines
        // open now.
        rebuildGround(true);
        labelsDirty = true;
        o.onContextRestored?.();
      },
    },
  );
  onRuntime(runtime);
  const { renderer, stage } = runtime;
  preloadPost(runtime.settings);

  const bounds = new Box3(
    new Vector3(BLOCK.x0, BLOCK.bottom, BLOCK.z0),
    new Vector3(BLOCK.x1, 18, BLOCK.z1),
  );
  const lighting = createLighting(renderer, scene, bounds, labSceneTokens(theme), {
    shadow: { mapSize: runtime.settings.shadowMapSize, radius: runtime.settings.shadowRadius },
  });

  const materials = groundMaterials();
  const buildings = buildBuildings();
  const lines = buildLines();
  const marks = buildMarks();
  scene.add(buildings.group, buildFixtures(), lines.group, marks.group);

  let ground: Ground | null = null;
  /** The lines the ground is cut along now. */
  let cutFor: MarkId[] = [];

  /**
   * Builds the ground cut along every line that's open or opening; whole when none is. With the
   * graphics context lost, it waits: the restored context builds it afresh.
   */
  function rebuildGround(afresh = false) {
    if (lost) return;
    const open = MARKS.filter((m) => {
      const s = openness.get(m.id);
      return m.line && s && (s.t > 0 || s.want > 0);
    }).map((m) => m.id);
    if (!afresh && ground && open.join() === cutFor.join()) return;
    if (ground) {
      scene.remove(ground.group, ...ground.lids.map((l) => l.group));
      // What a lost context had uploaded is gone already: nothing to free.
      if (!afresh) ground.dispose();
    }
    ground = buildGround(open, materials);
    cutFor = open;
    scene.add(ground.group, ...ground.lids.map((l) => l.group));
    placeOpenings();
    // What casts into the ground has changed: the shadow map renders again, once.
    renderer.shadowMap.needsUpdate = true;
  }

  const offset = new Vector3();
  /** Slides each lid and its paint, and steps its flags aside, as far as its line is open. */
  function placeOpenings() {
    if (!ground) return;
    for (const lid of ground.lids) {
      const t = openness.get(lid.mark)?.t ?? 0;
      const e = easeInOut(t);
      offset.set(
        lid.aside.x * lid.reach * e,
        -DROP * Math.min(1, t * 3),
        lid.aside.z * lid.reach * e,
      );
      lid.group.position.copy(offset);
      lid.group.visible = t < 1;
      marks.setRun(lid.mark, lid.run, offset, e, t >= 1);
    }
    // Lines no longer cut: their marks back in place.
    for (const m of MARKS) {
      if (!m.line || cutFor.includes(m.id)) continue;
      segmentsOf(m.line).forEach((_, run) => {
        marks.setRun(m.id, run, offset.set(0, 0, 0), 0, false);
      });
    }
  }

  /** Moves what's opening or closing on by `dt`; whether anything still moves. */
  function step(dt: number): boolean {
    const instant = reducedMotion || o.capture;
    let moving = false;
    let landedClosed = false;
    for (const s of openness.values()) {
      if (s.t === s.want) continue;
      const k = instant ? 1 : dt / (OPEN_MS / 1000);
      s.t = s.want > s.t ? Math.min(s.want, s.t + k) : Math.max(s.want, s.t - k);
      if (s.t !== s.want) moving = true;
      else if (s.want === 0) landedClosed = true;
    }
    placeOpenings();
    if (landedClosed) rebuildGround();
    labelsDirty = true;
    return moving;
  }

  // The open lines' names: over the middle of each line's longest run, pointing down at it.
  const labels = new LabelLayer(camera, o.noGo);
  const labelList: Label[] = MARKS.flatMap((m) => {
    const element = o.labelElements.get(m.id);
    if (!m.line || !element) return [];
    const runs = segmentsOf(m.line);
    const longest = runs.reduce((a, b) =>
      Math.hypot(b[1].x - b[0].x, b[1].z - b[0].z) > Math.hypot(a[1].x - a[0].x, a[1].z - a[0].z)
        ? b
        : a,
    );
    const [a, b] = longest;
    const mid = { x: (a.x + b.x) / 2, z: (Math.min(a.z, 11) + Math.min(b.z, 11)) / 2 };
    return [
      {
        id: m.id,
        element,
        anchor: new Vector3(mid.x, topAt(mid) + 1.6, mid.z),
        point: new Vector3(mid.x, -m.line.depth + m.line.radius, mid.z),
        priority: 1,
        hidden: true,
      },
    ];
  });
  labels.setLabels(labelList);

  /**
   * Each line, as the names keep off it once it's open, as the lab's keep off its lines: points all
   * along its runs, from the curb in, so the band narrows with distance as the line does.
   */
  const keepClear = new Map(
    MARKS.flatMap((m) => {
      const line = m.line;
      if (!line) return [];
      const points = segmentsOf(line).flatMap(([a, b]) =>
        Array.from({ length: 9 }, (_, i) => {
          const k = i / 8;
          return new Vector3(
            a.x + (b.x - a.x) * k,
            -line.depth,
            Math.min(a.z + (b.z - a.z) * k, BANDS.stripFront),
          );
        }),
      );
      return [[m.id, { points, radius: line.radius }] as const];
    }),
  );

  const freeArea = () => {
    const v = o.visibleArea();
    return { x: v.x, y: v.y, w: v.width, h: v.height };
  };
  function placeLabels() {
    for (const label of labelList) {
      const t = openness.get(label.id as MarkId)?.t ?? 0;
      label.hidden = !labelsShown || t < 0.7;
    }
    if (!labelsShown && labelList.every((l) => l.hidden)) {
      labels.update(stage.width, stage.height, freeArea(), 0, false);
      return;
    }
    labels.setKeepClear(
      MARKS.flatMap((m) => {
        const keep = keepClear.get(m.id);
        return keep && (openness.get(m.id)?.t ?? 0) >= 0.7 ? [keep] : [];
      }),
    );
    const area = freeArea();
    labels.update(
      stage.width,
      stage.height,
      area,
      Infinity,
      Math.min(area.w, area.h) < LABEL_LIMITS.iconsBelow,
    );
  }

  const cam = new LabCamera(camera);
  function frameView() {
    const area = o.visibleArea();
    cam.setLayout(stage.width, stage.height, area);
    cam.frame(viewFor(area.height > area.width * TALL));
    labelsDirty = true;
  }

  function applyTheme() {
    lighting.setTheme(labSceneTokens(theme));
    const night = theme === 'dark';
    marks.setNight(night);
    lines.setNight(night);
    buildings.setLamps(night ? 1 : 0);
    renderer.shadowMap.needsUpdate = true;
  }

  function applyState() {
    marks.setFocus(state.focus, state.glow);
    for (const [id, s] of openness) s.want = state.open.includes(id) ? 1 : 0;
    // Anything opening needs its cut first; anything closing keeps it until it has closed.
    rebuildGround();
    labelsDirty = true;
  }

  /** Asks for a frame; in capture mode, settles what changed and draws it once. */
  function redraw() {
    if (!o.capture) {
      runtime.requestFrame();
      return;
    }
    step(0);
    placeLabels();
    runtime.renderOnce();
  }

  applyTheme();
  applyState();
  await runtime.init();
  frameView();
  document.documentElement.dataset.sceneStage = 'compile';
  await runtime.compile([scene]);
  runtime.start(() => {
    step(0);
    placeLabels();
  });

  return {
    get tier() {
      return runtime.tier;
    },
    setState(next) {
      state = next;
      applyState();
      redraw();
    },
    setTheme(next) {
      theme = next;
      applyTheme();
      redraw();
    },
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      redraw();
    },
    setLabelsShown(shown) {
      // Shown again, they're measured afresh: hidden, as they may have been from the first, they
      // had no size.
      if (shown && !labelsShown) labels.measure();
      labelsShown = shown;
      labelsDirty = true;
      if (o.capture) redraw();
      else placeLabels();
    },
    setTier(next) {
      return runtime.setTier(next);
    },
    relayout() {
      labels.measure();
      frameView();
      if (o.capture) {
        placeLabels();
        runtime.renderOnce();
        return;
      }
      runtime.requestFrame();
    },
    refreshLabels() {
      placeLabels();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      runtime.dispose();
      lighting.dispose();
      ground?.dispose();
      lines.dispose();
      marks.dispose();
      disposeObject(scene);
      for (const m of Object.values(materials)) m.dispose();
    },
  };
}
