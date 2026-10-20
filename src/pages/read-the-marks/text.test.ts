import { describe, expect, it } from 'vitest';
import { plainText } from '../../content-kit/terms.ts';
import { APWA, MARKS_APWA } from '../../design/apwa.ts';
import { MARK_IDS } from './game.ts';
import { feedback, fill, lowerFirst, progress, scoreLine, viewSummary } from './text.ts';

describe('the game’s lines', () => {
  it('fill their placeholders, and leave unknown ones be', () => {
    expect(fill('Mark {n} of 8', { n: '3' })).toBe('Mark 3 of 8');
    expect(fill('{a} and {b}', { a: 'x' })).toBe('x and {b}');
    expect(progress(2)).toBe('Mark 2 of 8');
    expect(scoreLine(6)).toBe('You read 6 of 8 marks right.');
  });

  it('lower a meaning’s first letter, inside a term too', () => {
    expect(lowerFirst('Gas, oil')).toBe('gas, oil');
    expect(lowerFirst('[[Potable]] water')).toBe('[[potable]] water');
  });

  it('say an answer in one line: right or not, then what the color means', () => {
    for (const code of MARKS_APWA) {
      const meaning = APWA[code].meaning;
      const lower = meaning.charAt(0).toLowerCase() + meaning.slice(1);
      expect(plainText(feedback(true, code))).toBe(`Right. ${APWA[code].name} means ${lower}.`);
      expect(plainText(feedback(false, code))).toBe(
        `Not quite. ${APWA[code].name} means ${lower}.`,
      );
    }
    expect(plainText(feedback(false, 'yellow'))).toBe(
      'Not quite. Yellow means gas, oil, steam, petroleum or gaseous materials.',
    );
  });

  it('describe the view: the yard, the mark that’s lit, what’s under it once answered, and the end', () => {
    expect(viewSummary({ mark: 'gas', over: false })).toMatch(
      /flags and paint\. The yellow flags and paint marks are lit\.$/,
    );
    expect(viewSummary({ mark: 'gas', answered: true, over: false })).toMatch(
      /flags and paint\. Under the yellow marks: the gas line from the street to the house's meter, right through where you plan to dig\.$/,
    );
    expect(viewSummary({ mark: null, over: true })).toMatch(/all the lines\.$/);
    for (const id of MARK_IDS) {
      for (const answered of [false, true]) {
        expect(viewSummary({ mark: id, answered, over: false })).not.toMatch(/[{}[\]]/);
      }
    }
  });
});
