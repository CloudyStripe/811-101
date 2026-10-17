import { useEffect, useRef, useState } from 'preact/hooks';
import {
  OVERVIEW,
  QUIZZES,
  STOPS,
  stopById,
  type StopId,
} from '../../../content/utilities/gas-petroleum.ts';
import { Icon } from '../../design/icons.tsx';
import type { Box, VisibleArea } from '../../kit3d/camera.ts';
import { TAP_SLOP } from '../../kit3d/input.ts';
import { parseTier } from '../../kit3d/quality.ts';
import { pageById } from '../../site/pages.ts';
import { SceneLoader } from '../../site/SceneLoader.tsx';
import { reducesMotion } from '../../site/settings.ts';
import { darkQuery, resolvedTheme } from '../../site/theme.ts';
import { useSettings } from '../../site/useSettings.ts';
import type { AtLimits, DioramaScene, Filter, Rect } from './scene/index.ts';
import {
  FORK,
  PATHS,
  SHARED,
  back,
  begin,
  choose,
  forward,
  fromFork,
  reach,
  stopAt,
  stopsOf,
  type Journey,
  type PathKey,
} from './journey.ts';
import type { TimeLapseState } from './scene/timelapse.ts';
import { QUIZ_TITLE, viewSummary } from './summary.ts';
import { Dock } from './ui/Dock.tsx';
import {
  JourneyBar,
  JourneyStrip,
  OverviewPanel,
  QuizPanel,
  StopPanel,
  neighbors,
} from './ui/Panels.tsx';
import { StopLabel } from './ui/StopLabel.tsx';
import { ViewControls } from './ui/ViewControls.tsx';

const PAGE = pageById('gas-petroleum');

const params = new URLSearchParams(location.search);
const STOP_IDS = STOPS.map((s) => s.id);
const INITIAL_STOP: StopId | null = STOP_IDS.find((id) => id === params.get('stop')) ?? null;
const TIER_PARAM = parseTier(params.get('tier'));
const CAPTURE = params.has('capture');
const PERF = params.has('perf');
/** The overview's landmarks, named in the view: where it starts, the fork, and each path's end. */
const LANDMARKS: readonly StopId[] = [
  SHARED[0] ?? FORK,
  FORK,
  ...PATHS.flatMap((path) => stopsOf(path).slice(-1)),
];
/** What lands the establishing move: any input at all. */
const LAND_ON = ['pointerdown', 'keydown', 'wheel'] as const;

const NO_WEBGL =
  'This model draws a 3D view with WebGL, which this browser or device has turned off. The guide still works.';

const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
/** Match the layouts in diorama.css: phones, and short screens such as phones held sideways. */
const phoneQuery = matchMedia('(max-width: 760px)');
const shortQuery = matchMedia('(max-height: 580px) and (min-width: 561px)');
const sheetLayout = () => phoneQuery.matches || shortQuery.matches;
/** Phones tall enough that the open sheet leaves the top of the view showing. */
const tallPhoneQuery = matchMedia('(max-width: 760px) and (min-height: 681px)');
/**
 * Layouts where an open sheet covers the whole view: a small phone held upright. Held sideways, the
 * sheet takes the view's column, and the view moves to the column it leaves, above the dock.
 */
const sheetCovers = () => phoneQuery.matches && !shortQuery.matches && !tallPhoneQuery.matches;
/** Wide enough for the guide to start open beside the view. */
const roomyQuery = matchMedia('(min-width: 1280px)');
/** A screen worked by touch: the hint says to pinch, not scroll. */
const touchQuery = matchMedia('(pointer: coarse)');
/** Two taps this close in time (ms) and place (px) on open ground center the view there. */
const DOUBLE_TAP = { ms: 350, px: 24 };
/** No limits reached: where the camera starts, as far as the buttons know. */
const FREE: AtLimits = { tiltUp: false, tiltDown: false, zoomIn: false, zoomOut: false };

const rectOf = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();

function rectWithin(el: Element, container: DOMRect): Rect | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return {
    x: r.left - container.left - 6,
    y: r.top - container.top - 6,
    w: r.width + 12,
    h: r.height + 12,
  };
}

/** The shown controls over the view, as boxes in the view's own pixels. */
function controlsOver(box: DOMRect, selectors: readonly string[]): Box[] {
  return selectors.flatMap((selector) => {
    const r = rectOf(selector);
    if (!r || r.width === 0 || r.height === 0) return [];
    return [
      {
        x: r.left - box.left - 8,
        y: r.top - box.top - 8,
        width: r.width + 16,
        height: r.height + 16,
      },
    ];
  });
}

/** Whether the guide is a sheet in the layout now, kept up to date as the screen changes. */
function useSheetLayout(): boolean {
  const [sheet, setSheet] = useState(sheetLayout);
  useEffect(() => {
    const update = () => {
      setSheet(sheetLayout());
    };
    phoneQuery.addEventListener('change', update);
    shortQuery.addEventListener('change', update);
    return () => {
      phoneQuery.removeEventListener('change', update);
      shortQuery.removeEventListener('change', update);
    };
  }, []);
  return sheet;
}

export function App() {
  const [stop, setStop] = useState<StopId | null>(INITIAL_STOP);
  /** The story under way, from Start or a tour button; null while the reader roams freely. */
  const [journey, setJourney] = useState<Journey | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [filter, setFilter] = useState<Filter>('both');
  const [paused, setPaused] = useState(false);
  const [panelOpen, setPanelOpen] = useState(roomyQuery.matches);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [timeLapse, setTimeLapse] = useState<TimeLapseState>({
    playing: false,
    progress: 1,
    ma: 0,
    caption: 5,
  });
  /** The limits the camera stands at, so a camera button says when its move goes no further. */
  const [limits, setLimits] = useState<AtLimits>(FREE);
  /** The 3D view is built, and shows. */
  const [ready, setReady] = useState(false);
  /** The reader has moved the camera this visit: the first-move hint is done with. */
  const [moved, setMoved] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [settings] = useSettings();
  const sheet = useSheetLayout();
  /** The open sheet covers the view: the view, its buttons and the hint are out of reach under it. */
  const covered = sheet && sheetOpen && sheetCovers();
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<StopId, HTMLElement>());
  const sceneRef = useRef<DioramaScene | null>(null);
  /** The room the view was last framed for, and the stage's size then. */
  const lastArea = useRef<{ area: VisibleArea; size: string } | null>(null);
  /** The way a shared stop leans: the journey's path, the filter's, or natural gas first. */
  const lean: PathKey = journey?.path ?? (filter === 'gasoline' ? 'gasoline' : 'gas');
  /** The stops whose labels the view names: where it is and where it goes next, or landmarks. */
  const named: readonly StopId[] = stop ? [stop, ...neighbors(stop, lean).next] : LANDMARKS;
  const live = useRef({ stop, settings, panelOpen, sheetOpen, paused, filter, named });
  live.current = { stop, settings, panelOpen, sheetOpen, paused, filter, named };

  // Build the 3D scene once, after first paint; it lives in its own lazy chunk.
  useEffect(() => {
    // An object, so the cleanup's write is visible after each await.
    const life = { cancelled: false };
    const cancelled = () => life.cancelled;
    let scene: DioramaScene | null = null;
    const canvas = canvasRef.current;
    const stageEl = stageRef.current;
    const detailLayer = detailRef.current;
    if (!canvas || !stageEl || !detailLayer) return;

    const noGo = (): Rect[] => {
      const box = stageEl.getBoundingClientRect();
      return [...document.querySelectorAll('[data-chrome]')].flatMap(
        (el) => rectWithin(el, box) ?? [],
      );
    };
    /** The part of the 3D view the controls leave free, which the camera frames. */
    const visibleArea = (): VisibleArea => {
      const box = stageEl.getBoundingClientRect();
      const size = `${String(box.width)}x${String(box.height)}`;
      // Where an open sheet covers the view, the framing stays as it was, unless the screen itself
      // changed (a rotation); closing the sheet then frames the view afresh.
      const last = lastArea.current;
      if (live.current.sheetOpen && sheetCovers() && last?.size === size) return last.area;
      const area = freeArea(box);
      lastArea.current = { area, size };
      return area;
    };
    const freeArea = (box: DOMRect): VisibleArea => {
      // The camera's buttons sit in the view's lower right corner on every layout: the view is
      // framed above them, as it is beside the guide, so nothing it frames sits under them.
      const buttons = rectOf('.gp-camera');
      const above = (bottom: number) =>
        buttons ? Math.min(bottom, buttons.top - box.top - 8) : bottom;
      if (shortQuery.matches) {
        const dock = rectOf('.gp-dock');
        if (live.current.sheetOpen) {
          // Short screens, the sheet open in the view's column: the column it left, above the dock.
          const top = (rectOf('.site-header')?.bottom ?? 0) - box.top;
          const x = (dock?.left ?? box.left) - box.left;
          const bottom = (dock?.top ?? box.bottom) - box.top - 8;
          return {
            x,
            y: top,
            width: Math.max(160, dock?.width ?? box.width / 2),
            height: Math.max(120, bottom - top),
          };
        }
        // Short screens: right of the column of controls, above the camera's buttons.
        const left = (dock?.right ?? box.left) - box.left + 8;
        return {
          x: left,
          y: 0,
          width: Math.max(160, box.width - left),
          height: Math.max(120, above(box.height)),
        };
      }
      const top = (rectOf('.site-header')?.bottom ?? 0) - box.top;
      if (phoneQuery.matches) {
        // Phones: between the header and the camera's buttons, over the sheet.
        const bottom = (rectOf('.gp-panel')?.top ?? box.bottom) - box.top;
        return {
          x: 0,
          y: top,
          width: box.width,
          height: Math.max(120, above(bottom) - top),
        };
      }
      // Wider screens: left of the open panel, above the camera's buttons, with the dock kept
      // clear, and the closed panel's title bar too.
      const panel = rectOf('.gp-panel');
      const open = live.current.panelOpen;
      const right = Math.max(160, panel && open ? panel.left - box.left - 8 : box.width);
      return {
        x: 0,
        y: top,
        width: right,
        height: Math.max(120, above(box.height) - top),
        keepOut: controlsOver(box, open ? ['.gp-dock'] : ['.gp-dock', '.gp-panel']),
      };
    };

    void (async () => {
      if (!document.createElement('canvas').getContext('webgl2')) {
        setFailed(NO_WEBGL);
        return;
      }
      try {
        document.documentElement.dataset.sceneStage = 'code';
        const { createDioramaScene } = await import('./scene/index.ts');
        document.documentElement.dataset.sceneStage = 'build';
        if (CAPTURE) await document.fonts.ready;
        if (cancelled()) return;
        const s = live.current.settings;
        scene = await createDioramaScene({
          canvas,
          labelElements: labelRefs.current,
          detailLayer,
          tier: TIER_PARAM ?? s.quality,
          theme: resolvedTheme(),
          reducedMotion: reducesMotion(s.motion, reducedMotionQuery.matches),
          capture: CAPTURE,
          perf: PERF,
          visibleArea,
          noGo,
          onTimeLapse: setTimeLapse,
          onLimits: setLimits,
          onMoved: () => {
            setMoved(true);
          },
          onContextLost: () => {
            setFailed(
              "The 3D view paused because the graphics context was lost. It usually comes back on its own; if it doesn't, reload the page.",
            );
          },
          onContextRestored: () => {
            setFailed(null);
          },
        });
        if (cancelled()) {
          scene.dispose();
          return;
        }
        sceneRef.current = scene;
        const now = live.current;
        scene.setTheme(resolvedTheme());
        scene.setReducedMotion(reducesMotion(now.settings.motion, reducedMotionQuery.matches));
        scene.setPaused(now.paused);
        scene.setFilter(now.filter);
        scene.nameLabels(now.named);
        setLimits(scene.limits);
        setReady(true);
        if (now.stop) scene.show(now.stop, { fly: false });
        else {
          // Arriving: the view comes in from farther out, unless motion is reduced; any input
          // lands it at once.
          scene.establish();
          for (const type of LAND_ON) window.addEventListener(type, land, true);
        }
        if (!TIER_PARAM && now.settings.quality !== s.quality)
          void scene.setTier(now.settings.quality);
        void document.fonts.ready.then(() => {
          scene?.relayout();
        });
      } catch (error) {
        console.error(error);
        setFailed(
          "The 3D view couldn't load. Reload the page to try again. The guide still works.",
        );
      }
    })();

    function land() {
      scene?.land();
      for (const type of LAND_ON) window.removeEventListener(type, land, true);
    }
    const onTheme = () => scene?.setTheme(resolvedTheme());
    const onMotion = () => {
      scene?.setReducedMotion(
        reducesMotion(live.current.settings.motion, reducedMotionQuery.matches),
      );
    };
    const onPageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) scene?.dispose();
    };
    darkQuery.addEventListener('change', onTheme);
    reducedMotionQuery.addEventListener('change', onMotion);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      life.cancelled = true;
      darkQuery.removeEventListener('change', onTheme);
      reducedMotionQuery.removeEventListener('change', onMotion);
      window.removeEventListener('pagehide', onPageHide);
      for (const type of LAND_ON) window.removeEventListener(type, land, true);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // The view follows the open stop; the address does too, so a link shares it.
  const firstStop = useRef(true);
  useEffect(() => {
    if (firstStop.current) {
      firstStop.current = false;
      return;
    }
    sceneRef.current?.show(stop);
    const url = new URL(location.href);
    if (stop) url.searchParams.set('stop', stop);
    else url.searchParams.delete('stop');
    history.replaceState(null, '', url);
  }, [stop]);

  useEffect(() => {
    sceneRef.current?.setFilter(filter);
  }, [filter]);
  const namedKey = named.join(' ');
  useEffect(() => {
    sceneRef.current?.nameLabels(live.current.named);
  }, [namedKey]);
  useEffect(() => {
    sceneRef.current?.setPaused(paused);
  }, [paused]);
  useEffect(() => {
    const scene = sceneRef.current;
    scene?.setTheme(resolvedTheme());
    scene?.setReducedMotion(reducesMotion(settings.motion, reducedMotionQuery.matches));
  }, [settings.theme, settings.motion]);
  useEffect(() => {
    if (!TIER_PARAM) void sceneRef.current?.setTier(settings.quality);
  }, [settings.quality]);

  // Opening or closing the panel or the sheet changes the view's room; it glides there. Where the
  // open sheet covers the view, the view holds still under it until it closes. The first run is the
  // scene's own first framing, so only later changes glide.
  const firstSheet = useRef(true);
  useEffect(() => {
    if (firstSheet.current) {
      firstSheet.current = false;
      return;
    }
    if (!(sheetOpen && sheetCovers())) sceneRef.current?.relayout(true);
  }, [sheetOpen]);
  const firstPanel = useRef(true);
  useEffect(() => {
    if (firstPanel.current) {
      firstPanel.current = false;
      return;
    }
    sceneRef.current?.relayout(true);
  }, [panelOpen]);

  /** Shows the guide: the panel beside the view, or on phones, the sheet. */
  function showGuide() {
    if (sheet) setSheetOpen(true);
    else setPanelOpen(true);
  }

  /**
   * Opens a stop (or the overview) from the map, a label or the stop's own links. A journey under
   * way goes on if the stop is on its way, and going down a path chooses it; anywhere else, it ends.
   */
  function open(id: StopId | null) {
    const next = journey && id ? reach(journey, id) : null;
    if (journey) setJourney(next);
    if (next?.path && next.path !== journey?.path) {
      // Going down a path chose it: the view shows it, as the fork's choice does.
      setFilter(next.path);
    } else if (id && filter !== 'both') {
      // A stop on the path the filter hides brings both paths back.
      const path = stopById(id).path;
      if (path !== 'shared' && path !== filter) setFilter('both');
    }
    setStop(id);
    showGuide();
  }

  /** Starts a journey: from the start (Start, or a tour button's path), or a path from the fork. */
  function beginJourney(next: Journey) {
    setJourney(next);
    setAnswers([]);
    setFilter(next.path ?? 'both');
    setStop(stopAt(next));
    showGuide();
  }

  /**
   * Moves the journey to `next`, and the view with it; its quiz starts with no answers. Arriving
   * at the fork with no path chosen, the guide shows, since the way on is its choice.
   */
  function walk(next: Journey | null) {
    if (!next) return;
    if (next.quiz && next.path && !journey?.quiz) setAnswers(QUIZZES[next.path].map(() => null));
    setJourney(next);
    setStop(stopAt(next));
    if (waitsAtFork(next)) showGuide();
  }

  /** At the fork, with the path still to choose. */
  const waitsAtFork = (j: Journey | null) => j !== null && j.path === null && stopAt(j) === FORK;

  /** Asked for from the dock: the guide, and focus on the fork's first way on. */
  const focusChoice = useRef(false);
  function toChoice() {
    const way = document.querySelector<HTMLElement>('.fork-way');
    // Already showing: focus goes there now; else once the guide has opened.
    if (way && way.offsetParent !== null) {
      way.focus();
      return;
    }
    focusChoice.current = true;
    showGuide();
  }
  useEffect(() => {
    if (!focusChoice.current) return;
    focusChoice.current = false;
    document.querySelector<HTMLElement>('.fork-way')?.focus();
  });

  /** On a step: after the quiz, the journey ends in the overview. */
  function journeyNext() {
    if (!journey) return;
    if (journey.quiz) {
      setJourney(null);
      setStop(null);
      return;
    }
    walk(forward(journey));
  }

  function journeyBack() {
    if (journey) walk(back(journey));
  }

  /** At the fork: on along the path chosen, which the view then shows. */
  function choosePath(path: PathKey) {
    if (journey) {
      setFilter(path);
      walk(choose(path));
    } else {
      open(stopsOf(path)[SHARED.length] ?? FORK);
    }
  }

  // A control in the guide that changes the view is often gone with the old view: a stop on the
  // map, the button to the next stop. Then focus moves to the new view's heading (or, on phones,
  // the sheet's summary), so the reader hears where they are and keeps their place.
  const viewKey = `${stop ?? ''}/${journey?.quiz ? (journey.path ?? '') : ''}`;
  const shownView = useRef(viewKey);
  useEffect(() => {
    if (shownView.current === viewKey) return;
    shownView.current = viewKey;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const heading = [
      ...document.querySelectorAll<HTMLElement>('#gp-title, .gp-panel .sheet-summary'),
    ].find((el) => el.offsetParent !== null);
    heading?.focus({ preventScroll: true });
  }, [viewKey]);

  // ← and → step through the stops (or a journey's steps), unless focus is in something that uses
  // them: a radio group, a quiz, a field, or the view, which they turn.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[role="radiogroup"], .q, .tl-controls, input, textarea, select')) return;
      if (target?.closest('canvas')) return;
      const forward = event.key === 'ArrowRight';
      if (journey) {
        if (journey.quiz) return;
        event.preventDefault();
        if (forward) journeyNext();
        else journeyBack();
        return;
      }
      if (!stop) return;
      const { prev, next } = neighbors(stop, lean);
      const to = forward ? (lean === 'gasoline' && next.length > 1 ? next[1] : next[0]) : prev;
      if (to) {
        event.preventDefault();
        open(to);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  });

  /**
   * The canvas: a tap or click opens what's under it, and twice on open ground centers the view
   * there. Drags, the wheel and pinches move the camera (the scene's own); a press that wanders,
   * or that another finger joins, is one of those, not a tap.
   */
  const press = useRef<{ x: number; y: number; id: number; joined: boolean } | null>(null);
  const lastTap = useRef<{ x: number; y: number; at: number } | null>(null);
  function onPointerDown(event: PointerEvent) {
    if (press.current) press.current.joined = true;
    if (!event.isPrimary || event.button !== 0) return;
    press.current = { x: event.clientX, y: event.clientY, id: event.pointerId, joined: false };
  }
  function onPointerUp(event: PointerEvent) {
    const p = press.current;
    if (p?.id !== event.pointerId) return;
    press.current = null;
    if (p.joined || Math.hypot(event.clientX - p.x, event.clientY - p.y) >= TAP_SLOP) return;
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;
    const r = canvas.getBoundingClientRect();
    const x = event.clientX - r.left;
    const y = event.clientY - r.top;
    const id = scene.pick(x, y);
    if (id) {
      lastTap.current = null;
      open(id);
      return;
    }
    const last = lastTap.current;
    const now = performance.now();
    if (
      last &&
      now - last.at < DOUBLE_TAP.ms &&
      Math.hypot(x - last.x, y - last.y) < DOUBLE_TAP.px
    ) {
      lastTap.current = null;
      scene.centerAt(x, y);
      setMoved(true);
    } else {
      lastTap.current = { x, y, at: now };
    }
  }
  /**
   * With the view focused: the arrows turn and tilt it, + and − zoom, Shift and the arrows pan,
   * and Home sets it back.
   */
  function onCanvasKey(event: KeyboardEvent) {
    const scene = sceneRef.current;
    if (!scene || event.altKey || event.ctrlKey || event.metaKey) return;
    const pan = event.shiftKey;
    const moves: Record<string, (() => void) | undefined> = {
      ArrowLeft: () => {
        if (pan) scene.pan(-1, 0);
        else scene.turn(-1);
      },
      ArrowRight: () => {
        if (pan) scene.pan(1, 0);
        else scene.turn(1);
      },
      ArrowUp: () => {
        if (pan) scene.pan(0, 1);
        else scene.tilt(1);
      },
      ArrowDown: () => {
        if (pan) scene.pan(0, -1);
        else scene.tilt(-1);
      },
      '+': () => {
        scene.zoom(1);
      },
      '=': () => {
        scene.zoom(1);
      },
      '-': () => {
        scene.zoom(-1);
      },
      _: () => {
        scene.zoom(-1);
      },
      Home: () => {
        scene.resetView();
      },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
    setMoved(true);
  }

  function refreshLabels() {
    sceneRef.current?.refreshLabels();
  }

  function playTimeLapse() {
    // Asked for, it plays even while the rest is paused; the pause stays as the reader set it.
    sceneRef.current?.playTimeLapse();
  }

  const quizPath = journey?.quiz ? journey.path : null;
  const title = quizPath ? QUIZ_TITLE : stop ? stopById(stop).title.text : OVERVIEW.title.text;
  const neighborsNow = stop && !journey ? neighbors(stop, lean) : null;
  const journeyAhead = journey && !journey.quiz ? forward(journey) : null;
  const dockPrev = journey
    ? back(journey)
      ? { id: null, label: 'Back' }
      : null
    : neighborsNow?.prev
      ? { id: neighborsNow.prev, label: `Previous stop: ${stopById(neighborsNow.prev).label}` }
      : null;
  const nextId = neighborsNow
    ? ((lean === 'gasoline' && neighborsNow.next.length > 1
        ? neighborsNow.next[1]
        : neighborsNow.next[0]) ?? null)
    : null;
  // In the quiz the dock is the overview's, so a journey's next is a step, the quiz, or the choice.
  const dockNext = journey
    ? journeyAhead
      ? { id: null, label: journeyAhead.quiz ? 'Take the quiz' : 'Next step' }
      : waitsAtFork(journey)
        ? { id: null, label: 'Choose a path' }
        : null
    : nextId
      ? { id: nextId, label: `Next stop: ${stopById(nextId).label}` }
      : null;

  const panel = (
    <aside
      key="panel"
      class="gp-panel"
      aria-labelledby="gp-title"
      data-open={sheetOpen ? '' : undefined}
      data-collapsed={panelOpen ? undefined : ''}
      data-chrome
    >
      <div class="sheet-bar">
        <div class="sheet-where">
          <p class="sheet-summary" tabIndex={-1}>
            {viewSummary(stop, quizPath)}
          </p>
          {journey && <JourneyStrip journey={journey} />}
        </div>
        <button
          type="button"
          class="sheet-toggle"
          aria-expanded={sheetOpen}
          aria-controls="gp-body"
          onClick={() => {
            setSheetOpen(!sheetOpen);
          }}
        >
          Details
          <Icon name={sheetOpen ? 'chevron-down' : 'chevron-up'} />
        </button>
      </div>
      <div class="panel-head">
        <h2 id="gp-title" class="panel-title" tabIndex={-1}>
          {title}
        </h2>
        <button
          type="button"
          class="icon-button"
          aria-label={panelOpen ? 'Close the guide' : 'Open the guide'}
          title={panelOpen ? 'Close the guide' : 'Open the guide'}
          aria-expanded={panelOpen}
          aria-controls="gp-body"
          onClick={() => {
            setPanelOpen(!panelOpen);
          }}
        >
          <Icon name={panelOpen ? 'close' : 'chevron-down'} />
        </button>
      </div>
      <div class="panel-body" id="gp-body">
        {quizPath ? (
          <QuizPanel
            path={quizPath}
            answers={answers}
            onAnswer={(q, o) => {
              setAnswers((a) => a.map((v, i) => (i === q ? o : v)));
            }}
            onOtherPath={(path) => {
              beginJourney(fromFork(path));
            }}
          />
        ) : stop ? (
          <StopPanel
            stop={stop}
            journey={journey}
            lean={lean}
            hasView={failed === null}
            timeLapse={timeLapse}
            onPlayTimeLapse={playTimeLapse}
            onStepTimeLapse={(step) => sceneRef.current?.stepTimeLapse(step)}
            onOpen={open}
            onChoose={choosePath}
          />
        ) : (
          <OverviewPanel
            onStart={() => {
              beginJourney(begin());
            }}
            onTour={(path) => {
              beginJourney(begin(path));
            }}
            onOpen={open}
          />
        )}
      </div>
      {journey && <JourneyBar journey={journey} onBack={journeyBack} onNext={journeyNext} />}
    </aside>
  );

  const dock = (
    <Dock
      key="dock"
      filter={filter}
      onFilter={setFilter}
      paused={paused}
      onPause={setPaused}
      stop={quizPath ? null : stop}
      prev={dockPrev}
      next={dockNext}
      onPrev={() => {
        if (journey) journeyBack();
        else if (dockPrev?.id) open(dockPrev.id);
      }}
      onNext={() => {
        if (waitsAtFork(journey)) toChoice();
        else if (journey) journeyNext();
        else if (dockNext?.id) open(dockNext.id);
      }}
      onOverview={() => {
        open(null);
      }}
    />
  );

  /** Any camera button: the camera moves, and the hint is done with. */
  const moveBy = (move: (scene: DioramaScene) => void) => {
    const scene = sceneRef.current;
    if (!scene) return;
    move(scene);
    setMoved(true);
  };

  return (
    <div
      class="gp-grid"
      data-sheet={sheetOpen ? 'open' : 'closed'}
      data-panel={panelOpen ? 'open' : 'closed'}
    >
      <main class="stage" ref={stageRef} inert={covered}>
        <canvas
          ref={canvasRef}
          class="gp-canvas"
          role="img"
          tabIndex={0}
          aria-label="3D model of how natural gas and gasoline are made, moved and used. Drag to turn it, scroll or pinch to zoom, and right-drag or use two fingers to move it. With it focused, the arrow keys turn and tilt it, plus and minus zoom, Shift and the arrows move it, and Home sets it back."
          aria-describedby="gp-status"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            press.current = null;
          }}
          onKeyDown={onCanvasKey}
        />
        <SceneLoader page={PAGE} done={failed !== null} />
        {/*
          A label out of sight for want of room shows as soon as it has focus. The small labels on
          a stop's parts come first, so the stops' own labels, which are buttons, sit over them.
        */}
        <div
          class="labels"
          hidden={failed !== null}
          onFocusIn={refreshLabels}
          onFocusOut={refreshLabels}
        >
          <div class="details" ref={detailRef} />
          {STOP_IDS.map((id) => (
            <StopLabel
              key={id}
              id={id}
              current={stop === id}
              register={(el) => {
                if (el) labelRefs.current.set(id, el);
                else labelRefs.current.delete(id);
              }}
              onOpen={open}
            />
          ))}
        </div>
      </main>

      {/*
        Until the first move: how to move the view, which labels keep clear of. It never takes the
        pointer, and holds its place out of sight until the view is built.
      */}
      {failed === null && (
        <p
          class="gp-hint"
          aria-hidden="true"
          data-ready={ready ? '' : undefined}
          data-covered={covered ? '' : undefined}
          data-gone={moved ? '' : undefined}
          data-chrome={moved ? undefined : ''}
        >
          {touchQuery.matches ? 'Drag to turn · Pinch to zoom' : 'Drag to turn · Scroll to zoom'}
        </p>
      )}

      {failed === null && (
        <ViewControls
          ready={ready}
          covered={covered}
          limits={limits}
          onZoom={(direction) => {
            moveBy((scene) => {
              scene.zoom(direction);
            });
          }}
          onTurn={(direction) => {
            moveBy((scene) => {
              scene.turn(direction);
            });
          }}
          onTilt={(direction) => {
            moveBy((scene) => {
              scene.tilt(direction);
            });
          }}
          onReset={() => {
            moveBy((scene) => {
              scene.resetView();
            });
          }}
        />
      )}

      {failed && (
        <p class="stage-message" role="status">
          {failed}
        </p>
      )}

      {/* The controls in reading order, which is their tab order, for the layout. */}
      {sheet ? [panel, dock] : [dock, panel]}

      <p id="gp-status" class="sr-only" role="status">
        {viewSummary(stop, quizPath)}
      </p>
    </div>
  );
}
