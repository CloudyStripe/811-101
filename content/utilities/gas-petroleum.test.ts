/**
 * The diorama's text: word for word what the original said (but for the fork note, which now
 * names the paths, and one stop's label), a few plain sentences per stop, no figures, every
 * marked term defined, and tours and quizzes that hold together.
 */
import { describe, expect, it } from 'vitest';
import { collectClaims } from '../../src/content-kit/claims.ts';
import { termKey, termKeysIn } from '../../src/content-kit/terms.ts';
import LEGACY from './gas-petroleum.legacy.json';
import {
  DETAILS,
  GAS_PETROLEUM,
  OVERVIEW,
  QUIZZES,
  STOPS,
  TERMS,
  TIMELAPSE,
  TIMELAPSE_NOTE,
  TOURS,
  stopById,
  type StopId,
} from './gas-petroleum.ts';

/** A change to the lesson's words: the fork note names the paths, not their old colors. */
const FORK_NOTE =
  'This is the fork: gas heads off along the natural gas path, oil along the gasoline one.';

/** The other: the stop on using natural gas says so, since many readers call gasoline gas. */
const RELABELED: Partial<Record<string, string>> = { 'gas-uses': 'Using natural gas' };

/** Every string in the content, claims and prompts alike. */
function stringsIn(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) for (const v of value) stringsIn(v, into);
  else if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) stringsIn(v, into);
  }
  return into;
}

const claims = collectClaims(GAS_PETROLEUM);

describe('Gas & Petroleum, word for word', () => {
  it('has every stop the original had, in its order, on its path', () => {
    expect(STOPS.map((s) => [s.id, s.path, s.step, s.label])).toEqual(
      LEGACY.stops.map((s) => [s.id, s.path, s.step, RELABELED[s.id] ?? s.label]),
    );
  });

  it("says each stop's title, text, note and safety tip as the original did", () => {
    for (const old of LEGACY.stops) {
      const stop = stopById(old.id as StopId);
      expect(stop.title.text, old.id).toBe(old.title);
      expect(stop.text.map((c) => c.text).join(' '), old.id).toBe(old.text);
      expect(stop.safety?.text, old.id).toBe('safety' in old ? old.safety : undefined);
      const note = 'note' in old ? old.note : undefined;
      expect(stop.note?.text, old.id).toBe(old.id === 'lifting' ? FORK_NOTE : note);
    }
  });

  it('defines every term as the original did', () => {
    const old: Record<string, string> = { ...LEGACY.glossary };
    for (const stop of LEGACY.stops) Object.assign(old, stop.terms);
    expect(Object.keys(TERMS).sort()).toEqual(Object.keys(old).map(termKey).sort());
    for (const [key, text] of Object.entries(old)) expect(TERMS[termKey(key)]?.text).toBe(text);
  });

  it('keeps the overview, the tours, the quizzes and the time-lapse', () => {
    expect(OVERVIEW.title.text).toBe(LEGACY.overview.title);
    expect(OVERVIEW.text.map((c) => c.text).join(' ')).toBe(LEGACY.overview.text);
    expect(TOURS).toEqual(LEGACY.tours);
    for (const key of ['gas', 'gasoline'] as const) {
      expect(
        QUIZZES[key].map((q) => ({ ...q, why: q.why.text })),
        key,
      ).toEqual(LEGACY.quizzes[key]);
    }
    expect(TIMELAPSE.map((t) => ({ ma: t.ma, caption: t.caption.text }))).toEqual(LEGACY.timelapse);
    expect(`${TIMELAPSE_NOTE.howTo} ${TIMELAPSE_NOTE.illustrative.text}`).toBe(
      LEGACY.timelapseNote,
    );
  });

  it("keeps every small label on the stops' parts", () => {
    const now = Object.values(DETAILS).flatMap((d) => Object.values(d).map((c) => c.text));
    expect([...now].sort()).toEqual([...LEGACY.details].sort());
  });
});

describe('Gas & Petroleum, the text rules', () => {
  it('gives every claim a unique ID in the diorama namespace', () => {
    const ids = claims.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^gp\.[a-z0-9.-]+$/);
  });

  it('says each stop in a few plain sentences, one claim each', () => {
    for (const stop of STOPS) {
      expect(stop.text.length, stop.id).toBeGreaterThanOrEqual(1);
      expect(stop.text.length, stop.id).toBeLessThanOrEqual(3);
      for (const c of stop.text) expect(c.text.match(/[.!?](\s|$)/g)?.length, c.id).toBe(1);
    }
  });

  it('carries no figures: only the time-lapse clock counts years', () => {
    for (const c of claims) expect(c.text, c.id).not.toMatch(/\d/);
    for (const s of stringsIn(QUIZZES)) expect(s).not.toMatch(/\d/);
  });

  it('never leaves text empty, and defines every marked term', () => {
    for (const s of stringsIn(GAS_PETROLEUM)) expect(s.trim().length).toBeGreaterThan(0);
    const missing = stringsIn(GAS_PETROLEUM)
      .flatMap(termKeysIn)
      .filter((key) => !(key in TERMS));
    expect(missing).toEqual([]);
  });

  it('walks each tour through the shared start, then its own path', () => {
    for (const [key, tour] of Object.entries(TOURS)) {
      const paths = tour.stops.map((id) => stopById(id).path);
      expect(paths.slice(0, 4), key).toEqual(['shared', 'shared', 'shared', 'shared']);
      expect(new Set(paths.slice(4)), key).toEqual(new Set([key]));
      expect(tour.stops.map((id) => stopById(id).step)).toEqual(tour.stops.map((_, i) => i + 1));
    }
  });

  it('asks questions with one right answer among the choices', () => {
    for (const qs of Object.values(QUIZZES)) {
      for (const q of qs) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.options[q.answer]).toBeDefined();
        expect(new Set(q.options).size).toBe(q.options.length);
      }
    }
  });

  it('runs the time-lapse forward, from the oldest caption to today', () => {
    const at = TIMELAPSE.map((t) => t.at);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(TIMELAPSE.at(-1)?.ma).toBe(0);
  });
});
