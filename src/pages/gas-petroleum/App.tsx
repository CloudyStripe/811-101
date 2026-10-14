import { useEffect, useRef, useState } from 'preact/hooks';
import {
  OVERVIEW,
  QUIZZES,
  STOPS,
  TOURS,
  stopById,
  type StopId,
} from '../../../content/utilities/gas-petroleum.ts';
import { Icon } from '../../design/icons.tsx';
import type { ThemeName } from '../../design/tokens.ts';
import type { Box, VisibleArea } from '../../kit3d/camera.ts';
import { parseTier } from '../../kit3d/quality.ts';
import { pageById } from '../../site/pages.ts';
import { SceneLoader } from '../../site/SceneLoader.tsx';
import { reducesMotion } from '../../site/settings.ts';
import { useSettings } from '../../site/useSettings.ts';
import type { DioramaScene, Filter, Rect } from './scene/index.ts';
import type { TimeLapseState } from './scene/timelapse.ts';
import { QUIZ_TITLE, viewSummary, type TourKey } from './summary.ts';
import { Dock } from './ui/Dock.tsx';
import { OverviewPanel, QuizPanel, StopPanel, TourBar, neighbors } from './ui/Panels.tsx';
import { StopLabel } from './ui/StopLabel.tsx';

const PAGE = pageById('gas-petroleum');

const params = new URLSearchParams(location.search);
const STOP_IDS = STOPS.map((s) => s.id);
const INITIAL_STOP: StopId | null = STOP_IDS.find((id) => id === params.get('stop')) ?? null;
const TIER_PARAM = parseTier(params.get('tier'));
const CAPTURE = params.has('capture');
const PERF = params.has('perf');

const NO_WEBGL =
  'This model draws a 3D view with WebGL, which this browser or device has turned off. The guide still works.';

const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
/** Match the layouts in diorama.css: phones, and short screens such as phones held sideways. */
const phoneQuery = matchMedia('(max-width: 760px)');
const shortQuery = matchMedia('(max-height: 580px) and (min-width: 561px)');
const sheetLayout = () => phoneQuery.matches || shortQuery.matches;
/** Phones tall enough that the open sheet leaves the top of the view showing. */
const tallPhoneQuery = matchMedia('(max-width: 760px) and (min-height: 681px)');
/** Layouts where an open sheet covers the whole view. */
const sheetCovers = () => sheetLayout() && !tallPhoneQuery.matches;
/** Wide enough for the guide to start open beside the view. */
const roomyQuery = matchMedia('(min-width: 1280px)');
/** One step of a turn from the dock or the keys, in radians. */
const TURN_STEP = (12 * Math.PI) / 180;
/** Which end of its bounds the overview is turned to, if either: -1 left, 1 right, else 0. */
const edgeOf = (turned: number): -1 | 0 | 1 => (turned <= -0.999 ? -1 : turned >= 0.999 ? 1 : 0);

function resolvedTheme(): ThemeName {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'light' || forced === 'dark') return forced;
  return darkQuery.matches ? 'dark' : 'light';
}

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

interface Tour {
  key: TourKey;
  index: number;
  quiz: boolean;
}

export function App() {
  const [stop, setStop] = useState<StopId | null>(INITIAL_STOP);
  const [tour, setTour] = useState<Tour | null>(null);
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
  /** Which end of its bounds the overview is turned to, if either, so a turn button can stop. */
  const [turned, setTurned] = useState<-1 | 0 | 1>(0);
  const [failed, setFailed] = useState<string | null>(null);
  const [settings] = useSettings();
  const sheet = useSheetLayout();
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<StopId, HTMLElement>());
  const sceneRef = useRef<DioramaScene | null>(null);
  /** The room the view was last framed for, and the stage's size then. */
  const lastArea = useRef<{ area: VisibleArea; size: string } | null>(null);
  const live = useRef({ stop, settings, panelOpen, sheetOpen, paused, filter });
  live.current = { stop, settings, panelOpen, sheetOpen, paused, filter };

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
      if (shortQuery.matches) {
        // Short screens: right of the column of controls.
        const left = (rectOf('.gp-dock')?.right ?? box.left) - box.left + 8;
        return { x: left, y: 0, width: Math.max(160, box.width - left), height: box.height };
      }
      const top = (rectOf('.site-header')?.bottom ?? 0) - box.top;
      if (phoneQuery.matches) {
        // Phones: between the header and the sheet below the view.
        const bottom = (rectOf('.gp-panel')?.top ?? box.bottom) - box.top;
        return { x: 0, y: top, width: box.width, height: Math.max(120, bottom - top) };
      }
      // Wider screens: left of the open panel, the full height, with the dock kept clear, and the
      // closed panel's title bar too.
      const panel = rectOf('.gp-panel');
      const open = live.current.panelOpen;
      const right = Math.max(160, panel && open ? panel.left - box.left - 8 : box.width);
      return {
        x: 0,
        y: top,
        width: right,
        height: Math.max(120, box.height - top),
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
        if (now.stop) scene.show(now.stop, { fly: false });
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
    const scene = sceneRef.current;
    if (scene) {
      scene.show(stop);
      // A stop sets the overview straight again, for when it's back.
      setTurned(edgeOf(scene.turned));
    }
    const url = new URL(location.href);
    if (stop) url.searchParams.set('stop', stop);
    else url.searchParams.delete('stop');
    history.replaceState(null, '', url);
  }, [stop]);

  useEffect(() => {
    sceneRef.current?.setFilter(filter);
  }, [filter]);
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

  /** Opens a stop (or the overview), keeping a tour going if the stop is on it. */
  function open(id: StopId | null) {
    if (tour && id) {
      const index = (TOURS[tour.key].stops as readonly StopId[]).indexOf(id);
      if (index >= 0) setTour({ ...tour, index, quiz: false });
      else setTour(null);
    } else if (tour && !id) {
      setTour(null);
    }
    // A stop on the path the filter hides brings both paths back.
    if (id && filter !== 'both') {
      const path = stopById(id).path;
      if (path !== 'shared' && path !== filter) setFilter('both');
    }
    setStop(id);
    if (sheet) setSheetOpen(true);
    else setPanelOpen(true);
  }

  function startTour(key: TourKey) {
    setTour({ key, index: 0, quiz: false });
    setAnswers([]);
    setFilter(key);
    setStop(TOURS[key].stops[0]);
    if (sheet) setSheetOpen(true);
    else setPanelOpen(true);
  }

  function tourNext() {
    if (!tour) return;
    const n = TOURS[tour.key].stops.length;
    if (tour.quiz) {
      setTour(null);
      setStop(null);
      return;
    }
    if (tour.index < n - 1) {
      const index = tour.index + 1;
      setTour({ ...tour, index });
      setStop(TOURS[tour.key].stops[index] ?? null);
    } else {
      setTour({ ...tour, quiz: true });
      setAnswers(QUIZZES[tour.key].map(() => null));
      setStop(null);
    }
  }

  function tourBack() {
    if (!tour) return;
    if (tour.quiz) {
      setTour({ ...tour, quiz: false });
      setStop(TOURS[tour.key].stops[tour.index] ?? null);
      return;
    }
    if (tour.index > 0) {
      const index = tour.index - 1;
      setTour({ ...tour, index });
      setStop(TOURS[tour.key].stops[index] ?? null);
    }
  }

  /** The way a shared stop leans: the tour's path, the filter's, or natural gas first. */
  const lean: TourKey = tour?.key ?? (filter === 'gasoline' ? 'gasoline' : 'gas');

  // A control in the guide that changes the view is often gone with the old view: a stop on the
  // map, the button to the next stop. Then focus moves to the new view's heading (or, on phones,
  // the sheet's summary), so the reader hears where they are and keeps their place.
  const viewKey = `${stop ?? ''}/${tour?.quiz ? tour.key : ''}`;
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

  // ← and → step through the stops (or a tour's steps), unless focus is in something that uses
  // them: a radio group, a quiz, a field, or the view while it's on the overview, which they turn.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[role="radiogroup"], .q, input, textarea, select')) return;
      if (!stop && target?.closest('canvas')) return;
      const forward = event.key === 'ArrowRight';
      if (tour) {
        if (tour.quiz) return;
        event.preventDefault();
        if (forward) tourNext();
        else tourBack();
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

  /** Turns the overview, and notes whether that reached either end of its bounds. */
  function turnBy(by: number, ease: boolean) {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.turn(by, { ease });
    setTurned(edgeOf(scene.turned));
  }

  /**
   * The canvas: a tap or click opens what's under it; in the overview, a drag across turns the
   * model, as the turn buttons and the arrow keys do. One finger or the main button only.
   */
  const drag = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  function onPointerDown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: false, id: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent) {
    const d = drag.current;
    if (d?.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    // A press that wanders is a drag, not a tap, whichever way it goes.
    if (!d.moved && Math.hypot(dx, event.clientY - d.y) < 6) return;
    d.moved = true;
    d.x = event.clientX;
    d.y = event.clientY;
    if (!live.current.stop) turnBy(-dx * 0.006, false);
  }
  function onPointerUp(event: PointerEvent) {
    const d = drag.current;
    if (d?.id !== event.pointerId) return;
    drag.current = null;
    if (d.moved) return;
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;
    const r = canvas.getBoundingClientRect();
    const id = scene.pick(event.clientX - r.left, event.clientY - r.top);
    if (id) open(id);
  }
  function onCanvasKey(event: KeyboardEvent) {
    if (!sceneRef.current || stop) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      turnBy(event.key === 'ArrowLeft' ? -TURN_STEP : TURN_STEP, true);
    } else if (event.key === 'Home') {
      event.preventDefault();
      sceneRef.current.resetTurn();
      setTurned(0);
    }
  }

  function refreshLabels() {
    sceneRef.current?.refreshLabels();
  }

  function playTimeLapse() {
    // Asked for, it plays even while the rest is paused; the pause stays as the reader set it.
    sceneRef.current?.playTimeLapse();
  }

  const title = tour?.quiz ? QUIZ_TITLE : stop ? stopById(stop).title.text : OVERVIEW.title.text;
  const tourSteps = tour ? (TOURS[tour.key].stops as readonly StopId[]) : null;
  const neighborsNow = stop && !tour ? neighbors(stop, lean) : null;
  const dockPrev = tour
    ? tour.quiz || tour.index > 0
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
  const dockNext = tour
    ? {
        id: null,
        label: tour.quiz
          ? 'Finish the tour'
          : tour.index === (tourSteps?.length ?? 0) - 1
            ? 'Take the quiz'
            : 'Next step',
      }
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
        <p class="sheet-summary" tabIndex={-1}>
          {viewSummary(stop, tour?.quiz ? tour.key : null)}
        </p>
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
        {tour?.quiz ? (
          <QuizPanel
            tour={tour.key}
            answers={answers}
            onAnswer={(q, o) => {
              setAnswers((a) => a.map((v, i) => (i === q ? o : v)));
            }}
            onTour={startTour}
          />
        ) : stop ? (
          <StopPanel
            stop={stop}
            touring={tour !== null}
            lean={lean}
            timeLapse={timeLapse}
            onPlayTimeLapse={playTimeLapse}
            onOpen={open}
          />
        ) : (
          <OverviewPanel onOpen={open} onTour={startTour} />
        )}
      </div>
      {tour && (
        <TourBar
          tour={tour.key}
          index={tour.index}
          quiz={tour.quiz}
          onBack={tourBack}
          onNext={tourNext}
        />
      )}
    </aside>
  );

  const dock = (
    <Dock
      key="dock"
      filter={filter}
      onFilter={setFilter}
      paused={paused}
      onPause={setPaused}
      stop={tour?.quiz ? null : stop}
      prev={dockPrev}
      next={dockNext}
      onPrev={() => {
        if (tour) tourBack();
        else if (dockPrev?.id) open(dockPrev.id);
      }}
      onNext={() => {
        if (tour) tourNext();
        else if (dockNext?.id) open(dockNext.id);
      }}
      onOverview={() => {
        open(null);
      }}
      onTurn={(direction) => {
        turnBy(direction * TURN_STEP, true);
      }}
      onReset={() => {
        sceneRef.current?.resetTurn();
        setTurned(0);
      }}
      turned={turned}
    />
  );

  return (
    <div
      class="gp-grid"
      data-sheet={sheetOpen ? 'open' : 'closed'}
      data-panel={panelOpen ? 'open' : 'closed'}
    >
      <main class="stage" ref={stageRef} inert={sheet && sheetOpen && sheetCovers()}>
        <canvas
          ref={canvasRef}
          class="gp-canvas"
          role="img"
          tabIndex={0}
          aria-label="3D model of how natural gas and gasoline are made, moved and used. In the overview, the arrow keys turn it and Home sets it straight."
          aria-describedby="gp-status"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
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

      {failed && (
        <p class="stage-message" role="status">
          {failed}
        </p>
      )}

      {/* The controls in reading order, which is their tab order, for the layout. */}
      {sheet ? [panel, dock] : [dock, panel]}

      <p id="gp-status" class="sr-only" role="status">
        {viewSummary(stop, tour?.quiz ? tour.key : null)}
      </p>
    </div>
  );
}
