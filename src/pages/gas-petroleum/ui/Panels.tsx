/**
 * What the guide shows: the overview with one way to start, its map and its tours; a stop, with
 * the fork's choice of path; a path's quiz, and where to go after it; and the bar that steps
 * through a journey, with a strip of where it is. Every sentence of the lesson comes from the
 * content module, word for word; the rest is the guide's own wording.
 */
import { useState } from 'preact/hooks';
import {
  OVERVIEW,
  PATH_NAMES,
  QUIZZES,
  TERMS,
  TIMELAPSE,
  TIMELAPSE_NOTE,
  TOURS,
  TOUR_SPANS,
  stopById,
  type StopId,
} from '../../../../content/utilities/gas-petroleum.ts';
import { plainText } from '../../../content-kit/terms.ts';
import { Icon } from '../../../design/icons.tsx';
import { PATH_STYLE } from '../../../design/paths.ts';
import { Rich } from '../../../design/Term.tsx';
import { pageById } from '../../../site/pages.ts';
import {
  FORK,
  PATHS,
  SHARED,
  back,
  forward,
  otherPath,
  progressOf,
  stopsOf,
  type Journey,
  type PathKey,
} from '../journey.ts';
import type { TimeLapseState } from '../scene/timelapse.ts';
import { clockText } from '../summary.ts';
import { RouteMap } from './RouteMap.tsx';

export const define = (key: string): string | undefined => TERMS[key]?.text;

const BASE = import.meta.env.BASE_URL;

export function OverviewPanel(props: {
  onStart: () => void;
  onTour: (path: PathKey) => void;
  onOpen: (id: StopId) => void;
}) {
  return (
    <>
      <p class="lead">
        {OVERVIEW.text.map((c, i) => (
          <span key={c.id}>
            {i > 0 && ' '}
            <Rich text={c.text} define={define} />
          </span>
        ))}
      </p>
      <div class="start">
        <button type="button" class="button button-primary" onClick={props.onStart}>
          <Icon name="play" />
          Start at the beginning
        </button>
        <p class="start-note">The stops both fuels share, then you choose a path.</p>
      </div>
      <RouteMap onOpen={props.onOpen} />
      <p class="eyebrow tour-title">Or one path from start to end</p>
      <div class="tour-pick">
        {PATHS.map((path) => (
          <button
            key={path}
            type="button"
            class="tour-button"
            data-path={path}
            onClick={() => {
              props.onTour(path);
            }}
          >
            <Icon name={PATH_STYLE[path].icon} />
            <span>
              <b>{TOURS[path].name} tour</b>
              <small>
                {TOURS[path].stops.length} steps, {TOUR_SPANS[path]}
              </small>
            </span>
          </button>
        ))}
      </div>
      <ul class="howto">
        <li>Open any labeled place, or a stop on the map, to learn about it.</li>
        <li>Drag the model, or use the turn buttons, to look around it.</li>
        <li>Underlined words have short definitions. Hover or tap them.</li>
        <li>
          Keyboard: ← and → step through the stops. With the model focused, the arrow keys turn it
          and Home sets it straight.
        </li>
      </ul>
    </>
  );
}

/**
 * The formation time-lapse: its clock and caption, steps back and forth through it (held still,
 * and stopping a replay), and the replay.
 */
function TimeLapseBox(props: {
  state: TimeLapseState;
  onPlay: () => void;
  onStep: (step: number) => void;
}) {
  const { state } = props;
  const step = state.caption;
  const earlier = step > 0;
  const later = step < TIMELAPSE.length - 1;
  return (
    <div class="tl">
      <p class="tl-clock" aria-live="off">
        {clockText(state.ma)}
      </p>
      <div class="tl-bar" aria-hidden="true">
        <i style={{ width: `${(state.progress * 100).toFixed(1)}%` }} />
      </div>
      <p class="tl-caption" aria-live="polite">
        {TIMELAPSE[step]?.caption.text ?? ''}
      </p>
      <div class="tl-controls">
        <button
          type="button"
          class="icon-button"
          aria-label="Earlier in the time-lapse"
          title="Earlier"
          aria-disabled={!earlier || undefined}
          onClick={() => {
            if (earlier) props.onStep(step - 1);
          }}
        >
          <Icon name="back" />
        </button>
        <button
          type="button"
          class="icon-button"
          aria-label="Later in the time-lapse"
          title="Later"
          aria-disabled={!later || undefined}
          onClick={() => {
            if (later) props.onStep(step + 1);
          }}
        >
          <Icon name="forward" />
        </button>
        <button
          type="button"
          class="button button-primary"
          aria-disabled={state.playing}
          onClick={() => {
            if (!state.playing) props.onPlay();
          }}
        >
          <Icon name="play" />
          {state.playing ? 'Playing…' : 'Play the formation time-lapse'}
        </button>
      </div>
      <p class="tl-note">
        {TIMELAPSE_NOTE.howTo} {TIMELAPSE_NOTE.illustrative.text}
      </p>
    </div>
  );
}

/** The next and previous stops along a stop's path, and the fork's two ways on. */
export function neighbors(id: StopId, lean: PathKey): { prev: StopId | null; next: StopId[] } {
  const stop = stopById(id);
  const path: PathKey = stop.path === 'shared' ? lean : stop.path;
  const seq = stopsOf(path);
  const i = seq.indexOf(id);
  const prev = i > 0 ? (seq[i - 1] ?? null) : null;
  if (id === FORK) return { prev, next: PATHS.map((p) => stopsOf(p)[SHARED.length] ?? id) };
  if (i < seq.length - 1) return { prev, next: [seq[i + 1] ?? id] };
  // One path's end leads to the other path.
  return { prev, next: [stopsOf(otherPath(path))[SHARED.length] ?? id] };
}

/**
 * The fork: the two ways on, each with its path's pattern and icon, where it goes first and how
 * far it runs. The path already chosen, if any, says so.
 */
export function ForkChoice(props: { chosen: PathKey | null; onChoose: (path: PathKey) => void }) {
  return (
    <div class="fork" role="group" aria-labelledby="fork-title">
      <p class="fork-title" id="fork-title">
        Choose a path
      </p>
      {PATHS.map((path) => {
        const own = stopsOf(path).slice(SHARED.length);
        const first = own[0];
        const style = PATH_STYLE[path];
        return (
          <button
            key={path}
            type="button"
            class="fork-way"
            data-path={path}
            data-chosen={props.chosen === path ? '' : undefined}
            onClick={() => {
              props.onChoose(path);
            }}
          >
            <span class="fork-mark" aria-hidden="true" style={{ '--path': style.color }}>
              <Icon name={style.icon} />
            </span>
            <span class="fork-text">
              <b>{PATH_NAMES[path]}</b>
              <small>
                {first ? `Next: ${stopById(first).label}, ` : ''}
                {own.length} stops{props.chosen === path ? ', your path' : ''}
              </small>
            </span>
            {/* A piece of the path's line, drawn as on the map and in the view. */}
            <svg class="fork-line" viewBox="0 0 40 10" aria-hidden="true">
              <path
                class="rmap-line"
                d="M3 5H37"
                stroke={style.color}
                stroke-dasharray={style.pattern === 'dashed' ? '7 5' : undefined}
              />
              {style.pattern === 'banded' && (
                <path class="rmap-bands" d="M3 5H37" stroke-dasharray="2.5 7" />
              )}
            </svg>
            <Icon name="forward" />
          </button>
        );
      })}
    </div>
  );
}

export function StopPanel(props: {
  stop: StopId;
  journey: Journey | null;
  lean: PathKey;
  /** Whether the 3D view is there: without it, the time-lapse has nothing to show. */
  hasView: boolean;
  timeLapse: TimeLapseState;
  onPlayTimeLapse: () => void;
  onStepTimeLapse: (step: number) => void;
  onOpen: (id: StopId) => void;
  onChoose: (path: PathKey) => void;
}) {
  const stop = stopById(props.stop);
  const { prev, next } = neighbors(props.stop, props.lean);
  const fork = props.stop === FORK;
  return (
    <>
      <p class="eyebrow stop-path" data-path={stop.path}>
        <Icon name={PATH_STYLE[stop.path].icon} />
        {PATH_NAMES[stop.path]}
        {!props.journey && <span class="stop-step">Stage {stop.step}</span>}
      </p>
      <p class="lead">
        {stop.text.map((c, i) => (
          <span key={c.id}>
            {i > 0 && ' '}
            <Rich text={c.text} define={define} />
          </span>
        ))}
      </p>
      {stop.note && (
        <p class="note">
          <Icon name="map" />
          <span>
            <Rich text={stop.note.text} define={define} />
          </span>
        </p>
      )}
      {stop.id === 'formation' && props.hasView && (
        <TimeLapseBox
          state={props.timeLapse}
          onPlay={props.onPlayTimeLapse}
          onStep={props.onStepTimeLapse}
        />
      )}
      {fork && <ForkChoice chosen={props.journey?.path ?? null} onChoose={props.onChoose} />}
      {stop.safety && (
        <p class="callout">
          <b>Safety tip:</b> <Rich text={stop.safety.text} define={define} />
        </p>
      )}
      {!props.journey && (
        <nav class="stop-nav" aria-label="Stops">
          {prev ? (
            <button
              type="button"
              class="button button-secondary"
              onClick={() => {
                props.onOpen(prev);
              }}
            >
              <Icon name="back" />
              {stopById(prev).label}
            </button>
          ) : (
            <span />
          )}
          {!fork && (
            <span class="stop-nav-next">
              {next.map((id) => {
                const to = stopById(id);
                // At a path's end, the way on is the other path, marked as such.
                const across = to.path !== stop.path;
                return (
                  <button
                    key={id}
                    type="button"
                    class={across ? 'button button-secondary' : 'button button-primary'}
                    data-path={across ? to.path : undefined}
                    onClick={() => {
                      props.onOpen(id);
                    }}
                  >
                    {across ? (
                      <>
                        <Icon name={PATH_STYLE[to.path].icon} />
                        {PATH_NAMES[to.path]}
                      </>
                    ) : (
                      `Next: ${to.label}`
                    )}
                    <Icon name="forward" />
                  </button>
                );
              })}
            </span>
          )}
        </nav>
      )}
    </>
  );
}

export function QuizPanel(props: {
  path: PathKey;
  answers: readonly (number | null)[];
  onAnswer: (question: number, option: number) => void;
  onOtherPath: (path: PathKey) => void;
}) {
  const questions = QUIZZES[props.path];
  const done = props.answers.length === questions.length && props.answers.every((a) => a !== null);
  const score = questions.filter((q, i) => props.answers[i] === q.answer).length;
  const other = otherPath(props.path);
  /** What was just answered, read out: right or not and why, then the score once all are in. */
  const [said, setSaid] = useState('');
  function answer(question: number, option: number) {
    props.onAnswer(question, option);
    const q = questions[question];
    if (!q) return;
    const answers = questions.map((_, k) => (k === question ? option : props.answers[k]));
    const all = answers.every((a) => a !== null && a !== undefined);
    const got = questions.filter((each, k) => answers[k] === each.answer).length;
    setSaid(
      `${option === q.answer ? 'Correct.' : 'Not quite.'} ${plainText(q.why.text)}` +
        (all ? ` You got ${String(got)} of ${String(questions.length)}.` : ''),
    );
  }
  return (
    <>
      <p class="sr-only" aria-live="polite">
        {said}
      </p>
      {questions.map((q, i) => {
        const chosen = props.answers[i] ?? null;
        return (
          <section key={q.prompt} class="q" aria-labelledby={`q-${String(i)}`}>
            <h3 id={`q-${String(i)}`}>
              {i + 1}. {q.prompt}
            </h3>
            <div class="q-options">
              {q.options.map((option, j) => {
                const right = chosen !== null && j === q.answer;
                const wrong = chosen === j && j !== q.answer;
                return (
                  <button
                    key={option}
                    type="button"
                    class="q-option"
                    data-mark={right ? 'right' : wrong ? 'wrong' : undefined}
                    aria-disabled={chosen !== null || undefined}
                    onClick={() => {
                      if (chosen === null) answer(i, j);
                    }}
                  >
                    {right && <Icon name="check" />}
                    {wrong && <Icon name="close" />}
                    <span>{option}</span>
                    {right && <span class="q-mark">Correct answer</span>}
                    {wrong && <span class="q-mark">Your answer</span>}
                  </button>
                );
              })}
            </div>
            {chosen !== null && (
              <p class="q-why">
                <b>{chosen === q.answer ? 'Correct.' : 'Not quite.'}</b> {q.why.text}
              </p>
            )}
          </section>
        );
      })}
      {done && (
        <div class="q-end">
          <p class="q-score">
            You got {score} of {questions.length}.
          </p>
          <p>
            {score === questions.length
              ? 'Nicely done. You followed the whole journey.'
              : 'The tour is always here if you want another look.'}
          </p>
          <div class="q-next">
            <button
              type="button"
              class="button button-primary"
              data-path={other}
              onClick={() => {
                props.onOtherPath(other);
              }}
            >
              <Icon name={PATH_STYLE[other].icon} />
              Take the {TOURS[other].name.toLowerCase()} path, from the fork
            </button>
            <a class="button button-secondary" href={`${BASE}${pageById('frequency-lab').path}`}>
              On to the Frequency Lab
            </a>
            <a class="button button-secondary" href={BASE}>
              All lessons
            </a>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Where a journey is, at a glance: the shared start's stops, then the chosen path's own, or the
 * fork ahead while none is chosen. The words beside it (the step, or the view's summary) say it to
 * screen readers, so the strip itself is hidden from them.
 */
export function JourneyStrip({ journey }: { journey: Journey }) {
  return (
    <ol class="jstrip" aria-hidden="true">
      {stopsOf(journey.path).map((id, i) => {
        const path = stopById(id).path;
        return (
          <li
            key={id}
            data-path={path}
            data-state={
              journey.quiz || i < journey.index
                ? 'done'
                : i === journey.index
                  ? 'current'
                  : undefined
            }
            style={path === 'shared' ? undefined : { '--path': PATH_STYLE[path].color }}
          />
        );
      })}
      {journey.path === null && (
        <li class="jstrip-fork">
          <svg viewBox="0 0 14 10">
            <path d="M1 5h5l6-4M6 5l6 4" />
          </svg>
        </li>
      )}
    </ol>
  );
}

/** Steps through a journey: back, where it is, and on (or to its quiz, or the end). */
export function JourneyBar(props: { journey: Journey; onBack: () => void; onNext: () => void }) {
  const { journey } = props;
  const { step, of } = progressOf(journey);
  const next = forward(journey);
  const toQuiz = next?.quiz === true;
  // At the fork with no path chosen, the way on is the choice above.
  const waiting = !journey.quiz && next === null;
  return (
    <div class="tourbar">
      <button
        type="button"
        class="button button-secondary"
        aria-disabled={back(journey) === null || undefined}
        onClick={props.onBack}
      >
        <Icon name="back" />
        Back
      </button>
      <div class="tourbar-progress">
        <span>{journey.quiz ? 'Quiz' : `Step ${String(step)} of ${String(of)}`}</span>
        <JourneyStrip journey={journey} />
      </div>
      <button
        type="button"
        class="button button-primary"
        aria-label={
          journey.quiz ? 'Finish, back to the overview' : toQuiz ? 'Take the quiz' : 'Next step'
        }
        aria-disabled={waiting || undefined}
        title={waiting ? 'Choose a path first' : undefined}
        onClick={props.onNext}
      >
        {journey.quiz ? 'Finish' : toQuiz ? 'Quiz' : 'Next'}
        <Icon name="forward" />
      </button>
    </div>
  );
}
