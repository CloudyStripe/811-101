/**
 * The game's lines, filled in from the content: an answer's one line ("Not quite. Yellow means gas,
 * oil, steam, petroleum or gaseous materials."), the progress, the score, and what the view shows,
 * in words, for screen readers. Term markup is kept, for the page to show the terms.
 */
import { CODE, END, FEEDBACK, MARKS, UI, VIEW } from '../../../content/basics/read-the-marks.ts';
import type { ApwaCode } from '../../design/apwa.ts';
import { plainText } from '../../content-kit/terms.ts';
import type { MarkId } from './game.ts';

/** Fills a line's {placeholders}; one it has no value for stays as it is. */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

/** Lowers a phrase's first letter, inside a term's markup if it starts with one. */
export function lowerFirst(text: string): string {
  const at = text.startsWith('[[') ? 2 : 0;
  return text.slice(0, at) + text.charAt(at).toLowerCase() + text.slice(at + 1);
}

/** What a color means, as an answer's line says it: "Yellow means gas, oil, …". */
export function feedback(right: boolean, color: ApwaCode): string {
  const line = right ? FEEDBACK.right : FEEDBACK.wrong;
  return fill(line.text, {
    Color: CODE[color].name,
    meaning: lowerFirst(CODE[color].meaning.text),
  });
}

export const progress = (n: number): string => fill(UI.progress.text, { n: String(n) });

export const scoreLine = (n: number): string => fill(END.score.text, { n: String(n) });

/**
 * The view, in words: the yard, then the mark that's lit; once it's answered, what's under it, as
 * the ground opens to show; at the end, every line open. (The answer itself, Next carries.)
 */
export function viewSummary(state: {
  mark: MarkId | null;
  answered?: boolean;
  over: boolean;
}): string {
  const yard = VIEW.summary.text;
  if (state.over) return `${yard} ${VIEW.end.text}`;
  if (!state.mark) return yard;
  const text = MARKS[state.mark];
  return `${yard} ${plainText(state.answered ? text.reveal.text : text.lit.text)}`;
}
