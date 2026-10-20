/**
 * The game, as a pure state machine: a round asks about every mark in the yard once, white first
 * since it sets the scene, then the other seven in a new order each round. Each question has four
 * answers, each the meaning of a color: the right one, one that's easily mixed up with it, and two
 * at random, in a shuffled order. Nothing here draws or stores anything; the page brings the
 * randomness, so tests can seed it.
 */
import type { ApwaCode } from '../../design/apwa.ts';

export type MarkId =
  'dig' | 'gas' | 'electric' | 'communication' | 'water' | 'sewer' | 'reclaimed' | 'survey';

/** Each mark's color. */
export const MARK_COLOR: Readonly<Record<MarkId, ApwaCode>> = {
  dig: 'white',
  gas: 'yellow',
  electric: 'red',
  communication: 'orange',
  water: 'blue',
  sewer: 'green',
  reclaimed: 'purple',
  survey: 'pink',
};

/** Asked first in every round: where you'll dig, which the rest of the marks are near. */
export const FIRST: MarkId = 'dig';

/** Every mark, white first, then the rest in the code's usual order. */
export const MARK_IDS: readonly MarkId[] = [
  'dig',
  'gas',
  'electric',
  'communication',
  'water',
  'sewer',
  'reclaimed',
  'survey',
];

/**
 * The colors whose meanings are easily mixed up with each color's: neighbors in hue (red, orange
 * and pink; yellow and orange; purple and pink; blue and purple), the three kinds of water (blue,
 * purple and green), and the two marks that aren't buried lines (white and pink). A game choice,
 * not a claim about the code.
 */
export const CONFUSED_WITH: Readonly<Record<ApwaCode, readonly ApwaCode[]>> = {
  white: ['pink'],
  pink: ['white', 'purple', 'red'],
  red: ['orange', 'pink'],
  yellow: ['orange'],
  orange: ['yellow', 'red'],
  blue: ['purple', 'green'],
  purple: ['blue', 'pink'],
  green: ['blue', 'purple'],
};

/** How many answers each question offers. */
export const CHOICES = 4;

export interface Question {
  mark: MarkId;
  /** The answers, as the colors whose meanings they are, in the order shown. */
  choices: readonly ApwaCode[];
  /** The answer picked, once one is. */
  picked: ApwaCode | null;
}

export interface Round {
  /** One question per mark, in the order asked. */
  questions: readonly Question[];
  /** The question being asked, or the number of questions once the round is over. */
  at: number;
}

/** A random number in [0, 1), as Math.random gives. */
export type Random = () => number;

function shuffled<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

const pick = <T>(items: readonly T[], random: Random): T | undefined =>
  items[Math.floor(random() * items.length)];

/** A question's four answers: the right one, one easily confused with it, two more at random. */
export function choicesFor(right: ApwaCode, random: Random): ApwaCode[] {
  const all = Object.keys(MARK_COLOR).map((id) => MARK_COLOR[id as MarkId]);
  const confused = pick(
    CONFUSED_WITH[right].filter((c) => c !== right),
    random,
  );
  const chosen = new Set<ApwaCode>([right]);
  if (confused) chosen.add(confused);
  for (const c of shuffled(
    all.filter((c) => !chosen.has(c)),
    random,
  )) {
    if (chosen.size >= CHOICES) break;
    chosen.add(c);
  }
  return shuffled([...chosen], random);
}

/** A new round: white first, the other seven shuffled, each with its answers. */
export function newRound(random: Random): Round {
  const rest = shuffled(
    MARK_IDS.filter((id) => id !== FIRST),
    random,
  );
  const questions = [FIRST, ...rest].map((mark): Question => ({
    mark,
    choices: choicesFor(MARK_COLOR[mark], random),
    picked: null,
  }));
  return { questions, at: 0 };
}

/** The question being asked; none once the round is over. */
export function current(round: Round): Question | null {
  return round.questions[round.at] ?? null;
}

export const isOver = (round: Round): boolean => round.at >= round.questions.length;

/** Whether a question was answered with its mark's color. */
export const isRight = (q: Question): boolean => q.picked === MARK_COLOR[q.mark];

/** Picks an answer to the question being asked. A question takes only its first answer. */
export function answer(round: Round, color: ApwaCode): Round {
  const q = current(round);
  if (q?.picked !== null || !q.choices.includes(color)) return round;
  const questions = round.questions.map((x, i) => (i === round.at ? { ...x, picked: color } : x));
  return { ...round, questions };
}

/** On to the next question, once this one's answered; past the last, the round is over. */
export function next(round: Round): Round {
  const q = current(round);
  if ((q?.picked ?? null) === null) return round;
  return { ...round, at: round.at + 1 };
}

/** How many questions were answered right. */
export function score(round: Round): number {
  return round.questions.filter(isRight).length;
}

/** The marks whose ground is open: the one just answered, or, once the round is over, every one. */
export function openMarks(round: Round): MarkId[] {
  if (isOver(round)) return round.questions.map((q) => q.mark);
  const q = current(round);
  return q && q.picked !== null ? [q.mark] : [];
}
