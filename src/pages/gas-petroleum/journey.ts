/**
 * The story the diorama tells, as a pure state machine. One start walks the shared stops to the
 * fork, where the reader chooses a path; that path's own stops follow, then its quiz. A tour button
 * chooses the path up front. The end of a path offers the other one from the fork, so the shared
 * start isn't walked twice. Opening a stop off the journey's way ends it.
 */
import { TOURS, type StopId } from '../../../content/utilities/gas-petroleum.ts';

export type PathKey = keyof typeof TOURS;

export const PATHS: readonly PathKey[] = ['gas', 'gasoline'];

/** Where the two paths part: the last stop they share. */
export const FORK: StopId = 'lifting';

const GAS: readonly StopId[] = TOURS.gas.stops;

/** The stops every journey starts with, the fork last. */
export const SHARED: readonly StopId[] = GAS.slice(0, GAS.indexOf(FORK) + 1);

export interface Journey {
  /** The path chosen, at the fork or up front; null until then. */
  readonly path: PathKey | null;
  /** Which of its stops the journey is at. */
  readonly index: number;
  /** Past its last stop: the path's quiz. */
  readonly quiz: boolean;
}

export const otherPath = (path: PathKey): PathKey => (path === 'gas' ? 'gasoline' : 'gas');

/** A journey's stops: the shared start, then its path's own once one is chosen. */
export function stopsOf(path: PathKey | null): readonly StopId[] {
  return path ? TOURS[path].stops : SHARED;
}

/** A journey from the start, on a path chosen up front, or with the choice still to come. */
export function begin(path: PathKey | null = null): Journey {
  return { path, index: 0, quiz: false };
}

/** A path's journey from the fork: what the end of the other path offers. */
export function fromFork(path: PathKey): Journey {
  return { path, index: SHARED.length - 1, quiz: false };
}

/** Choosing a path: on to its first stop of its own. */
export function choose(path: PathKey): Journey {
  return { path, index: SHARED.length, quiz: false };
}

/** The stop the journey is at, or null at its quiz. */
export function stopAt(journey: Journey): StopId | null {
  return journey.quiz ? null : (stopsOf(journey.path)[journey.index] ?? null);
}

/** The next step, or null: at the fork before a path is chosen, and after the quiz. */
export function forward(journey: Journey): Journey | null {
  if (journey.quiz) return null;
  if (journey.index < stopsOf(journey.path).length - 1) {
    return { ...journey, index: journey.index + 1 };
  }
  return journey.path ? { ...journey, quiz: true } : null;
}

/** The step before, or null at the start. */
export function back(journey: Journey): Journey | null {
  if (journey.quiz) return { ...journey, quiz: false };
  return journey.index > 0 ? { ...journey, index: journey.index - 1 } : null;
}

/**
 * The journey once the reader opens a stop some other way, from the map or a label: still under
 * way if the stop is on its way; up to the fork, going down either path chooses it, as the fork's
 * own choice does; past it, or from the quiz, a stop off the way ends the journey (null).
 */
export function reach(journey: Journey, stop: StopId): Journey | null {
  const here = stopsOf(journey.path).indexOf(stop);
  if (here >= 0) return { ...journey, index: here, quiz: false };
  if (journey.quiz || journey.index >= SHARED.length) return null;
  const path = PATHS.find((p) => stopsOf(p).includes(stop));
  return path ? { path, index: stopsOf(path).indexOf(stop), quiz: false } : null;
}

/** How far along: the step it's at, of how many, counting the shared start and the path's own. */
export function progressOf(journey: Journey): { step: number; of: number } {
  const of = stopsOf(journey.path).length;
  return { step: journey.quiz ? of : journey.index + 1, of };
}
