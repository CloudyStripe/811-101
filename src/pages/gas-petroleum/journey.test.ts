import { describe, expect, it } from 'vitest';
import { TOURS } from '../../../content/utilities/gas-petroleum.ts';
import {
  FORK,
  SHARED,
  back,
  begin,
  choose,
  forward,
  fromFork,
  otherPath,
  progressOf,
  reach,
  stopAt,
  type Journey,
} from './journey.ts';

/** Steps forward from a journey until it stops, noting each stop (null for the quiz). */
function walk(from: Journey): (string | null)[] {
  const seen: (string | null)[] = [stopAt(from)];
  for (let j = forward(from); j; j = forward(j)) seen.push(stopAt(j));
  return seen;
}

describe('the journey', () => {
  it('starts with the stops both paths share, the fork last', () => {
    expect(SHARED.at(-1)).toBe(FORK);
    expect(TOURS.gas.stops.slice(0, SHARED.length)).toEqual(SHARED);
    expect(TOURS.gasoline.stops.slice(0, SHARED.length)).toEqual(SHARED);
  });

  it('from Start, walks the shared start and waits at the fork for a choice', () => {
    expect(walk(begin())).toEqual(SHARED);
  });

  it('once a path is chosen, walks its own stops, then its quiz, then ends', () => {
    expect(walk(choose('gas'))).toEqual([...TOURS.gas.stops.slice(SHARED.length), null]);
    expect(stopAt(choose('gasoline'))).toBe(TOURS.gasoline.stops[SHARED.length]);
  });

  it('with a path chosen up front, goes through the fork without stopping', () => {
    expect(walk(begin('gasoline'))).toEqual([...TOURS.gasoline.stops, null]);
  });

  it('steps back from the quiz to the last stop, and back to the fork keeping the path', () => {
    let j: Journey | null = { path: 'gas', index: TOURS.gas.stops.length - 1, quiz: true };
    j = back(j);
    expect(j && stopAt(j)).toBe('gas-uses');
    j = back(choose('gas'));
    expect(j).toEqual({ path: 'gas', index: SHARED.length - 1, quiz: false });
    expect(back(begin())).toBeNull();
  });

  it('offers the other path from the fork, so the shared start is not walked twice', () => {
    expect(otherPath('gas')).toBe('gasoline');
    const j = fromFork(otherPath('gas'));
    expect(stopAt(j)).toBe(FORK);
    expect(forward(j)).toEqual(choose('gasoline'));
  });

  it('keeps going when the reader opens a stop on its way, and ends off it', () => {
    const shared = reach(begin(), 'drilling');
    expect(shared && stopAt(shared)).toBe('drilling');
    // On the shared start, opening a stop of either path chooses that path.
    expect(reach(begin(), 'city-gate')).toEqual({
      path: 'gas',
      index: TOURS.gas.stops.indexOf('city-gate'),
      quiz: false,
    });
    // Up to the fork, even with a path chosen, going down the other one switches to it.
    expect(reach(fromFork('gas'), 'crude-transport')).toEqual(choose('gasoline'));
    expect(reach(begin('gas'), 'pump')).toEqual({
      path: 'gasoline',
      index: TOURS.gasoline.stops.indexOf('pump'),
      quiz: false,
    });
    // Past the fork, the other path's stops are off the way.
    expect(reach(choose('gas'), 'pump')).toBeNull();
    expect(reach({ path: 'gas', index: 2, quiz: true }, 'reservoir')).toEqual({
      path: 'gas',
      index: 1,
      quiz: false,
    });
  });

  it('counts its steps: the shared start alone until a path is chosen', () => {
    expect(progressOf(begin())).toEqual({ step: 1, of: SHARED.length });
    expect(progressOf(choose('gas'))).toEqual({ step: 5, of: TOURS.gas.stops.length });
    expect(progressOf({ path: 'gasoline', index: 7, quiz: true })).toEqual({ step: 8, of: 8 });
  });
});
