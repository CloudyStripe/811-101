import { useEffect, useRef, useState } from 'preact/hooks';
import { FREQUENCIES, type Frequency } from '../../../config/equipment.ts';
import { ABOUT, TAGLINE } from '../../../content/training/frequency-lab.ts';
import { Dialog } from '../../design/Dialog.tsx';
import { Icon, type IconName } from '../../design/icons.tsx';
import { Segmented } from '../../design/Segmented.tsx';
import { Rich } from '../../design/Term.tsx';
import type { ThemeName } from '../../design/tokens.ts';
import type { VisibleArea } from '../../kit3d/camera.ts';
import { parseTier } from '../../kit3d/quality.ts';
import type { SetupId } from '../../signal/model.ts';
import { Console } from './Console.tsx';
import { Panel, define } from './Panel.tsx';
import { SceneLabel } from './SceneLabel.tsx';
import type { LabScene, Rect } from './scene/index.ts';
import { LABEL_SPECS, type LabelId } from './scene/labels.ts';
import { SettingsMenu } from './SettingsMenu.tsx';
import {
  applyToDocument,
  loadSettings,
  reducesMotion,
  saveSettings,
  type Settings,
} from './settings.ts';
import { stateSummary } from './summary.ts';

const params = new URLSearchParams(location.search);
const INITIAL_SETUP: SetupId = params.get('setup') === 'plastic' ? 'plastic' : 'steel';
const INITIAL_FREQUENCY: Frequency =
  FREQUENCIES.find((f) => String(f) === params.get('f')) ?? FREQUENCIES[0];
/** `?tier=` pins a quality tier over the saved setting, for tests and comparisons. */
const TIER_PARAM = parseTier(params.get('tier'));
const CAPTURE = params.has('capture');
const PERF = params.has('perf');

const SETUP_OPTIONS = [
  { value: 'steel' as const, label: 'Steel main' },
  { value: 'plastic' as const, label: 'Plastic main' },
];

const NO_WEBGL =
  'This lab draws a 3D view with WebGL, which this browser or device has turned off. The controls and explanations still work.';

const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
/** Match the layouts in lab.css: phones, and short screens such as phones held sideways. */
const phoneQuery = matchMedia('(max-width: 760px)');
const shortQuery = matchMedia('(max-height: 580px) and (min-width: 561px)');
/** Layouts where the guide is a sheet that opens over the 3D view. */
const sheetLayout = () => phoneQuery.matches || shortQuery.matches;

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

/** View controls shared by the keyboard and the toolbar. */
const rotateLeft = (s: LabScene) => {
  s.rotate(1);
};
const rotateRight = (s: LabScene) => {
  s.rotate(-1);
};
const tiltUp = (s: LabScene) => {
  s.tilt(-1);
};
const tiltDown = (s: LabScene) => {
  s.tilt(1);
};
const zoomIn = (s: LabScene) => {
  s.zoom(1);
};
const zoomOut = (s: LabScene) => {
  s.zoom(-1);
};
const resetView = (s: LabScene) => {
  s.resetView();
};

const CAMERA_BUTTONS: { icon: IconName; label: string; run: (s: LabScene) => void }[] = [
  { icon: 'rotate-left', label: 'Turn left', run: rotateLeft },
  { icon: 'rotate-right', label: 'Turn right', run: rotateRight },
  { icon: 'tilt-up', label: 'Look from higher', run: tiltUp },
  { icon: 'tilt-down', label: 'Look from lower', run: tiltDown },
  { icon: 'zoom-in', label: 'Zoom in', run: zoomIn },
  { icon: 'zoom-out', label: 'Zoom out', run: zoomOut },
  { icon: 'reset', label: 'Reset view', run: resetView },
];

const CANVAS_KEYS: Record<string, (s: LabScene) => void> = {
  ArrowLeft: rotateLeft,
  ArrowRight: rotateRight,
  ArrowUp: tiltUp,
  ArrowDown: tiltDown,
  '+': zoomIn,
  '=': zoomIn,
  '-': zoomOut,
  _: zoomOut,
};

export function App() {
  const [setup, setSetup] = useState<SetupId>(INITIAL_SETUP);
  const [frequency, setFrequency] = useState<Frequency>(INITIAL_FREQUENCY);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef(new Map<LabelId, HTMLElement>());
  const sceneRef = useRef<LabScene | null>(null);
  // The scene's callbacks outlive renders, so they read current state from here.
  const live = useRef({ setup, frequency, settings, sheetOpen });
  live.current = { setup, frequency, settings, sheetOpen };
  const lastArea = useRef<{ area: VisibleArea; size: string } | null>(null);
  // Whether the guide is a sheet over the view, which changes as the screen rotates or resizes.
  const [sheetMode, setSheetMode] = useState(sheetLayout);

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
      // An open sheet covers the view, so the framing stays as it was, unless the screen itself
      // changed (a rotation); closing the sheet then frames the view afresh.
      const last = lastArea.current;
      if (live.current.sheetOpen && sheetLayout() && last?.size === size) return last.area;
      const area = freeArea(box);
      lastArea.current = { area, size };
      return area;
    };
    const freeArea = (box: DOMRect): VisibleArea => {
      const top = (rectOf('.lab-setup')?.bottom ?? box.top) - box.top;
      if (shortQuery.matches) {
        // Short screens: between the column of controls and the upright view toolbar.
        const left = (rectOf('.lab-title')?.right ?? box.left) - box.left + 8;
        const toolbar = rectOf('.lab-camera');
        const right = toolbar && toolbar.width > 0 ? toolbar.left - box.left - 8 : box.width;
        return { x: left, y: 0, width: Math.max(160, right - left), height: box.height };
      }
      if (phoneQuery.matches) {
        // Phones: between the setup switch and the controls below the view.
        const bottom = (rectOf('.lab-camera')?.top ?? box.bottom) - box.top;
        return { x: 0, y: top, width: box.width, height: Math.max(120, bottom - top) };
      }
      // Wider screens: left of the panel. When the band between the controls above and below
      // is taller than wide, frame the portrait view inside it, clear of the controls; otherwise
      // the wide view uses the full height, since the bottom controls only take the corners.
      const panel = rectOf('.lab-panel');
      const right = Math.max(160, panel ? panel.left - box.left - 8 : box.width);
      const bottom =
        Math.min(
          rectOf('.lab-camera')?.top ?? box.bottom,
          rectOf('.lab-console')?.top ?? box.bottom,
        ) - box.top;
      const band = { x: 0, y: top, width: right, height: Math.max(120, bottom - top) };
      if (band.width < band.height) return { ...band, portrait: true };
      return { x: 0, y: 0, width: right, height: box.height, portrait: false };
    };

    void (async () => {
      // three needs WebGL 2; without it, say so rather than report a generic failure.
      if (!document.createElement('canvas').getContext('webgl2')) {
        setFailed(NO_WEBGL);
        return;
      }
      try {
        const { createLabScene } = await import('./scene/index.ts');
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
        // Settings changed while the scene was loading apply now.
        const now = live.current.settings;
        scene.setTheme(resolvedTheme());
        scene.setReducedMotion(reducesMotion(now.motion, reducedMotionQuery.matches));
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

  useEffect(() => {
    sceneRef.current?.setState(setup, frequency);
    const url = new URL(location.href);
    url.searchParams.set('setup', setup);
    url.searchParams.set('f', String(frequency));
    history.replaceState(null, '', url);
  }, [setup, frequency]);

  // Settings apply at once and are remembered; the page applied the saved ones before first paint.
  const firstSettings = useRef(true);
  useEffect(() => {
    applyToDocument(settings);
    if (firstSettings.current) {
      firstSettings.current = false;
      return;
    }
    saveSettings(settings);
    const scene = sceneRef.current;
    scene?.setTheme(resolvedTheme());
    scene?.setReducedMotion(reducesMotion(settings.motion, reducedMotionQuery.matches));
  }, [settings]);

  useEffect(() => {
    if (!TIER_PARAM) void sceneRef.current?.setTier(settings.quality);
  }, [settings.quality]);

  // The sheet covers part of the view on phones, so labels move out from under it.
  // Opening the sheet covers part of the view, so labels move out from under it. Closing it
  // reframes the view, in case the screen rotated while it was open.
  useEffect(() => {
    if (sheetOpen) sceneRef.current?.refreshLabels();
    else sceneRef.current?.relayout();
  }, [sheetOpen]);

  useEffect(() => {
    const onChange = () => {
      setSheetMode(sheetLayout());
    };
    phoneQuery.addEventListener('change', onChange);
    shortQuery.addEventListener('change', onChange);
    return () => {
      phoneQuery.removeEventListener('change', onChange);
      shortQuery.removeEventListener('change', onChange);
    };
  }, []);

  function onCanvasKey(event: KeyboardEvent) {
    const scene = sceneRef.current;
    if (!scene || event.altKey || event.ctrlKey || event.metaKey) return;
    const action = CANVAS_KEYS[event.key];
    if (!action) return;
    event.preventDefault();
    action(scene);
  }

  function refreshLabels() {
    sceneRef.current?.refreshLabels();
  }

  return (
    <div class="lab-grid" data-sheet={sheetOpen ? 'open' : 'closed'}>
      <header class="lab-title" data-chrome>
        <div class="lab-title-row">
          <h1>Frequency Lab</h1>
          <SettingsMenu settings={settings} onChange={setSettings} />
        </div>
        <p>{TAGLINE.text}</p>
      </header>

      <div class="lab-setup" data-chrome>
        <Segmented label="Setup" value={setup} options={SETUP_OPTIONS} onChange={setSetup} />
      </div>

      <Console setup={setup} frequency={frequency} onFrequency={setFrequency} />

      <main class="stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          class="lab-canvas"
          // Under an open sheet the view can't be seen, so it leaves the tab order.
          tabIndex={sheetOpen && sheetMode ? -1 : 0}
          role="img"
          aria-label="3D cutaway of a street block showing buried lines and the locate signal. Use the arrow keys to turn the view, and plus or minus to zoom."
          aria-describedby="lab-status"
          onKeyDown={onCanvasKey}
        />
        {/* Labels start hidden; the scene places and shows them once it has a frame to match. */}
        <div
          class="labels"
          hidden={failed !== null}
          onFocusIn={refreshLabels}
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

      <div class="lab-camera" role="toolbar" aria-label="View" data-chrome>
        {CAMERA_BUTTONS.map((b) => (
          <button
            key={b.icon}
            type="button"
            class="icon-button"
            aria-label={b.label}
            title={b.label}
            onClick={() => {
              if (sceneRef.current) b.run(sceneRef.current);
            }}
          >
            <Icon name={b.icon} />
          </button>
        ))}
      </div>

      <Panel
        setup={setup}
        frequency={frequency}
        sheetOpen={sheetOpen}
        onSheetToggle={() => {
          setSheetOpen(!sheetOpen);
        }}
        onAbout={() => {
          setAboutOpen(true);
        }}
      />

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
