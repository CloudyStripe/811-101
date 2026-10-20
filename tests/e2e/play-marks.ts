/** Playing Read the Marks in a test: which mark is asked, and its answers, right or not. */
import type { Page } from '@playwright/test';
import { CODE, MARKS as TEXT, UI } from '../../content/basics/read-the-marks.ts';
import { MARKS_APWA, type ApwaCode } from '../../src/design/apwa.ts';
import { MARK_COLOR, MARK_IDS, type MarkId } from '../../src/pages/read-the-marks/game.ts';
import { expect, waitReady } from './fixtures.ts';

/** Opens the lesson on a seeded round, so its order is the same each run. */
export async function openMarks(page: Page, query = ''): Promise<void> {
  await page.goto(`basics/read-the-marks/?tier=low&seed=1${query}`);
  await waitReady(page);
}

/** The mark asked about now, by the color its chip names. */
export async function askedMark(page: Page): Promise<MarkId> {
  const name = (await page.locator('.rm-color').innerText()).trim();
  const mark = MARK_IDS.find((id) => CODE[MARK_COLOR[id]].name === name);
  if (!mark) throw new Error(`no mark is ${name}`);
  return mark;
}

/** The answers' buttons, in their order. */
export const answers = (page: Page) =>
  page.getByRole('group', { name: UI.answers.text }).getByRole('button');

/** The color an answer means, by its words. */
export function colorOf(words: string): ApwaCode {
  const color = MARKS_APWA.find((c) => words.includes(CODE[c].answer.text));
  if (!color) throw new Error(`no color means ${words}`);
  return color;
}

/** The number, 1 to 4, of the answer that's the color's meaning, or of one that isn't. */
export async function numberOf(page: Page, color: ApwaCode, right = true): Promise<number> {
  const words = await answers(page).allInnerTexts();
  const i = words.findIndex((w) => (colorOf(w) === color) === right);
  if (i < 0) throw new Error(`no ${right ? 'right' : 'wrong'} answer for ${color}`);
  return i + 1;
}

/** Answers the mark asked, rightly or not, by clicking, and waits for the result. */
export async function answerMark(page: Page, right: boolean): Promise<void> {
  const mark = await askedMark(page);
  await answers(page)
    .nth((await numberOf(page, MARK_COLOR[mark], right)) - 1)
    .click();
  await expect(page.locator('.rm-result')).toBeVisible();
}

/** Moves on from an answered mark, and waits for the next (or the end). */
export async function nextMark(page: Page): Promise<void> {
  await page.locator('.rm-next').click();
  await expect(page.locator('#rm-ask')).toBeFocused();
}

/** Answers right and moves on, until a mark over a buried line is asked. */
export async function onToALine(page: Page): Promise<MarkId> {
  for (;;) {
    const mark = await askedMark(page);
    if (TEXT[mark].label) return mark;
    await answerMark(page, true);
    await nextMark(page);
  }
}

/** Plays the round to its end, every mark read right but the second. */
export async function playToEnd(page: Page): Promise<void> {
  for (let n = 1; n <= MARK_IDS.length; n++) {
    await answerMark(page, n !== 2);
    await nextMark(page);
  }
}

/** The names of the lines under the marks, as the view shows them open. */
export const LINES: readonly string[] = MARK_IDS.flatMap((id) => {
  const label = TEXT[id].label;
  return label ? [label.text] : [];
});
