import { describe, expect, it } from 'vitest';
import { collectClaims } from '../../src/content-kit/claims.ts';
import { plainText, termKey, termKeysIn } from '../../src/content-kit/terms.ts';
import { APWA, MARKS_APWA } from '../../src/design/apwa.ts';
import { MARK_COLOR, MARK_IDS } from '../../src/pages/read-the-marks/game.ts';
import { SOURCES } from '../sources.ts';
import { CODE, MARKS, READ_THE_MARKS, TERMS } from './read-the-marks.ts';

const claims = collectClaims(READ_THE_MARKS);

/** Every string in the content. */
function stringsIn(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) for (const v of value) stringsIn(v, into);
  else if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) stringsIn(v, into);
  }
  return into;
}

describe('Read the Marks content', () => {
  it('gives every line a unique ID in its namespace', () => {
    const ids = claims.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^rm\.[a-z0-9.-]+$/);
  });

  it('never leaves text empty', () => {
    for (const s of stringsIn(READ_THE_MARKS)) expect(s.trim().length).toBeGreaterThan(0);
  });

  it('defines every marked term, keyed as the markup is read, free of markup itself', () => {
    const missing = stringsIn(READ_THE_MARKS)
      .flatMap(termKeysIn)
      .filter((key) => !(key in TERMS));
    expect(missing).toEqual([]);
    for (const [key, definition] of Object.entries(TERMS)) {
      expect(termKey(key)).toBe(key);
      expect(termKeysIn(definition.text)).toEqual([]);
    }
  });

  it('says where every line comes from, and backs every definition with a source of fact', () => {
    for (const c of claims) {
      expect(c.source?.length, c.id).toBeGreaterThan(0);
      for (const s of c.source ?? []) expect(Object.keys(SOURCES), c.id).toContain(s);
    }
    for (const [term, definition] of Object.entries(TERMS)) {
      const facts = (definition.source ?? []).filter((s) => s !== 'scene' && s !== 'game');
      expect(facts.length, term).toBeGreaterThan(0);
    }
  });

  it('gives the code word for word as the site does, from the APWA card', () => {
    expect(Object.keys(CODE).sort()).toEqual([...MARKS_APWA].sort());
    for (const code of MARKS_APWA) {
      expect(CODE[code].name).toBe(APWA[code].name);
      expect(plainText(CODE[code].meaning.text)).toBe(APWA[code].meaning);
      expect(CODE[code].meaning.source).toContain('apwa-card');
    }
  });

  it('keeps every answer short, and each its own', () => {
    const answers = MARKS_APWA.map((c) => CODE[c].answer.text);
    expect(new Set(answers).size).toBe(answers.length);
    for (const a of answers) expect(a.length).toBeLessThanOrEqual(30);
  });

  it('says each mark’s color in words in its question', () => {
    for (const id of MARK_IDS) {
      const name = CODE[MARK_COLOR[id]].name.toLowerCase();
      expect(MARKS[id].ask.text.toLowerCase(), id).toContain(` ${name}.`);
      expect(MARKS[id].lit.text.toLowerCase(), id).toContain(name);
    }
  });

  it('names a line in the view for every mark of a buried line, and none for white and pink', () => {
    for (const id of MARK_IDS) {
      const buried = MARK_COLOR[id] !== 'white' && MARK_COLOR[id] !== 'pink';
      expect(MARKS[id].label !== null, id).toBe(buried);
    }
  });
});
