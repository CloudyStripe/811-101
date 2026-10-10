import { useEffect, useRef, useState } from 'preact/hooks';
import { FREQUENCIES, type Frequency } from '../../../config/equipment.ts';
import { ABOUT } from '../../../content/training/frequency-lab.ts';
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
/** Matches the phone layout in lab.css. */
const phoneQuery = matchMedia('(max-width: 760px)');

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
  const phoneArea = useRef<VisibleArea | null>(null);

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
    const visibleArea = (): VisibleArea => {
      const box = stageEl.getBoundingClientRect();
      if (!phoneQuery.matches) {
        // Wide screens: everything left of the panel.
        const panel = rectOf('.lab-panel');
        const right = panel ? panel.left - box.left - 8 : box.width;
        return { x: 0, y: 0, width: Math.max(160, right), height: box.height };
      }
      // Phones: between the setup switch and the controls below the view. An open sheet
      // covers most of the view, so the framing stays as it was.
      if (live.current.sheetOpen && phoneArea.current) return phoneArea.current;
      const top = (rectOf('.lab-setup')?.bottom ?? box.top) - box.top;
      const bottom = (rectOf('.lab-camera')?.top ?? box.bottom) - box.top;
      phoneArea.current = { x: 0, y: top, width: box.width, height: Math.max(120, bottom - top) };
      return phoneArea.current;
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
              'The 3D view stopped because the graphics context was lost. Reload the page to restart it.',
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

  useEffect(() => {
    sceneRef.current?.relayout();
  }, [setup]);

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
  useEffect(() => {
    sceneRef.current?.refreshLabels();
  }, [sheetOpen]);

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
        <p>
          Use the lowest frequency that works: it travels farther and bleeds less onto other lines.
        </p>
      </header>

      <div class="lab-setup" data-chrome>
        <Segmented label="Setup" value={setup} options={SETUP_OPTIONS} onChange={setSetup} />
      </div>

      <Console setup={setup} frequency={frequency} onFrequency={setFrequency} />

      <main class="stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          class="lab-canvas"
          tabIndex={0}
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
        {failed && (
          <p class="stage-message" role="status">
            {failed}
          </p>
        )}
      </main>

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
