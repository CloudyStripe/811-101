/**
 * Read the Marks: the yard in 3D, and beside it (on phones held upright, under it, in a sheet that
 * keeps its height through a round, so the yard keeps its size) the question about the mark lit in it, its
 * four answers, and what was under it. A Key shows the whole code any time. After the eighth mark,
 * every line shows at once, with the score, the code, and Play again.
 *
 * `?seed=` fixes a round's order, for tests and pictures; `?show=<mark>` opens a round at that mark,
 * answered right, as the portal's preview shows it.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  CODE,
  END,
  INTRO,
  KEY,
  MARKS as TEXT,
  TERMS,
  UI,
  VIEW,
} from '../../../content/basics/read-the-marks.ts';
import { APWA, MARKS_APWA, type ApwaCode } from '../../design/apwa.ts';
import { Dialog } from '../../design/Dialog.tsx';
import { Icon, type IconName } from '../../design/icons.tsx';
import { ScrollMore } from '../../design/ScrollMore.tsx';
import { Rich } from '../../design/Term.tsx';
import type { VisibleArea } from '../../kit3d/camera.ts';
import { mulberry32 } from '../../kit3d/rng.ts';
import { parseTier } from '../../kit3d/quality.ts';
import { revealed } from '../../site/arrival.ts';
import { pageById } from '../../site/pages.ts';
import { SceneLoader } from '../../site/SceneLoader.tsx';
import { reducesMotion } from '../../site/settings.ts';
import { darkQuery, resolvedTheme } from '../../site/theme.ts';
import { useSettings } from '../../site/useSettings.ts';
import {
  MARK_COLOR,
  MARK_IDS,
  answer,
  current,
  isOver,
  newRound,
  next,
  openMarks,
  score,
  type MarkId,
  type Round,
} from './game.ts';
import type { MarksScene, Rect } from './scene/index.ts';
import { announcement, feedback, progress, scoreLine, viewSummary } from './text.ts';

const PAGE = pageById('read-the-marks');

const params = new URLSearchParams(location.search);
/** `?tier=` pins a quality tier over the saved setting, for tests and comparisons. */
const TIER_PARAM = parseTier(params.get('tier'));
const CAPTURE = params.has('capture');
const PERF = params.has('perf');
const SEED = params.get('seed');
const SHOW = MARK_IDS.find((id) => id === params.get('show')) ?? null;

const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
/** Matches marks.css: where the question sits in a sheet under the yard, not beside it. */
const sheetQuery = matchMedia('(max-width: 760px) and (min-height: 581px), (max-width: 560px)');

/** What each mark shows, by icon, beside its color's name. */
export const MARK_ICON: Readonly<Record<MarkId, IconName>> = {
  dig: 'dig',
  gas: 'gas',
  electric: 'electric',
  communication: 'telecom',
  water: 'water',
  sewer: 'sewer',
  reclaimed: 'reclaimed',
  survey: 'survey',
};

/** The marks over buried lines, whose names show in the view once open. */
const LINE_MARKS = MARK_IDS.filter((id) => TEXT[id].label !== null);

const define = (key: string) => TERMS[key]?.text;

/** A new round; with `?show=`, moved on to that mark, every mark before it read right, and it too. */
function startRound(random: () => number): Round {
  let round = newRound(random);
  if (!SHOW) return round;
  for (let q = current(round); q && q.mark !== SHOW; q = current(round)) {
    round = next(answer(round, MARK_COLOR[q.mark]));
  }
  return answer(round, MARK_COLOR[SHOW]);
}

function randomFor(seed: string | null): () => number {
  if (seed !== null && /^\d+$/.test(seed)) return mulberry32(Number(seed));
  return Math.random;
}

function rectWithin(el: Element, container: DOMRect): Rect | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return {
    x: r.left - container.left - 10,
    y: r.top - container.top - 10,
    w: r.width + 20,
    h: r.height + 20,
  };
}

function Swatch({ color }: { color: ApwaCode }) {
  return <span class="rm-swatch" style={{ '--swatch': APWA[color].fill }} aria-hidden="true" />;
}

/** The whole code: a row per color, its swatch, name and meaning. */
function CodeList() {
  return (
    <ul class="rm-code">
      {MARKS_APWA.map((c) => (
        <li key={c}>
          <Swatch color={c} />
          <span>
            <strong>{CODE[c].name}:</strong> <Rich text={CODE[c].meaning.text} define={define} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function App() {
  const random = useMemo(() => randomFor(SEED), []);
  const [round, setRound] = useState<Round>(() => startRound(random));
  const [keyOpen, setKeyOpen] = useState(false);
  const [settings, setSettings] = useSettings();
  const labelsShown = settings.labels === 'on';
  const [failed, setFailed] = useState<string | null>(null);
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef(new Map<MarkId, HTMLElement>());
  const sceneRef = useRef<MarksScene | null>(null);
  const askRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const q = current(round);
  const over = isOver(round);
  const answered = q !== null && q.picked !== null;
  const sceneState = {
    focus: over ? null : (q?.mark ?? null),
    glow: !over && !answered,
    open: openMarks(round),
  };
  const live = useRef({ settings, sceneState });
  live.current = { settings, sceneState };

  // Build the 3D scene once, after first paint; it lives in its own lazy chunk.
  useEffect(() => {
    const life = { cancelled: false };
    const cancelled = () => life.cancelled;
    let scene: MarksScene | null = null;
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
     * The part of the view the header and the question leave free: beside the panel, or above the
     * sheet. The sheet keeps its height through a round, so this holds still as you play.
     */
    const visibleArea = (): VisibleArea => {
      const box = stageEl.getBoundingClientRect();
      const header = document.querySelector('.site-header')?.getBoundingClientRect();
      const top = Math.max(0, (header?.bottom ?? box.top) - box.top + 4);
      const panel = document.querySelector('.rm-panel')?.getBoundingClientRect();
      if (panel && sheetQuery.matches) {
        const bottom = panel.top - box.top - 8;
        return { x: 0, y: top, width: box.width, height: Math.max(120, bottom - top) };
      }
      const right = panel ? panel.left - box.left - 12 : box.width;
      return { x: 0, y: top, width: Math.max(160, right), height: Math.max(120, box.height - top) };
    };

    void (async () => {
      await revealed();
      if (cancelled()) return;
      if (!document.createElement('canvas').getContext('webgl2')) {
        setFailed(UI.noWebgl.text);
        return;
      }
      try {
        document.documentElement.dataset.sceneStage = 'code';
        const { createMarksScene } = await import('./scene/index.ts');
        document.documentElement.dataset.sceneStage = 'build';
        if (CAPTURE) await document.fonts.ready;
        if (cancelled()) return;
        const { settings: s, sceneState: state } = live.current;
        scene = await createMarksScene({
          canvas,
          labelElements: labelRefs.current,
          tier: TIER_PARAM ?? s.quality,
          theme: resolvedTheme(),
          reducedMotion: reducesMotion(s.motion, reducedMotionQuery.matches),
          capture: CAPTURE,
          perf: PERF,
          state,
          visibleArea,
          noGo,
          onContextLost: () => {
            setFailed(UI.lost.text);
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
        scene.setLabelsShown(now.settings.labels === 'on');
        scene.setState(now.sceneState);
        if (!TIER_PARAM && now.settings.quality !== s.quality)
          void scene.setTier(now.settings.quality);
        void document.fonts.ready.then(() => {
          scene?.relayout();
        });
      } catch (error) {
        console.error(error);
        setFailed(UI.failed.text);
      }
    })();

    const onTheme = () => scene?.setTheme(resolvedTheme());
    const onMotion = () => {
      scene?.setReducedMotion(
        reducesMotion(live.current.settings.motion, reducedMotionQuery.matches),
      );
    };
    const onLayout = () => scene?.relayout();
    const onPageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) scene?.dispose();
    };
    darkQuery.addEventListener('change', onTheme);
    reducedMotionQuery.addEventListener('change', onMotion);
    sheetQuery.addEventListener('change', onLayout);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      life.cancelled = true;
      darkQuery.removeEventListener('change', onTheme);
      reducedMotionQuery.removeEventListener('change', onMotion);
      sheetQuery.removeEventListener('change', onLayout);
      window.removeEventListener('pagehide', onPageHide);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // The scene follows the round: the mark asked about, and the lines open.
  const stateKey = `${sceneState.focus ?? ''}|${String(sceneState.glow)}|${sceneState.open.join()}`;
  useEffect(() => {
    sceneRef.current?.setState(live.current.sceneState);
  }, [stateKey]);

  useEffect(() => {
    const scene = sceneRef.current;
    scene?.setTheme(resolvedTheme());
    scene?.setReducedMotion(reducesMotion(settings.motion, reducedMotionQuery.matches));
  }, [settings.theme, settings.motion]);

  useEffect(() => {
    if (!TIER_PARAM) void sceneRef.current?.setTier(settings.quality);
  }, [settings.quality]);

  useLayoutEffect(() => {
    sceneRef.current?.setLabelsShown(labelsShown);
  }, [labelsShown]);

  // Where focus goes as the round moves on: to Next once answered, to the next question after,
  // to the score at the end. Not on arrival: the page's own order leads there. Where the question
  // doesn't all show (a short screen), its body scrolls on to the result once answered, and back
  // to its top for the next.
  const focusKey = `${String(round.at)}|${String(answered)}`;
  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    const body = bodyRef.current;
    if (answered) {
      nextRef.current?.focus();
      const result = resultRef.current;
      if (body && result) {
        const top = result.getBoundingClientRect().top - body.getBoundingClientRect().top;
        const to = Math.min(body.scrollHeight - body.clientHeight, body.scrollTop + top);
        const smooth = !reducesMotion(live.current.settings.motion, reducedMotionQuery.matches);
        if (to > body.scrollTop) body.scrollTo({ top: to, behavior: smooth ? 'smooth' : 'auto' });
      }
    } else {
      body?.scrollTo({ top: 0 });
      askRef.current?.focus();
    }
  }, [focusKey]);

  function pick(color: ApwaCode) {
    setRound((r) => answer(r, color));
  }
  function moveOn() {
    setRound((r) => next(r));
  }
  function playAgain() {
    setRound(newRound(random));
  }

  // 1 to 4 answer the question, wherever focus is but in a dialog or a field.
  const onKey = useRef<(event: KeyboardEvent) => void>(() => undefined);
  onKey.current = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || keyOpen) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, dialog')) return;
    const n = Number(event.key);
    if (!q || answered || !Number.isInteger(n) || n < 1 || n > q.choices.length) return;
    const color = q.choices[n - 1];
    if (!color) return;
    event.preventDefault();
    pick(color);
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      onKey.current(event);
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, []);

  const status = over
    ? `${scoreLine(score(round))} ${viewSummary({ mark: null, over: true })}`
    : q && answered && q.picked
      ? announcement(q.mark, q.picked)
      : viewSummary({ mark: q?.mark ?? null, over: false });

  const right = q ? MARK_COLOR[q.mark] : null;
  const markText = q ? TEXT[q.mark] : null;

  return (
    <div
      class="rm-grid"
      data-answered={answered ? '' : undefined}
      data-over={over ? '' : undefined}
    >
      <main class="stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          class="rm-canvas"
          role="img"
          aria-label={VIEW.name.text}
          aria-describedby="rm-status"
        />
        <SceneLoader page={PAGE} done={failed !== null} />
        <div class="labels" hidden={failed !== null || !labelsShown} aria-hidden="true">
          {LINE_MARKS.map((id) => (
            <div
              key={id}
              class="lbl off"
              data-label={id}
              ref={(el) => {
                if (el) labelRefs.current.set(id, el);
                else labelRefs.current.delete(id);
              }}
            >
              <span class="lbl-btn">
                <span
                  class="lbl-icon lbl-icon-facility"
                  style={{ '--chip': APWA[MARK_COLOR[id]].fill }}
                >
                  <Icon name={MARK_ICON[id]} />
                </span>
                <span class="lbl-text">{TEXT[id].label?.text}</span>
              </span>
            </div>
          ))}
        </div>
      </main>

      {failed && (
        <p class="stage-message" role="status">
          {failed}
        </p>
      )}

      <section class="rm-panel" data-chrome aria-labelledby="rm-ask">
        <header class="rm-head">
          <div class="rm-progress">
            <p class="rm-count" hidden={over}>
              {progress(Math.min(round.at + 1, round.questions.length))}
            </p>
            <ol class="rm-dots" aria-hidden="true">
              {round.questions.map((x, i) => (
                <li
                  key={x.mark}
                  class={i < round.at || over ? 'is-done' : i === round.at ? 'is-now' : undefined}
                />
              ))}
            </ol>
          </div>
          <div class="rm-tools">
            <button
              type="button"
              class={`icon-button rm-labels${labelsShown ? ' is-on' : ''}`}
              aria-pressed={labelsShown}
              aria-label={UI.labels.text}
              title={UI.labels.text}
              onClick={() => {
                setSettings({ ...settings, labels: labelsShown ? 'off' : 'on' });
              }}
            >
              <Icon name="labels" />
            </button>
            <button
              type="button"
              class="button button-secondary rm-key"
              aria-haspopup="dialog"
              onClick={() => {
                setKeyOpen(true);
              }}
            >
              <Icon name="key" />
              {UI.key.text}
            </button>
          </div>
        </header>

        <ScrollMore class="rm-body" label={UI.more.text} bodyRef={bodyRef}>
          {over ? (
            <div class="rm-end">
              <h2 id="rm-ask" class="rm-ask" tabIndex={-1} ref={askRef}>
                {scoreLine(score(round))}
              </h2>
              <p>{END.all.text}</p>
              <p class="rm-safety">
                <Icon name="dig" />
                <span>{END.safety.text}</span>
              </p>
              <h3 class="rm-code-title">{KEY.heading.text}</h3>
              <CodeList />
            </div>
          ) : (
            q &&
            right &&
            markText && (
              <div class="rm-question">
                {round.at === 0 && !answered && (
                  <p class="rm-intro">
                    <Rich text={INTRO.scene.text} define={define} /> {INTRO.how.text}
                  </p>
                )}
                <p class="rm-color">
                  <Swatch color={right} />
                  <Icon name="flag" />
                  {CODE[right].name}
                </p>
                <h2 id="rm-ask" class="rm-ask" tabIndex={-1} ref={askRef}>
                  {markText.ask.text}
                </h2>
                <div class="rm-answers" role="group" aria-label={UI.answers.text}>
                  {q.choices.map((c, i) => {
                    const isRight = answered && c === right;
                    const isPicked = answered && c === q.picked;
                    return (
                      <button
                        key={c}
                        type="button"
                        class={`rm-answer${isRight ? ' is-right' : ''}${isPicked && !isRight ? ' is-wrong' : ''}`}
                        aria-disabled={answered ? 'true' : undefined}
                        aria-keyshortcuts={String(i + 1)}
                        onClick={() => {
                          if (!answered) pick(c);
                        }}
                      >
                        <span class="rm-answer-key" aria-hidden="true">
                          {i + 1}
                        </span>
                        <span class="rm-answer-text">{CODE[c].answer.text}</span>
                        {isRight && (
                          <span class="rm-answer-tag">
                            <Icon name="check" />
                            {UI.rightAnswer.text}
                          </span>
                        )}
                        {isPicked && !isRight && (
                          <span class="rm-answer-tag">
                            <Icon name="close" />
                            {UI.yours.text}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {answered && q.picked && (
                  <div class="rm-result" ref={resultRef}>
                    <p class="rm-verdict">
                      <Icon name={q.picked === right ? 'check' : 'close'} />
                      <span>
                        <Rich text={feedback(q.picked === right, right)} define={define} />
                      </span>
                    </p>
                    <p class="rm-found">
                      <Icon name={MARK_ICON[q.mark]} />
                      <span>{markText.reveal.text}</span>
                    </p>
                  </div>
                )}
              </div>
            )
          )}
        </ScrollMore>

        {(answered || over) && (
          <footer class="rm-foot">
            {over ? (
              <button
                type="button"
                class="button button-primary rm-next"
                ref={nextRef}
                onClick={playAgain}
              >
                <Icon name="again" />
                {UI.again.text}
              </button>
            ) : (
              <button
                type="button"
                class="button button-primary rm-next"
                ref={nextRef}
                onClick={moveOn}
              >
                {round.at === round.questions.length - 1 ? UI.finish.text : UI.next.text}
                <Icon name="forward" />
              </button>
            )}
          </footer>
        )}
      </section>

      <p id="rm-status" class="sr-only" role="status">
        {status}
      </p>

      <Dialog
        open={keyOpen}
        onClose={() => {
          setKeyOpen(false);
        }}
        title={KEY.heading.text}
        closeLabel={UI.close.text}
      >
        <p class="rm-key-lede">{KEY.lede.text}</p>
        <CodeList />
      </Dialog>
    </div>
  );
}
