/**
 * The one set of step controls, at the foot of the guide (on phones, under its bar): in the
 * overview, the way in, Start at the beginning; at a stop, the overview and back (round buttons, by
 * their icons), where the journey is ("Step 6 of 9", over a strip of its stops in their paths'
 * shapes) and on: to the next stop, to its path's quiz, or at the fork with no path chosen, to the
 * choice; in a quiz, back, and Finish, to the overview.
 */
import { stopById } from '../../../../content/utilities/gas-petroleum.ts';
import { Icon } from '../../../design/icons.tsx';
import { back, forward, progressOf, stopsOf, type Journey } from '../journey.ts';
import { PathShape } from './PathShape.tsx';

export function StepBar(props: {
  journey: Journey | null;
  onStart: () => void;
  onOverview: () => void;
  onBack: () => void;
  onNext: () => void;
  onChoose: () => void;
}) {
  const { journey } = props;
  if (!journey) {
    return (
      <div class="stepbar stepbar-start">
        <button type="button" class="button button-primary" onClick={props.onStart}>
          <Icon name="play" />
          Start at the beginning
        </button>
        <p class="stepbar-note">The stops both fuels share, then you choose a path.</p>
      </div>
    );
  }
  const { step, of } = progressOf(journey);
  const next = forward(journey);
  const toQuiz = next?.quiz === true;
  // At the fork with no path chosen, the way on is the choice.
  const atFork = !journey.quiz && next === null;
  return (
    <nav class="stepbar" aria-label="Steps">
      {!journey.quiz && (
        <button
          type="button"
          class="icon-button stepbar-overview"
          aria-label="Overview"
          title="Overview"
          onClick={props.onOverview}
        >
          <Icon name="map" />
        </button>
      )}
      <button
        type="button"
        class="icon-button stepbar-back"
        aria-label="Back"
        title="Back"
        aria-disabled={back(journey) === null || undefined}
        onClick={props.onBack}
      >
        <Icon name="back" />
      </button>
      <div class="stepbar-where">
        <span>{journey.quiz ? 'Quiz' : `Step ${String(step)} of ${String(of)}`}</span>
        <Strip journey={journey} />
      </div>
      {/* Keyed by where it goes, so focus stays on Next from step to step, but not into the quiz. */}
      {journey.quiz ? (
        <button
          key="finish"
          type="button"
          class="button button-primary"
          aria-label="Finish, back to the overview"
          onClick={props.onNext}
        >
          Finish
          <Icon name="check" />
        </button>
      ) : atFork ? (
        <button key="choose" type="button" class="button button-primary" onClick={props.onChoose}>
          Choose a path
          <Icon name="forward" />
        </button>
      ) : (
        <button
          key="next"
          type="button"
          class="button button-primary"
          aria-label={toQuiz ? 'Take the quiz' : 'Next step'}
          onClick={props.onNext}
        >
          {toQuiz ? 'Quiz' : 'Next'}
          <Icon name="forward" />
        </button>
      )}
    </nav>
  );
}

/**
 * Where the journey is, at a glance: its stops in their paths' shapes, the ones passed filled and
 * the one it's at in ink, then the fork ahead while no path is chosen. The words over it say it to
 * screen readers, so the strip itself is hidden from them.
 */
function Strip({ journey }: { journey: Journey }) {
  return (
    <ol class="stepbar-strip" aria-hidden="true">
      {stopsOf(journey.path).map((id, i) => {
        const done = journey.quiz || i < journey.index;
        const here = !journey.quiz && i === journey.index;
        return (
          <li key={id} data-state={done ? 'done' : here ? 'current' : undefined}>
            <PathShape path={stopById(id).path} current={here} />
          </li>
        );
      })}
      {journey.path === null && (
        <li class="stepbar-fork">
          <svg viewBox="0 0 14 10">
            <path d="M1 5h5l6-4M6 5l6 4" />
          </svg>
        </li>
      )}
    </ol>
  );
}
