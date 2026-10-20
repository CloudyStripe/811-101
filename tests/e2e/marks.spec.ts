/**
 * Read the Marks, played: a whole round by keyboard, white first, each answer by its number, focus
 * moving on to Next and then to the next question, and at the end the score, the safety line, the
 * code and every line open; Play again starts white first, the others in a new order. A wrong
 * answer shows the right one beside it and says what the color means in one line. The Key shows
 * the whole code. What screen readers hear follows the round, and Next carries the answer. The
 * numbers answer only while focus is in the question. With reduced motion the ground opens at once
 * and the view holds still; with motion it slides open over a run of frames, then holds still. On a phone, by touch, the sheet keeps its height, so the yard
 * keeps its size, through a round, with the answers and Next on screen.
 */
import { CODE, END, KEY, MARKS as TEXT, UI } from '../../content/basics/read-the-marks.ts';
import { plainText } from '../../src/content-kit/terms.ts';
import { MARKS_APWA } from '../../src/design/apwa.ts';
import { MARK_COLOR, type MarkId } from '../../src/pages/read-the-marks/game.ts';
import { feedback, progress, scoreLine, viewSummary } from '../../src/pages/read-the-marks/text.ts';
import {
  MOTION_WAIT,
  countFrames,
  expect,
  isMoving,
  shownNames,
  test,
  waitStill,
} from './fixtures.ts';
import {
  LINES,
  answers,
  askedMark,
  colorOf,
  numberOf,
  onToALine,
  openMarks as open,
} from './play-marks.ts';

/**
 * A line as the browser gives it to screen readers: a term, being a button, can have the punctuation
 * after it set apart by a space ("proposed excavation ."), which reads the same.
 */
const asSpoken = (text: string) =>
  new RegExp(`^${text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&').replace(/\\?[.,;:!?]/g, '\\s?$&')}$`);

test.use({ reducedMotion: 'reduce' });

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a whole round by keyboard: white first, focus on to Next and the next mark, then the score, and Play again', async ({
    page,
  }) => {
    // Sixteen changes to the yard, and a second round, drawn in software.
    test.slow();
    await open(page);
    const ask = page.locator('#rm-ask');
    const status = page.locator('#rm-status');
    const next = page.locator('.rm-next');
    // From the top of the page, a number answers nothing: the numbers work in the question only.
    await page.keyboard.press('1');
    await expect(page.locator('.rm-result')).toHaveCount(0);
    // Tab into the question, past the header.
    const inPanel = () =>
      page.evaluate(() => document.activeElement?.closest('.rm-panel') !== null);
    for (let i = 0; i < 12 && !(await inPanel()); i++) await page.keyboard.press('Tab');
    expect(await inPanel(), 'focus in the question').toBe(true);
    const asked: MarkId[] = [];
    for (let n = 1; n <= 8; n++) {
      const mark = await askedMark(page);
      asked.push(mark);
      const color = MARK_COLOR[mark];
      await expect(page.locator('.rm-count')).toHaveText(progress(n));
      await expect(ask).toHaveText(TEXT[mark].ask.text);
      await expect(status).toHaveText(viewSummary({ mark, over: false }));
      // The intro comes with the first mark only.
      await expect(page.locator('.rm-intro')).toHaveCount(n === 1 ? 1 : 0);
      for (const [i, button] of (await answers(page).all()).entries()) {
        await expect(button).toHaveAttribute('aria-keyshortcuts', String(i + 1));
      }
      // Each read right but the third.
      const key = await numberOf(page, color, n !== 3);
      const picked = colorOf(
        await answers(page)
          .nth(key - 1)
          .innerText(),
      );
      await page.keyboard.press(String(key));
      await expect(next).toBeFocused();
      await expect(next).toHaveText(n === 8 ? UI.finish.text : UI.next.text);
      await expect(page.locator('.rm-verdict')).toHaveText(
        plainText(feedback(picked === color, color)),
        { useInnerText: true },
      );
      await expect(page.locator('.rm-found')).toHaveText(TEXT[mark].reveal.text);
      // Next, where focus is now, carries the answer, heard as focus lands; then the status line
      // says what the ground opens to show.
      await expect(next).toHaveAccessibleDescription(
        asSpoken(plainText(feedback(picked === color, color))),
      );
      await expect(status).toHaveText(viewSummary({ mark, answered: true, over: false }));
      // Answered, the answers are done with: another number changes nothing.
      for (const button of await answers(page).all()) {
        await expect(button).toHaveAttribute('aria-disabled', 'true');
      }
      await page.keyboard.press(String((key % 4) + 1));
      await expect(status).toHaveText(viewSummary({ mark, answered: true, over: false }));
      await expect(page.locator('.rm-verdict')).toHaveText(
        plainText(feedback(picked === color, color)),
        { useInnerText: true },
      );
      await page.keyboard.press('Enter');
      if (n < 8) await expect(ask).toBeFocused();
    }
    // White first, then each of the other seven once.
    expect(asked[0]).toBe('dig');
    expect(new Set(asked).size).toBe(8);
    // The end: the score, focused; everything under the marks, the safety line and the code.
    await expect(ask).toBeFocused();
    await expect(ask).toHaveText(scoreLine(7));
    await expect(page.locator('.rm-count')).toBeHidden();
    await expect(page.locator('.rm-end')).toContainText(END.all.text);
    await expect(page.locator('.rm-safety')).toHaveText(END.safety.text);
    await expect(page.locator('.rm-end .rm-code li')).toHaveCount(MARKS_APWA.length);
    await expect(status).toHaveText(`${scoreLine(7)} ${viewSummary({ mark: null, over: true })}`);
    // Every line under the marks is open, and named.
    await expect.poll(async () => (await shownNames(page)).sort()).toEqual([...LINES].sort());
    // Play again: white first again, then the others in a new order.
    await page.getByRole('button', { name: UI.again.text }).click();
    await expect(ask).toBeFocused();
    await expect(page.locator('.rm-count')).toHaveText(progress(1));
    await expect.poll(() => shownNames(page)).toEqual([]);
    const again: MarkId[] = [];
    for (let n = 1; n <= 3; n++) {
      const mark = await askedMark(page);
      again.push(mark);
      await page.keyboard.press(String(await numberOf(page, MARK_COLOR[mark])));
      await expect(next).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('.rm-count')).toHaveText(progress(n + 1));
    }
    expect(again[0]).toBe('dig');
    expect(again).not.toEqual(asked.slice(0, 3));
  });

  test('a wrong answer: the right one marked beside yours, the color’s meaning in one line, and what was under the marks', async ({
    page,
  }) => {
    await open(page);
    const wrong = answers(page).nth((await numberOf(page, 'white', false)) - 1);
    const right = answers(page).nth((await numberOf(page, 'white')) - 1);
    await wrong.click();
    await expect(page.locator('.rm-verdict')).toHaveText(
      'Not quite. White means proposed excavation.',
      { useInnerText: true },
    );
    await expect(right).toContainText(UI.rightAnswer.text);
    await expect(right).toHaveClass(/\bis-right\b/);
    await expect(wrong).toContainText(UI.yours.text);
    await expect(wrong).toHaveClass(/\bis-wrong\b/);
    await expect(page.locator('.rm-found')).toHaveText(TEXT.dig.reveal.text);
    // The meaning is said once, not again under it.
    const panel = await page.locator('.rm-panel').innerText();
    expect(panel.match(/proposed excavation/gi)).toHaveLength(1);
  });

  test('the numbers answer nothing from the settings menu, or anywhere outside the question', async ({
    page,
  }) => {
    await open(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    const menu = page.getByRole('dialog', { name: 'Settings' });
    await expect(menu).toBeVisible();
    await menu.getByRole('radio').first().focus();
    await page.keyboard.press('2');
    await expect(page.locator('.rm-result')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: '811 Basics' }).focus();
    await page.keyboard.press('3');
    await expect(page.locator('.rm-result')).toHaveCount(0);
    // In the question, they do.
    await answers(page).first().focus();
    await page.keyboard.press('3');
    await expect(page.locator('.rm-result')).toHaveCount(1);
  });

  test('the Key shows the whole code, answers nothing while open, and closes by its button or Escape', async ({
    page,
  }) => {
    await open(page);
    const button = page.getByRole('button', { name: UI.key.text, exact: true });
    await button.click();
    const key = page.getByRole('dialog', { name: KEY.heading.text });
    await expect(key).toBeVisible();
    await expect(key).toContainText(KEY.lede.text);
    const rows = key.locator('.rm-code li');
    await expect(rows).toHaveCount(MARKS_APWA.length);
    for (const [i, color] of MARKS_APWA.entries()) {
      await expect(rows.nth(i)).toHaveText(
        `${CODE[color].name}: ${plainText(CODE[color].meaning.text)}`,
        { useInnerText: true },
      );
    }
    await page.keyboard.press('1');
    await key.getByRole('button', { name: UI.close.text }).click();
    await expect(key).toBeHidden();
    await expect(button).toBeFocused();
    await expect(page.locator('.rm-result')).toHaveCount(0);
    await button.press('Enter');
    await expect(key).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(key).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('with reduced motion, the ground opens at once, its line named straight away, and the view holds still', async ({
    page,
  }) => {
    const frames = await countFrames(page);
    await open(page);
    const mark = await onToALine(page);
    await waitStill(page, 'the yard holds still at a line’s mark');
    const before = await frames();
    await page.keyboard.press(String(await numberOf(page, MARK_COLOR[mark])));
    await expect.poll(() => shownNames(page)).toEqual([TEXT[mark].label?.text]);
    await waitStill(page, 'the yard holds still, open');
    // A frame for the opening, and perhaps one for the panel's new size: no slide.
    expect((await frames()) - before).toBeLessThanOrEqual(2);
    expect(await isMoving(page, frames)).toBe(false);
    // On to the next mark, the ground closes at once too.
    await expect(page.locator('.rm-next')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => shownNames(page)).toEqual([]);
  });
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });

  test('the ground slides open over a run of frames, then the view holds still, and closes so too', async ({
    page,
  }) => {
    // Two slides, waited out, drawn in software.
    test.slow();
    const frames = await countFrames(page);
    await open(page);
    const mark = await onToALine(page);
    await waitStill(page, 'the yard holds still at a line’s mark');
    let before = await frames();
    await page.keyboard.press(String(await numberOf(page, MARK_COLOR[mark])));
    await expect
      .poll(() => shownNames(page), { timeout: MOTION_WAIT })
      .toEqual([TEXT[mark].label?.text]);
    await waitStill(page, 'the yard holds still, open');
    // A slide, not a cut: each frame moves it on a tenth of a second at most, of 0.65.
    expect((await frames()) - before, 'frames opening').toBeGreaterThanOrEqual(5);
    expect(await isMoving(page, frames)).toBe(false);
    before = await frames();
    await expect(page.locator('.rm-next')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => shownNames(page), { timeout: MOTION_WAIT }).toEqual([]);
    await waitStill(page, 'the yard holds still, closed');
    expect((await frames()) - before, 'frames closing').toBeGreaterThanOrEqual(5);
    expect(await isMoving(page, frames)).toBe(false);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('a round by touch: the sheet keeps its place and height, so the yard keeps its size, with the answers and Next on screen', async ({
    page,
  }) => {
    // Sixteen changes to the yard, drawn in software.
    test.slow();
    await open(page);
    const sheet = page.locator('.rm-panel');
    const box = await sheet.boundingBox();
    const more = page.locator('.rm-panel .scroll-more-button');
    for (let n = 1; n <= 8; n++) {
      // The question all shows: every answer whole, on screen, and no More to scroll to.
      for (const button of await answers(page).all()) {
        await expect(button).toBeInViewport({ ratio: 1 });
      }
      await expect(more).toBeHidden();
      expect(await sheet.boundingBox(), `the sheet at mark ${String(n)}`).toEqual(box);
      const mark = await askedMark(page);
      await answers(page)
        .nth((await numberOf(page, MARK_COLOR[mark], n !== 2)) - 1)
        .tap();
      // Answered: the result in the answers' place, whole, and Next.
      const next = page.locator('.rm-next');
      await expect(page.locator('.rm-result')).toBeInViewport({ ratio: 1 });
      await expect(next).toBeInViewport({ ratio: 1 });
      await expect(more).toBeHidden();
      expect(await sheet.boundingBox(), `the sheet, mark ${String(n)} answered`).toEqual(box);
      await next.tap();
    }
    await expect(page.locator('#rm-ask')).toHaveText(scoreLine(7));
    expect(await sheet.boundingBox(), 'the sheet at the end').toEqual(box);
    await expect(page.getByRole('button', { name: UI.again.text })).toBeInViewport({ ratio: 1 });
  });
});
