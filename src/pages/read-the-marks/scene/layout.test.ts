import { describe, expect, it } from 'vitest';
import { MARK_IDS } from '../game.ts';
import {
  BANDS,
  BLOCK,
  CUT_HALF,
  DIG,
  FIXTURES,
  GARAGE,
  HOUSE,
  MARKS,
  cutsOf,
  groundAt,
  runsAlongZ,
  segmentsOf,
  type Box,
  type Point,
} from './layout.ts';

/** How far a point is from a straight run. */
function distanceToRun(p: Point, [a, b]: readonly [Point, Point]): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

const overlapsInPlan = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;

describe('the yard', () => {
  it('has one mark for each of the game’s marks', () => {
    expect(MARKS.map((m) => m.id).sort()).toEqual([...MARK_IDS].sort());
  });

  it('keeps every mark in the yard, none on the curb or in the street', () => {
    for (const mark of MARKS) {
      for (const s of mark.spots) {
        expect(s.z, `${mark.id} at ${String(s.x)}, ${String(s.z)}`).toBeLessThan(BANDS.stripFront);
        expect(s.x).toBeGreaterThan(BLOCK.x0 + 1);
        expect(s.x).toBeLessThan(BLOCK.x1 - 1);
        expect(s.z).toBeGreaterThan(BLOCK.z0 + 1);
      }
    }
  });

  it('stands flags on the grass, and paints only where a line crosses the sidewalk or driveway', () => {
    for (const mark of MARKS) {
      for (const s of mark.spots) {
        const ground = groundAt(s);
        if (s.form === 'flag') expect(ground, `${mark.id} flag`).toBe('grass');
        // The white outline is painted on the lawn, where you'll dig.
        else if (mark.id !== 'dig')
          expect(['sidewalk', 'driveway'], `${mark.id} paint`).toContain(ground);
      }
    }
  });

  it('shows both paint and flags among the lines’ marks', () => {
    const lineMarks = MARKS.filter((m) => m.line);
    expect(lineMarks.every((m) => m.spots.some((s) => s.form === 'flag'))).toBe(true);
    expect(lineMarks.filter((m) => m.spots.some((s) => s.form === 'paint')).length).toBeGreaterThan(
      1,
    );
  });

  it('marks a buried line for every color but white and pink', () => {
    for (const mark of MARKS) {
      const buried = mark.color !== 'white' && mark.color !== 'pink';
      expect(mark.line !== null, mark.id).toBe(buried);
    }
  });

  it('puts each line’s marks over it, inside where its ground opens', () => {
    for (const mark of MARKS) {
      const { line } = mark;
      if (!line) continue;
      const runs = segmentsOf(line);
      const cuts = cutsOf(line);
      for (const s of mark.spots) {
        const d = Math.min(...runs.map((r) => distanceToRun(s, r)));
        expect(d, `${mark.id} at ${String(s.x)}, ${String(s.z)}`).toBeLessThan(0.75);
        const inCut = cuts.some((c) => s.x > c.x0 && s.x < c.x1 && s.z > c.z0 && s.z < c.z1);
        expect(inCut, `${mark.id} at ${String(s.x)}, ${String(s.z)}`).toBe(true);
      }
    }
  });

  it('runs every line along x or z, so the ground opens along it as a box, wide enough to see it', () => {
    for (const mark of MARKS) {
      const { line } = mark;
      if (!line) continue;
      const runs = segmentsOf(line);
      for (const run of runs) {
        const [a, b] = run;
        expect(runsAlongZ(run) || Math.abs(a.z - b.z) < 1e-6, mark.id).toBe(true);
      }
      cutsOf(line).forEach((cut, i) => {
        const run = runs[i];
        if (!run) throw new Error(`${mark.id}: a cut with no run`);
        const across = runsAlongZ(run) ? cut.x1 - cut.x0 : cut.z1 - cut.z0;
        expect(across).toBeGreaterThanOrEqual(2 * (CUT_HALF + line.radius) - 1e-9);
        expect(cut.y0).toBeLessThan(-(line.depth + line.radius));
      });
    }
  });

  it('opens a line that comes from the street from the curb in, and short of the house', () => {
    for (const mark of MARKS) {
      if (!mark.line) continue;
      for (const cut of cutsOf(mark.line)) {
        expect(cut.z1, mark.id).toBeLessThanOrEqual(BANDS.stripFront);
        expect(cut.z0, mark.id).toBeGreaterThan(BANDS.house);
        for (const b of [HOUSE, GARAGE]) {
          expect(overlapsInPlan(cut, { ...b, y0: 0, y1: 1 }), `${mark.id} under a building`).toBe(
            false,
          );
        }
      }
    }
  });

  it('opens each line on its own: no two lines’ cuts overlap, and none crosses the dig', () => {
    const cuts = MARKS.flatMap((m) => (m.line ? cutsOf(m.line).map((c) => ({ id: m.id, c })) : []));
    for (const a of cuts) {
      for (const b of cuts) {
        if (a.id !== b.id) expect(overlapsInPlan(a.c, b.c), `${a.id} and ${b.id}`).toBe(false);
      }
    }
  });

  it('keeps the boxes at the lines’ ends standing on solid ground', () => {
    const boxes: [keyof typeof FIXTURES, number][] = [
      ['transformer', 1.6],
      ['pedestal', 0.5],
      ['waterBox', 0.55],
      ['reclaimedBox', 0.55],
    ];
    const cuts = MARKS.flatMap((m) => (m.line ? cutsOf(m.line) : []));
    for (const [name, half] of boxes) {
      const f = FIXTURES[name];
      const foot = { x0: f.x - half, x1: f.x + half, z0: f.z - half, z1: f.z + half, y0: 0, y1: 1 };
      for (const c of cuts) expect(overlapsInPlan(c, foot), name).toBe(false);
    }
  });

  it('keeps marks of different colors apart, so each reads as its own', () => {
    for (const a of MARKS) {
      for (const b of MARKS) {
        if (a.id >= b.id) continue;
        for (const s of a.spots) {
          for (const t of b.spots) {
            expect(Math.hypot(s.x - t.x, s.z - t.z), `${a.id} and ${b.id}`).toBeGreaterThan(1.4);
          }
        }
      }
    }
  });

  it('outlines the dig in the front lawn', () => {
    expect(DIG.z1).toBeLessThan(BANDS.sidewalkBack);
    expect(DIG.z0).toBeGreaterThan(BANDS.house);
    expect(groundAt({ x: (DIG.x0 + DIG.x1) / 2, z: (DIG.z0 + DIG.z1) / 2 })).toBe('grass');
  });
});
