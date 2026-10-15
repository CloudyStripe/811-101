import { useEffect, useRef, useState } from 'preact/hooks';
import { FREQUENCIES, type Frequency } from '../../../config/equipment.ts';
import { ABOUT, TAGLINE } from '../../../content/training/frequency-lab.ts';
import { Dialog } from '../../design/Dialog.tsx';
import { Rich } from '../../design/Term.tsx';
import type { ThemeName } from '../../design/tokens.ts';
import type { Box, VisibleArea } from '../../kit3d/camera.ts';
import { parseTier } from '../../kit3d/quality.ts';
import type { SetupId } from '../../signal/model.ts';
import { Legend } from './Legend.tsx';
import { Panel, define } from './Panel.tsx';
import { SceneLabel } from './SceneLabel.tsx';
import type { LabScene, Rect } from './scene/index.ts';
import { LABEL_SPECS, type LabelId } from './scene/labels.ts';
import { pageById } from '../../site/pages.ts';
import { SceneLoader } from '../../site/SceneLoader.tsx';
import { reducesMotion } from '../../site/settings.ts';
import { useSettings } from '../../site/useSettings.ts';
import { stateSummary } from './summary.ts';
import { TransmitterDock } from './TransmitterDock.tsx';

const PAGE = pageById('frequency-lab');

const params = new URLSearchParams(location.search);
const INITIAL_SETUP: SetupId = params.get('setup') === 'plastic' ? 'plastic' : 'steel';
const INITIAL_FREQUENCY: Frequency =
  FREQUENCIES.find((f) => String(f) === params.get('f')) ?? FREQUENCIES[0];
/** `?tier=` pins a quality tier over the saved setting, for tests and comparisons. */
const TIER_PARAM = parseTier(params.get('tier'));
const CAPTURE = params.has('capture');
const PERF = params.has('perf');

const NO_WEBGL =
  'This lab draws a 3D view with WebGL, which this browser or device has turned off. The controls and explanations still work.';

const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
/** Match the layouts in lab.css: phones, and short screens such as phones held sideways. */
const phoneQuery = matchMedia('(max-width: 760px)');
const shortQuery = matchMedia('(max-height: 580px) and (min-width: 561px)');
/** Layouts where the guide is a sheet that opens over the 3D view. */
const sheetLayout = () => phoneQuery.matches || shortQuery.matches;
/** Phones tall enough to keep some of the view above an open sheet. */
const tallPhoneQuery = matchMedia('(max-width: 760px) and (min-height: 681px)');
/** Layouts where an open sheet covers the whole view. */
const sheetCovers = () => sheetLayout() && !tallPhoneQuery.matches;
/** Wide enough for the guide to start open beside the view; narrower, it starts closed. */
const roomyQuery = matchMedia('(min-width: 1280px)');

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

function resolvedTheme(): ThemeName {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'light' || forced === 'dark') return forced;
  return darkQuery.matches ? 'dark' : 'light';
}

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

const rectOf = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();

/** The shown controls over the view, as boxes in the view's own pixels, with room around them. */
function controlsOver(box: DOMRect, selectors: readonly string[]): Box[] {
  return selectors.flatMap((selector) => {
    const r = rectOf(selector);
    if (!r || r.width === 0 || r.height === 0) return [];
    const pad = 8;
    return [
      {
        x: r.left - box.left - pad,
        y: r.top - box.top - pad,
        width: r.width + 2 * pad,
        height: r.height + 2 * pad,
      },
    ];
  });
}

export function App() {
  const [setup, setSetup] = useState<SetupId>(INITIAL_SETUP);
  const [frequency, setFrequency] = useState<Frequency>(INITIAL_FREQUENCY);
  // Changed in the header's settings menu; the scene follows.
  const [settings] = useSettings();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Wide screens: the guide panel starts open where there's room, and closes down to its title.
  const [panelOpen, setPanelOpen] = useState(roomyQuery.matches);
  // The reader can pause the signal's motion, whatever the motion setting (WCAG 2.2.2).
  const [paused, setPaused] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  // The key's rows find lines in the view once there's a view to find them in.
  const [sceneReady, setSceneReady] = useState(false);
  const sheet = useSheetLayout();
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef(new Map<LabelId, HTMLElement>());
  const sceneRef = useRef<LabScene | null>(null);
  // The scene's callbacks outlive renders, so they read current state from here.
  const live = useRef({ setup, frequency, settings, sheetOpen, panelOpen, paused });
  live.current = { setup, frequency, settings, sheetOpen, panelOpen, paused };
  const lastArea = useRef<{ area: VisibleArea; size: string } | null>(null);

  // Build the 3D scene once, after first paint; it lives in its own lazy chunk.
  useEffect(() => {
    // An object, so the cleanup's write is visible after each await.
    const life = { cancelled: false };
    const cancelled = () => life.cancelled;
    let scene: LabScene | null = null;
    const canvas = canvasRef.current;
    const stageEl = stageRef.current;
    if (!canvas || !stageEl) return;

    const noGo = (): Rect[] => {
      const box = stageEl.getBoundingClientRect();
      return [...document.querySelectorAll('[data-chrome]')].flatMap(
        (el) => rectWithin(el, box) ?? [],
      );
    };
    /** The part of the 3D view the chrome leaves free, which the camera frames. */
    const visibleArea = (): VisibleArea => {
      const box = stageEl.getBoundingClientRect();
      const size = `${String(box.width)}x${String(box.height)}`;
      // Where an open sheet covers the view, the framing stays as it was, unless the screen itself
      // changed (a rotation); closing the sheet then frames the view afresh. On taller phones the
      // sheet leaves the top of the view, and the view is framed again there.
      const last = lastArea.current;
      if (live.current.sheetOpen && sheetCovers() && last?.size === size) return last.area;
      const area = freeArea(box);
      lastArea.current = { area, size };
      return area;
    };
    const freeArea = (box: DOMRect): VisibleArea => {
      if (shortQuery.matches) {
        // Short screens: right of the column of controls.
        const left = (rectOf('.lab-dock')?.right ?? box.left) - box.left + 8;
        return { x: left, y: 0, width: Math.max(160, box.width - left), height: box.height };
      }
      // Below the site header, and on wider screens below the lede too.
      const top =
        Math.max(rectOf('.site-header')?.bottom ?? 0, rectOf('.lab-lede')?.bottom ?? 0) - box.top;
      if (phoneQuery.matches) {
        // Phones: between the header and the sheet below the view.
        const bottom = (rectOf('.lab-panel')?.top ?? box.bottom) - box.top;
        return { x: 0, y: top, width: box.width, height: Math.max(120, bottom - top) };
      }
      // Wider screens: left of the open panel, or the full width once it's closed to its title.
      // When the band between the controls above and below is taller than wide, frame the
      // portrait view inside it, clear of the controls. Otherwise the wide view uses the full
      // height, since the controls over it only take its corners, and the fit keeps what the
      // lesson needs out from under them.
      const panel = rectOf('.lab-panel');
      const right = Math.max(
        160,
        panel && live.current.panelOpen ? panel.left - box.left - 8 : box.width,
      );
      const bottom = (rectOf('.lab-dock')?.top ?? box.bottom) - box.top;
      const band = { x: 0, y: top, width: right, height: Math.max(120, bottom - top) };
      if (band.width < band.height) return { ...band, portrait: true };
      return {
        x: 0,
        y: 0,
        width: right,
        height: box.height,
        portrait: false,
        keepOut: controlsOver(box, ['.lab-lede', '.lab-dock', '.lab-legend']),
      };
    };

    void (async () => {
      // three needs WebGL 2; without it, say so rather than report a generic failure.
      if (!document.createElement('canvas').getContext('webgl2')) {
        setFailed(NO_WEBGL);
        return;
      }
      try {
        // The loader's hairline steps on as the view's code arrives and the view is built.
        document.documentElement.dataset.sceneStage = 'code';
        const { createLabScene } = await import('./scene/index.ts');
        document.documentElement.dataset.sceneStage = 'build';
        // Capture renders one frame and stops, so labels must be measured with final fonts.
        if (CAPTURE) await document.fonts.ready;
        if (cancelled()) return;
        const { settings: s } = live.current;
        scene = await createLabScene({
          canvas,
          labelElements: labelRefs.current,
          setup: live.current.setup,
          frequency: live.current.frequency,
          tier: TIER_PARAM ?? s.quality,
          theme: resolvedTheme(),
          reducedMotion: reducesMotion(s.motion, reducedMotionQuery.matches),
          capture: CAPTURE,
          perf: PERF,
          visibleArea,
          noGo,
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
        setSceneReady(true);
        // Settings changed while the scene was loading apply now.
        const now = live.current.settings;
        scene.setTheme(resolvedTheme());
        scene.setReducedMotion(reducesMotion(now.motion, reducedMotionQuery.matches));
        scene.setPaused(live.current.paused);
        if (!TIER_PARAM && now.quality !== s.quality) void scene.setTier(now.quality);
        void document.fonts.ready.then(() => {
          scene?.setState(live.current.setup, live.current.frequency);
          scene?.relayout();
        });
      } catch (error) {
        console.error(error);
        setFailed(
          "The 3D view couldn't load. Reload the page to try again. The controls and explanations still work.",
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

  // The address follows the reader's choices, so a link shares what they see. Not on arrival:
  // the address already says it, and rewriting it then would cut short the page's fade in.
  const firstState = useRef(true);
  useEffect(() => {
    sceneRef.current?.setState(setup, frequency);
    if (firstState.current) {
      firstState.current = false;
      return;
    }
    const url = new URL(location.href);
    url.searchParams.set('setup', setup);
    url.searchParams.set('f', String(frequency));
    history.replaceState(null, '', url);
  }, [setup, frequency]);

  // Settings apply at once (the store applies and saves them); the scene follows them here.
  useEffect(() => {
    const scene = sceneRef.current;
    scene?.setTheme(resolvedTheme());
    scene?.setReducedMotion(reducesMotion(settings.motion, reducedMotionQuery.matches));
  }, [settings.theme, settings.motion]);

  useEffect(() => {
    if (!TIER_PARAM) void sceneRef.current?.setTier(settings.quality);
  }, [settings.quality]);

  useEffect(() => {
    sceneRef.current?.setPaused(paused);
  }, [paused]);

  // Where opening the sheet covers the view, labels move out from under it. Otherwise the view
  // glides to fit what the sheet leaves, and closing it reframes the view, in case the screen
  // rotated while it was open. The first run is the scene's own first framing, so only later
  // changes glide.
  const firstLayout = useRef(true);
  useEffect(() => {
    if (sheetOpen && sheetCovers()) sceneRef.current?.refreshLabels();
    else sceneRef.current?.relayout(!firstLayout.current);
  }, [sheetOpen]);

  // Closing or opening the panel changes how much of the screen the view has; it glides there.
  useEffect(() => {
    if (firstLayout.current) {
      firstLayout.current = false;
      return;
    }
    sceneRef.current?.relayout(true);
  }, [panelOpen]);

  function refreshLabels() {
    sceneRef.current?.refreshLabels();
  }

  const dock = (
    <TransmitterDock
      key="dock"
      setup={setup}
      onSetup={setSetup}
      frequency={frequency}
      onFrequency={setFrequency}
      paused={paused}
      onPause={setPaused}
    />
  );

  // Wider screens: the key beside the view, where each line's row finds it in the view.
  const legend = (
    <section key="legend" class="lab-legend" aria-labelledby="legend-title" data-chrome>
      <h2 class="legend-title" id="legend-title">
        Key
      </h2>
      <Legend
        setup={setup}
        find={
          sceneReady
            ? {
                onHighlight: (id) => {
                  sceneRef.current?.highlight(id);
                },
                onShow: (id) => {
                  labelRefs.current.get(id)?.querySelector('button')?.focus();
                },
              }
            : undefined
        }
      />
    </section>
  );

  const panel = (
    <Panel
      key="panel"
      setup={setup}
      frequency={frequency}
      panelOpen={panelOpen}
      onPanelToggle={() => {
        setPanelOpen(!panelOpen);
      }}
      sheetOpen={sheetOpen}
      onSheetToggle={() => {
        setSheetOpen(!sheetOpen);
      }}
      onAbout={() => {
        setAboutOpen(true);
      }}
    />
  );

  return (
    <div
      class="lab-grid"
      data-sheet={sheetOpen ? 'open' : 'closed'}
      data-panel={panelOpen ? 'open' : 'closed'}
    >
      {/* The lab's one-line lesson, under the site header that names it. */}
      <p class="lab-lede" data-chrome>
        {TAGLINE.text}
      </p>

      <main class="stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          class="lab-canvas"
          role="img"
          aria-label="3D cutaway of a street block showing buried lines and the locate signal."
          aria-describedby="lab-status"
        />
        <SceneLoader page={PAGE} done={failed !== null} />
        {/*
          Labels start hidden; the scene places and shows them once it has a frame to match. A
          label gaining focus is placed first (capture), before its own tip measures where it sits.
        */}
        <div
          class="labels"
          hidden={failed !== null}
          onFocusInCapture={refreshLabels}
          onFocusOut={refreshLabels}
        >
          {LABEL_SPECS.map((spec) => (
            <SceneLabel
              key={spec.id}
              spec={spec}
              setup={setup}
              register={(el) => {
                if (el) labelRefs.current.set(spec.id, el);
                else labelRefs.current.delete(spec.id);
              }}
            />
          ))}
        </div>
      </main>

      {failed && (
        <p class="stage-message" role="status">
          {failed}
        </p>
      )}

      {/*
        The controls in reading order, which is their tab order: on phones and short screens the
        guide's sheet sits above the transmitter; wider, the transmitter and the key come first,
        then the guide beside them.
      */}
      {sheet ? [panel, dock] : [dock, legend, panel]}

      {/* What the 3D view shows, announced when it changes. */}
      <p id="lab-status" class="sr-only" role="status">
        {stateSummary(setup, frequency)}
      </p>

      <Dialog
        open={aboutOpen}
        onClose={() => {
          setAboutOpen(false);
        }}
        title={ABOUT.heading}
      >
        <ul class="about-list">
          {ABOUT.claims.map((c) => (
            <li key={c.id}>
              <Rich text={c.text} define={define} />
            </li>
          ))}
        </ul>
        <p class="muted">{ABOUT.leftOut}</p>
      </Dialog>
    </div>
  );
}
