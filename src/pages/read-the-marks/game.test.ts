import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../kit3d/rng.ts';
import {
  CHOICES,
  CONFUSED_WITH,
  FIRST,
  MARK_COLOR,
  MARK_IDS,
  answer,
  choicesFor,
  current,
  isOver,
  isRight,
  newRound,
  next,
  openMarks,
  score,
  type Round,
} from './game.ts';

/** Answers every question, right or wrong as asked, and moves on past each. */
function play(round: Round, right: (i: number) => boolean): Round {
  let r = round;
  while (!isOver(r)) {
    const q = current(r);
    if (!q) break;
    const color = right(r.at)
      ? MARK_COLOR[q.mark]
      : (q.choices.find((c) => c !== MARK_COLOR[q.mark]) ?? MARK_COLOR[q.mark]);
    r = next(answer(r, color));
  }
  return r;
}

describe('a round', () => {
  it('asks about white first, then every other mark once', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const round = newRound(mulberry32(seed));
      const marks = round.questions.map((q) => q.mark);
      expect(marks[0]).toBe(FIRST);
      expect(MARK_COLOR[FIRST]).toBe('white');
      expect([...marks].sort()).toEqual([...MARK_IDS].sort());
    }
  });

  it('comes in a new order from round to round', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      orders.add(
        newRound(mulberry32(seed))
          .questions.map((q) => q.mark)
          .join(),
      );
    }
    expect(orders.size).toBeGreaterThan(25);
  });

  it('offers four different answers, the right one among them, and one easily confused', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const q of newRound(mulberry32(seed)).questions) {
        const right = MARK_COLOR[q.mark];
        expect(q.choices).toHaveLength(CHOICES);
        expect(new Set(q.choices).size).toBe(CHOICES);
        expect(q.choices).toContain(right);
        expect(q.choices.some((c) => CONFUSED_WITH[right].includes(c))).toBe(true);
      }
    }
  });

  it('shuffles where the right answer sits', () => {
    const places = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      places.add(choicesFor('yellow', mulberry32(seed)).indexOf('yellow'));
    }
    expect(places.size).toBe(CHOICES);
  });

  it('takes one answer per question, and moves on only once it has one', () => {
    let round = newRound(mulberry32(7));
    const q = current(round);
    if (!q) throw new Error('no question');
    expect(next(round)).toBe(round);
    const wrong = q.choices.find((c) => c !== MARK_COLOR[q.mark]);
    if (!wrong) throw new Error('no wrong answer');
    round = answer(round, wrong);
    expect(current(round)?.picked).toBe(wrong);
    expect(answer(round, MARK_COLOR[q.mark])).toBe(round);
    expect(isRight(current(round) ?? q)).toBe(false);
    // Not one of the question's answers: ignored.
    const offered = new Set(q.choices);
    const other = Object.values(MARK_COLOR).find((c) => !offered.has(c));
    if (other) expect(answer(newRound(mulberry32(7)), other).questions[0]?.picked).toBeNull();
    expect(next(round).at).toBe(1);
  });

  it('opens the mark just answered, and every mark once the round is over', () => {
    let round = newRound(mulberry32(3));
    expect(openMarks(round)).toEqual([]);
    const q = current(round);
    if (!q) throw new Error('no question');
    round = answer(round, MARK_COLOR[q.mark]);
    expect(openMarks(round)).toEqual([q.mark]);
    round = next(round);
    expect(openMarks(round)).toEqual([]);
    const done = play(round, () => true);
    expect(isOver(done)).toBe(true);
    expect(current(done)).toBeNull();
    expect([...openMarks(done)].sort()).toEqual([...MARK_IDS].sort());
  });

  it('counts the marks read right', () => {
    const all = play(newRound(mulberry32(11)), () => true);
    expect(score(all)).toBe(MARK_IDS.length);
    const half = play(newRound(mulberry32(11)), (i) => i % 2 === 0);
    expect(score(half)).toBe(MARK_IDS.length / 2);
  });
});
