/**
 * What the guide shows: the overview with its map and tours, a stop, or a tour's quiz, and the
 * bar that steps through a tour. Every sentence comes from the content module, word for word.
 */
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
import { useState } from 'preact/hooks';
import { plainText } from '../../../content-kit/terms.ts';
import { Icon } from '../../../design/icons.tsx';
import { PATH_STYLE } from '../../../design/paths.ts';
import { Rich } from '../../../design/Term.tsx';
import type { TimeLapseState } from '../scene/timelapse.ts';
import { clockText, type TourKey } from '../summary.ts';
import { RouteMap } from './RouteMap.tsx';

export const define = (key: string): string | undefined => TERMS[key]?.text;

const OTHER: Record<TourKey, TourKey> = { gas: 'gasoline', gasoline: 'gas' };

export function OverviewPanel(props: {
  onOpen: (id: StopId) => void;
  onTour: (key: TourKey) => void;
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
      <RouteMap onOpen={props.onOpen} />
      <div class="tour-pick">
        {(['gas', 'gasoline'] as const).map((key) => (
          <button
            key={key}
            type="button"
            class="tour-button"
            data-path={key}
            onClick={() => {
              props.onTour(key);
            }}
          >
            <Icon name={PATH_STYLE[key].icon} />
            <span>
              <b>{TOURS[key].name} tour</b>
              <small>
                {TOURS[key].stops.length} steps, {TOUR_SPANS[key]}
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

/** The formation time-lapse's controls: its clock, its caption, and play. */
function TimeLapseBox({ state, onPlay }: { state: TimeLapseState; onPlay: () => void }) {
  const caption = TIMELAPSE[state.caption]?.caption.text ?? '';
  return (
    <div class="tl">
      <p class="tl-clock" aria-live="off">
        {clockText(state.ma)}
      </p>
      <div class="tl-bar" aria-hidden="true">
        <i style={{ width: `${(state.progress * 100).toFixed(1)}%` }} />
      </div>
      <p class="tl-caption">{caption}</p>
      <button
        type="button"
        class="button button-primary"
        aria-disabled={state.playing}
        onClick={() => {
          if (!state.playing) onPlay();
        }}
      >
        <Icon name="play" />
        {state.playing ? 'Playing…' : 'Play the formation time-lapse'}
      </button>
      <p class="tl-note">
        {TIMELAPSE_NOTE.howTo} {TIMELAPSE_NOTE.illustrative.text}
      </p>
    </div>
  );
}

/** The next and previous stops along a stop's path, and the fork's two ways on. */
export function neighbors(id: StopId, lean: TourKey): { prev: StopId | null; next: StopId[] } {
  const stop = stopById(id);
  const tour: TourKey = stop.path === 'shared' ? lean : stop.path;
  const seq = TOURS[tour].stops as readonly StopId[];
  const i = seq.indexOf(id);
  const prev = i > 0 ? (seq[i - 1] ?? null) : null;
  if (id === 'lifting') return { prev, next: ['gas-plant', 'crude-transport'] };
  if (i < seq.length - 1) return { prev, next: [seq[i + 1] ?? id] };
  // One path's end leads to the other path.
  return { prev, next: [stop.path === 'gas' ? 'crude-transport' : 'gas-plant'] };
}

export function StopPanel(props: {
  stop: StopId;
  touring: boolean;
  lean: TourKey;
  timeLapse: TimeLapseState;
  onPlayTimeLapse: () => void;
  onOpen: (id: StopId) => void;
}) {
  const stop = stopById(props.stop);
  const { prev, next } = neighbors(props.stop, props.lean);
  return (
    <>
      <p class="eyebrow stop-path" data-path={stop.path}>
        <Icon name={PATH_STYLE[stop.path].icon} />
        {PATH_NAMES[stop.path]}
        {!props.touring && <span class="stop-step">Stage {stop.step}</span>}
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
      {stop.id === 'formation' && (
        <TimeLapseBox state={props.timeLapse} onPlay={props.onPlayTimeLapse} />
      )}
      {stop.safety && (
        <p class="callout">
          <b>Safety tip:</b> <Rich text={stop.safety.text} define={define} />
        </p>
      )}
      {!props.touring && (
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
          <span class="stop-nav-next">
            {next.map((id) => {
              const to = stopById(id);
              const fork = props.stop === 'lifting' || to.path !== stop.path;
              return (
                <button
                  key={id}
                  type="button"
                  class={fork ? 'button button-secondary' : 'button button-primary'}
                  data-path={fork ? to.path : undefined}
                  onClick={() => {
                    props.onOpen(id);
                  }}
                >
                  {fork ? (
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
        </nav>
      )}
    </>
  );
}

export function QuizPanel(props: {
  tour: TourKey;
  answers: readonly (number | null)[];
  onAnswer: (question: number, option: number) => void;
  onTour: (key: TourKey) => void;
}) {
  const questions = QUIZZES[props.tour];
  const done = props.answers.length === questions.length && props.answers.every((a) => a !== null);
  const score = questions.filter((q, i) => props.answers[i] === q.answer).length;
  const other = OTHER[props.tour];
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
          <button
            type="button"
            class="button button-primary"
            data-path={other}
            onClick={() => {
              props.onTour(other);
            }}
          >
            <Icon name={PATH_STYLE[other].icon} />
            Take the {TOURS[other].name.toLowerCase()} tour
          </button>
        </div>
      )}
    </>
  );
}

export function TourBar(props: {
  tour: TourKey;
  index: number;
  quiz: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const n = TOURS[props.tour].stops.length;
  const last = props.index === n - 1;
  return (
    <div class="tourbar">
      <button
        type="button"
        class="button button-secondary"
        aria-disabled={(!props.quiz && props.index === 0) || undefined}
        onClick={props.onBack}
      >
        <Icon name="back" />
        Back
      </button>
      <div class="tourbar-progress">
        <span>{props.quiz ? 'Quiz' : `Step ${String(props.index + 1)} of ${String(n)}`}</span>
        <span class="tourbar-dots" aria-hidden="true">
          {Array.from({ length: n }, (_, i) => (
            <i
              key={i}
              data-state={
                props.quiz || i < props.index ? 'done' : i === props.index ? 'current' : undefined
              }
            />
          ))}
        </span>
      </div>
      <button
        type="button"
        class="button button-primary"
        aria-label={props.quiz ? 'Finish the tour' : last ? 'Take the quiz' : 'Next step'}
        onClick={props.onNext}
      >
        {props.quiz ? 'Finish' : last ? 'Quiz' : 'Next'}
        <Icon name="forward" />
      </button>
    </div>
  );
}
