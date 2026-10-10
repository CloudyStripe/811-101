import { useEffect, useRef, useState } from 'preact/hooks';
import {
  FREQUENCIES,
  frequencyLabel,
  frequencySpoken,
  type Frequency,
} from '../../../config/equipment.ts';
import { APWA } from '../../design/apwa.ts';
import { Icon, type IconName } from '../../design/icons.tsx';
import { Segmented } from '../../design/Segmented.tsx';
import type { ThemeName } from '../../design/tokens.ts';
import { parseTier } from '../../kit3d/quality.ts';
import type { SetupId } from '../../signal/model.ts';
import type { LabScene, Rect } from './scene/index.ts';
import { LABEL_SPECS, type LabelId } from './scene/labels.ts';

const params = new URLSearchParams(location.search);
const INITIAL_SETUP: SetupId = params.get('setup') === 'plastic' ? 'plastic' : 'steel';
const INITIAL_FREQUENCY: Frequency =
  FREQUENCIES.find((f) => String(f) === params.get('f')) ?? FREQUENCIES[0];
const TIER = parseTier(params.get('tier')) ?? 'auto';
const CAPTURE = params.has('capture');
const PERF = params.has('perf');

const SETUP_OPTIONS = [
  { value: 'steel' as const, label: 'Steel main' },
  { value: 'plastic' as const, label: 'Plastic main' },
];

const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function resolvedTheme(): ThemeName {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'light' || forced === 'dark') return forced;
  return darkQuery.matches ? 'dark' : 'light';
}

function rectWithin(el: Element | null, container: DOMRect): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return {
    x: r.left - container.left - 6,
    y: r.top - container.top - 6,
    w: r.width + 12,
    h: r.height + 12,
  };
}

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

export function App() {
  const [setup, setSetup] = useState<SetupId>(INITIAL_SETUP);
  const [frequency, setFrequency] = useState<Frequency>(INITIAL_FREQUENCY);
  const [failed, setFailed] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chromeRefs = useRef<(HTMLElement | null)[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<LabelId, HTMLElement>());
  const sceneRef = useRef<LabScene | null>(null);
  const stateRef = useRef({ setup, frequency });
  stateRef.current = { setup, frequency };

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
      return chromeRefs.current.flatMap((el) => rectWithin(el, box) ?? []);
    };
    // On phones the chrome takes full-width bands at the top and bottom; frame the 3D between them.
    const visibleArea = () => {
      const box = stageEl.getBoundingClientRect();
      if (box.width > 760) return { x: 0, y: 0, width: box.width, height: box.height };
      const setupEl = chromeRefs.current[1];
      const bottomEl = bottomRef.current;
      const top = setupEl ? setupEl.getBoundingClientRect().bottom - box.top : 0;
      const bottom = bottomEl ? bottomEl.getBoundingClientRect().top - box.top : box.height;
      return { x: 0, y: top, width: box.width, height: Math.max(120, bottom - top) };
    };

    void (async () => {
      try {
        const { createLabScene } = await import('./scene/index.ts');
        // Capture renders one frame and stops, so labels must be measured with final fonts.
        if (CAPTURE) await document.fonts.ready;
        if (cancelled()) return;
        scene = await createLabScene({
          canvas,
          labelElements: labelRefs.current,
          setup: stateRef.current.setup,
          frequency: stateRef.current.frequency,
          tier: TIER,
          theme: resolvedTheme(),
          reducedMotion: reducedMotionQuery.matches,
          capture: CAPTURE,
          perf: PERF,
          visibleArea,
          noGo,
          onContextLost: () => {
            setFailed(
              'The 3D view stopped because the graphics context was lost. Reload the page to restart it.',
            );
          },
        });
        if (cancelled()) {
          scene.dispose();
          return;
        }
        sceneRef.current = scene;
        void document.fonts.ready.then(() => {
          scene?.setState(stateRef.current.setup, stateRef.current.frequency);
          scene?.relayout();
        });
      } catch {
        setFailed(
          'This lab draws a 3D view with WebGL, which this browser or device has turned off. The controls and explanations still work.',
        );
      }
    })();

    const onTheme = () => scene?.setTheme(resolvedTheme());
    const onMotion = () => scene?.setReducedMotion(reducedMotionQuery.matches);
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

  function onCanvasKey(event: KeyboardEvent) {
    const scene = sceneRef.current;
    if (!scene || event.altKey || event.ctrlKey || event.metaKey) return;
    const actions: Record<string, (s: LabScene) => void> = {
      ArrowLeft: rotateLeft,
      ArrowRight: rotateRight,
      ArrowUp: tiltUp,
      ArrowDown: tiltDown,
      '+': zoomIn,
      '=': zoomIn,
      '-': zoomOut,
      _: zoomOut,
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action(scene);
  }

  const cameraButtons: { icon: IconName; label: string; run: (s: LabScene) => void }[] = [
    { icon: 'rotate-left', label: 'Turn left', run: rotateLeft },
    { icon: 'rotate-right', label: 'Turn right', run: rotateRight },
    { icon: 'tilt-up', label: 'Look from higher', run: tiltUp },
    { icon: 'tilt-down', label: 'Look from lower', run: tiltDown },
    { icon: 'zoom-in', label: 'Zoom in', run: zoomIn },
    { icon: 'zoom-out', label: 'Zoom out', run: zoomOut },
    {
      icon: 'reset',
      label: 'Reset view',
      run: (s) => {
        s.resetView();
      },
    },
  ];

  return (
    <>
      <div class="stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          class="lab-canvas"
          tabIndex={0}
          role="img"
          aria-label="3D cutaway of a street block showing buried lines and the locate signal. Use the arrow keys to turn the view, and plus or minus to zoom."
          onKeyDown={onCanvasKey}
        />
        {/* Labels start hidden; the scene places and shows them once it has a frame to match. */}
        <div class="labels" hidden={failed !== null}>
          {LABEL_SPECS.map((spec) => {
            const text = spec.text[setup];
            return (
              <button
                key={spec.id}
                type="button"
                class="lbl off"
                data-label={spec.id}
                ref={(el) => {
                  if (el) labelRefs.current.set(spec.id, el);
                  else labelRefs.current.delete(spec.id);
                }}
                hidden={text === null}
              >
                <span
                  class={`lbl-icon${spec.color ? ' lbl-icon-facility' : ''}`}
                  style={spec.color ? { '--chip': APWA[spec.color].fill } : undefined}
                >
                  <Icon name={spec.icon} />
                </span>
                <span class="lbl-text">{text}</span>
              </button>
            );
          })}
        </div>
        {failed && (
          <p class="stage-message" role="status">
            {failed}
          </p>
        )}
      </div>

      <header
        class="lab-title"
        ref={(el) => {
          chromeRefs.current[0] = el;
        }}
      >
        <h1>Frequency Lab</h1>
        <p>
          Use the lowest frequency that works: it travels farther and bleeds less onto other lines.
        </p>
      </header>

      <div
        class="lab-setup"
        ref={(el) => {
          chromeRefs.current[1] = el;
        }}
      >
        <Segmented label="Setup" value={setup} options={SETUP_OPTIONS} onChange={setSetup} />
      </div>

      <div class="lab-bottom" ref={bottomRef}>
        <section
          class="lab-console"
          aria-label="Transmitter"
          ref={(el) => {
            chromeRefs.current[2] = el;
          }}
        >
          <h2 class="console-title" id="frequency-label">
            Transmitter frequency
          </h2>
          <Segmented
            label="Transmitter frequency"
            value={frequency}
            options={FREQUENCIES.map((f) => ({
              value: f,
              label: frequencyLabel(f),
              ariaLabel: frequencySpoken(f),
            }))}
            onChange={setFrequency}
            class="frequency"
          />
        </section>

        <div
          class="lab-camera"
          role="toolbar"
          aria-label="View"
          ref={(el) => {
            chromeRefs.current[3] = el;
          }}
        >
          {cameraButtons.map((b) => (
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
      </div>
    </>
  );
}
