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
  asideOf,
  coverAt,
  coverOf,
  cutsOf,
  groundAt,
  markById,
  overlapOf,
  piecesOf,
  reachOf,
  runsAlongZ,
  segmentsOf,
  steppedAside,
  sweptAhead,
  type Box,
  type Point,
  type RunRef,
} from './layout.ts';
import { MARK_LOOK } from './palette.ts';

/** How far a point is from a straight run. */
function distanceToRun(p: Point, [a, b]: readonly [Point, Point]): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

const overlapsInPlan = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;

const area = (b: Box) => (b.x1 - b.x0) * (b.z1 - b.z0);

/** Every run of every line, with its cut. */
const RUNS = MARKS.flatMap((m) => {
  if (!m.line) return [];
  const runs = segmentsOf(m.line);
  return cutsOf(m.line).map((cut, run) => ({
    ref: { mark: m.id, run },
    cut,
    alongZ: runsAlongZ(
      runs[run] ?? [
        { x: 0, z: 0 },
        { x: 0, z: 1 },
      ],
    ),
  }));
});
const same = (a: RunRef, b: RunRef) => a.mark === b.mark && a.run === b.run;
const name = (r: RunRef) => `${r.mark} ${String(r.run)}`;

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

  it('opens each line on its own: no two lines’ cuts overlap', () => {
    const cuts = MARKS.flatMap((m) => (m.line ? cutsOf(m.line).map((c) => ({ id: m.id, c })) : []));
    for (const a of cuts) {
      for (const b of cuts) {
        if (a.id !== b.id) expect(overlapsInPlan(a.c, b.c), `${a.id} and ${b.id}`).toBe(false);
      }
    }
  });

  it('covers each turn once: a line’s runs share its cuts, none of it twice and none left out', () => {
    for (const mark of MARKS) {
      if (!mark.line) continue;
      const cuts = cutsOf(mark.line);
      const covers = cuts.flatMap((_, run) => coverOf({ mark: mark.id, run }));
      covers.forEach((a, i) => {
        for (const b of covers.slice(i + 1)) expect(overlapOf(a, b), mark.id).toBeNull();
      });
      // As much ground as the cuts take together: each cut, less where two meet.
      let union = cuts.reduce((sum, c) => sum + area(c), 0);
      cuts.forEach((a, i) => {
        for (const b of cuts.slice(i + 1)) {
          const o = overlapOf(a, b);
          if (o) union -= area(o);
        }
      });
      expect(
        covers.reduce((sum, b) => sum + area(b), 0),
        mark.id,
      ).toBeCloseTo(union, 6);
    }
    // The electric line's turn goes with the run toward the meter, which slides it onto the lawn,
    // not with the run from the transformer, which would carry it down the other open trench.
    const turn = { x: FIXTURES.electricMeter.x, z: FIXTURES.transformer.z };
    const holds = (run: number) =>
      coverOf({ mark: 'electric', run }).some(
        (c) => turn.x > c.x0 && turn.x < c.x1 && turn.z > c.z0 && turn.z < c.z1,
      );
    expect(holds(1), 'the run toward the meter').toBe(true);
    expect(holds(0), 'the run from the transformer').toBe(false);
  });

  it('slides each cover over solid ground only, never across another cut as the ground opens', () => {
    for (const r of RUNS) {
      const dir = asideOf(r.ref);
      for (const part of coverOf(r.ref)) {
        const swept = sweptAhead(part, dir, reachOf(r.cut, r.alongZ));
        for (const other of RUNS) {
          if (same(other.ref, r.ref)) continue;
          expect(
            overlapOf(swept, other.cut),
            `${name(r.ref)} across ${name(other.ref)}`,
          ).toBeNull();
        }
        expect(swept.x0, name(r.ref)).toBeGreaterThan(BLOCK.x0);
        expect(swept.x1, name(r.ref)).toBeLessThan(BLOCK.x1);
      }
    }
  });

  it('steps every flag on a cover off it, onto the grass clear of every cut, as the ground opens', () => {
    for (const mark of MARKS) {
      for (const s of mark.spots) {
        if (s.form !== 'flag') continue;
        const on = coverAt(s);
        const at = on ? steppedAside(s, on, 1) : s;
        const where = `${mark.id} flag at ${String(s.x)}, ${String(s.z)}`;
        // A flag in a cut is on one of its covers; one on none stands where it is.
        const inCut = RUNS.some(
          (r) => s.x > r.cut.x0 && s.x < r.cut.x1 && s.z > r.cut.z0 && s.z < r.cut.z1,
        );
        expect(on !== null, where).toBe(inCut);
        for (const r of RUNS) {
          const near =
            at.x > r.cut.x0 - 0.3 &&
            at.x < r.cut.x1 + 0.3 &&
            at.z > r.cut.z0 - 0.3 &&
            at.z < r.cut.z1 + 0.3;
          expect(near, `${where}, by ${name(r.ref)}'s cut`).toBe(false);
        }
        expect(groundAt(at), where).toBe('grass');
      }
    }
  });

  it('lets paint over a line ride that line’s cover, cut at its edge, so the outline opens as wide as the trench', () => {
    for (const mark of MARKS) {
      for (const s of mark.spots) {
        if (s.form !== 'paint') continue;
        const pieces = piecesOf(s);
        const where = `${mark.id} paint at ${String(s.x)}, ${String(s.z)}`;
        // The pieces make up the whole dash.
        expect(
          pieces.reduce((sum, p) => sum + p.length, 0),
          where,
        ).toBeCloseTo(MARK_LOOK.paint.length, 6);
        for (const p of pieces) {
          const alongX = Math.abs(Math.sin((p.heading * Math.PI) / 180)) < 0.5;
          const [mid, across] = alongX ? [p.x, p.z] : [p.z, p.x];
          const [from, to] = [mid - p.length / 2, mid + p.length / 2];
          const holds = (b: Box) => {
            const [a0, a1, c0, c1] = alongX ? [b.x0, b.x1, b.z0, b.z1] : [b.z0, b.z1, b.x0, b.x1];
            return across > c0 && across < c1 && from >= a0 - 1e-9 && to <= a1 + 1e-9;
          };
          const crosses = (b: Box) => {
            const [a0, a1, c0, c1] = alongX ? [b.x0, b.x1, b.z0, b.z1] : [b.z0, b.z1, b.x0, b.x1];
            return across > c0 && across < c1 && from < a1 - 1e-9 && to > a0 + 1e-9;
          };
          // A piece on a cover lies all on it; one on none crosses no cut.
          if (p.on) {
            const on = p.on;
            expect(coverOf(on).some(holds), `${where}, on ${name(on)}`).toBe(true);
          } else {
            for (const r of RUNS)
              expect(crosses(r.cut), `${where}, over ${name(r.ref)}`).toBe(false);
          }
        }
      }
    }
    // The outline crosses the gas line: its gap there is the gas line's cover, no wider.
    const [gas] = coverOf({ mark: 'gas', run: 0 });
    if (!gas) throw new Error('no gas cover');
    for (const z of [DIG.z0, DIG.z1]) {
      const side = markById('dig')
        .spots.filter((s) => s.form === 'paint' && s.z === z)
        .flatMap(piecesOf);
      const staying = side.filter((p) => !p.on);
      const riding = side.filter((p) => p.on?.mark === 'gas');
      expect(riding.length, `the outline at z ${String(z)}`).toBeGreaterThan(0);
      const left = Math.max(...staying.filter((p) => p.x < gas.x0).map((p) => p.x + p.length / 2));
      const right = Math.min(...staying.filter((p) => p.x > gas.x1).map((p) => p.x - p.length / 2));
      expect(left).toBeCloseTo(gas.x0, 6);
      expect(right).toBeCloseTo(gas.x1, 6);
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
