import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { FREQUENCIES, type Frequency } from '../../../config/equipment.ts';
import { ABOUT, KEY } from '../../../content/training/frequency-lab.ts';
import { Dialog } from '../../design/Dialog.tsx';
import { Rich } from '../../design/Term.tsx';
import type { Box, VisibleArea } from '../../kit3d/camera.ts';
import { parseTier } from '../../kit3d/quality.ts';
import type { SetupId } from '../../signal/model.ts';
import { Console, type DrawerId } from './Console.tsx';
import { Drawer } from './Drawer.tsx';
import { Guide, define } from './Guide.tsx';
import { Legend } from './Legend.tsx';
import { SceneLabel } from './SceneLabel.tsx';
import type { LabScene, Rect } from './scene/index.ts';
import { LABEL_SPECS, type LabelId } from './scene/labels.ts';
import { pageById } from '../../site/pages.ts';
import { SceneLoader } from '../../site/SceneLoader.tsx';
import { reducesMotion } from '../../site/settings.ts';
import { darkQuery, resolvedTheme } from '../../site/theme.ts';
import { useSettings } from '../../site/useSettings.ts';

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
/** Matches lab.css: short screens, such as phones held sideways, put the controls in a column. */
const shortQuery = matchMedia('(max-height: 580px) and (min-width: 561px)');

/** The element the guide and the key open in. */
const DRAWER_ID = 'lab-drawer';

const DRAWER_TITLES: Record<DrawerId, string> = { guide: 'Lab guide', key: KEY.heading };
const DRAWER_CLOSE: Record<DrawerId, string> = {
  guide: 'Close the lab guide',
  key: 'Close the key',
};

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
  // Changed in the header's settings menu, or for the labels, on the console; the scene follows.
  const [settings, setSettings] = useSettings();
  const labelsShown = settings.labels === 'on';
  // The guide or the key, open between the view and the console; or neither.
  const [drawer, setDrawer] = useState<DrawerId | null>(null);
  // The reader can pause the signal's motion, whatever the motion setting (WCAG 2.2.2).
  const [paused, setPaused] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  // The key's rows find lines in the view once there's a view to find them in.
  const [sceneReady, setSceneReady] = useState(false);
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef(new Map<LabelId, HTMLElement>());
  const sceneRef = useRef<LabScene | null>(null);
  // The scene's callbacks outlive renders, so they read current state from here.
  const live = useRef({ setup, frequency, settings, paused });
  live.current = { setup, frequency, settings, paused };

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
    /**
     * The part of the 3D view the chrome leaves free, which the camera frames: below the site
     * header, and above the drawer when it's open, or the console; on short screens, right of the
     * column that holds them, the fit keeping what the lesson needs out from under the header's
     * pills over its top.
     */
    const visibleArea = (): VisibleArea => {
      const box = stageEl.getBoundingClientRect();
      const top = Math.max(0, (rectOf('.site-header')?.bottom ?? box.top) - box.top);
      if (shortQuery.matches) {
        // The whole height beside the column, clear of the header's pills over its top.
        const left = (rectOf('.lab-console')?.right ?? box.left) - box.left + 8;
        return {
          x: left,
          y: 0,
          width: Math.max(160, box.width - left),
          height: box.height,
          keepOut: controlsOver(box, ['.site-home', '.site-page', '.site-tools']),
        };
      }
      const drawerBox = rectOf(`#${DRAWER_ID}:not([hidden])`);
      const below = drawerBox && drawerBox.height > 0 ? drawerBox : rectOf('.lab-console');
      const bottom = Math.min(box.height, (below?.top ?? box.bottom) - box.top - 8);
      return { x: 0, y: top, width: box.width, height: Math.max(120, bottom - top) };
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
          // Which view the block is built for, and how deep, on the page for tests and styles to read.
          onView: (kind, depth) => {
            stageEl.dataset.view = kind;
            stageEl.dataset.depth = String(depth);
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
        setSceneReady(true);
        // Settings changed while the scene was loading apply now.
        const now = live.current.settings;
        scene.setTheme(resolvedTheme());
        scene.setReducedMotion(reducesMotion(now.motion, reducedMotionQuery.matches));
        scene.setPaused(live.current.paused);
        scene.setLabelsShown(now.labels === 'on');
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

  // Before paint, so labels shown again are placed before they're seen.
  useLayoutEffect(() => {
    sceneRef.current?.setLabelsShown(labelsShown);
  }, [labelsShown]);

  // Opening or closing the drawer changes how much room the view has: it glides to frame the
  // lines above the drawer. The first run is the scene's own first framing.
  const firstLayout = useRef(true);
  useEffect(() => {
    if (firstLayout.current) {
      firstLayout.current = false;
      return;
    }
    sceneRef.current?.relayout(true);
  }, [drawer]);

  function refreshLabels() {
    sceneRef.current?.refreshLabels();
  }

  /** Closes the drawer, and hands focus back to the button that opened it. */
  function closeDrawer() {
    const was = drawer;
    setDrawer(null);
    if (was) document.querySelector<HTMLElement>(`.console-toggle[data-drawer="${was}"]`)?.focus();
  }

  return (
    <div class="lab-grid" data-drawer={drawer ?? undefined}>
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
          hidden={failed !== null || !labelsShown}
          onFocusInCapture={refreshLabels}
          onFocusOut={refreshLabels}
        >
          {LABEL_SPECS.map((spec) => (
            <SceneLabel
              key={spec.id}
              spec={spec}
              setup={setup}
              onTipChange={refreshLabels}
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

      {/* The guide or the key, between the view and the console: it reads in that order too. */}
      <Drawer
        id={DRAWER_ID}
        title={drawer ? DRAWER_TITLES[drawer] : null}
        closeLabel={drawer ? DRAWER_CLOSE[drawer] : ''}
        onClose={closeDrawer}
      >
        {drawer === 'guide' && (
          <Guide
            setup={setup}
            frequency={frequency}
            onAbout={() => {
              setAboutOpen(true);
            }}
          />
        )}
        {drawer === 'key' && (
          <Legend
            setup={setup}
            // Its rows find lines in the view while the view shows their labels.
            find={
              sceneReady && labelsShown
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
        )}
      </Drawer>

      <Console
        setup={setup}
        onSetup={setSetup}
        frequency={frequency}
        onFrequency={setFrequency}
        paused={paused}
        onPause={setPaused}
        drawer={drawer}
        drawerElement={DRAWER_ID}
        onDrawer={(next) => {
          if (next) setDrawer(next);
          else closeDrawer();
        }}
        labels={labelsShown}
        onLabels={(on) => {
          setSettings({ ...settings, labels: on ? 'on' : 'off' });
        }}
      />

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
