/**
 * Where 3D labels go: the geometry of covering and leaders, and the placing itself, from which
 * labels show to where a focused one sits as the view moves.
 */
import { describe, expect, it } from 'vitest';
import {
  ICON,
  covers,
  leaderStart,
  placeLabels,
  type Band,
  type Candidate,
  type Placement,
  type Point,
  type Rect,
  type Room,
  type ShownAt,
} from './placement.ts';

const box = (x: number, y: number, w = 40, h = 20) => ({ x, y, w, h });

describe('covers', () => {
  // A level line from (0, 100) to (200, 100), 5 px either side.
  const level: Band = { ax: 0, ay: 100, bx: 200, by: 100, r: 5 };

  it('finds a label over a line, or within its thickness of it', () => {
    expect(covers(level, box(50, 90))).toBe(true);
    expect(covers(level, box(50, 101))).toBe(true);
    expect(covers(level, box(50, 76))).toBe(true);
  });

  it('lets a label clear of the line be', () => {
    expect(covers(level, box(50, 106))).toBe(false);
    expect(covers(level, box(50, 74))).toBe(false);
    // Past its end.
    expect(covers(level, box(206, 90))).toBe(false);
  });

  it('finds a slanting line that only clips a corner', () => {
    // Up to the right at 45°, through (100, 100), 8 px either side.
    const slant: Band = { ax: 0, ay: 200, bx: 200, by: 0, r: 8 };
    // It passes 3.5 px from this box's top-left corner...
    expect(covers(slant, box(105, 100))).toBe(true);
    // ...and 8.5 px from this one's.
    expect(covers(slant, box(112, 100))).toBe(false);
  });

  it('treats a band with both ends at one point as a disc', () => {
    const disc: Band = { ax: 100, ay: 100, bx: 100, by: 100, r: 10 };
    // Its nearest corner 9.9 px from the middle, then 11.3 px.
    expect(covers(disc, box(107, 107))).toBe(true);
    expect(covers(disc, box(108, 108))).toBe(false);
  });
});

describe('leaderStart', () => {
  it('leaves the label from its edge nearest the point, short of its rounded ends', () => {
    // A label below and to the right of its point: from its top edge, 12 px in from the left end.
    expect(leaderStart(box(100, 100, 120, 28), { x: 60, y: 60 })).toEqual({ x: 112, y: 100 });
    // Straight above its point: from its bottom edge, right over it.
    expect(leaderStart(box(100, 100, 120, 28), { x: 150, y: 160 })).toEqual({ x: 150, y: 128 });
  });

  it('needs none when the label covers its point', () => {
    expect(leaderStart(box(100, 100, 120, 28), { x: 150, y: 110 })).toBeNull();
  });
});

/** An 800 × 600 view with nothing over it, every label free to show. */
function room(over: Partial<Room> = {}): Room {
  return {
    width: 800,
    height: 600,
    bounds: { x: 0, y: 0, w: 800, h: 600 },
    noGo: [],
    keepClear: [],
    maxVisible: Infinity,
    icons: false,
    ...over,
  };
}

/** A label 100 × 28 in full, anchored and pointing at `at`. */
function label(id: string, at: Point, over: Partial<Candidate> = {}): Candidate {
  return {
    id,
    priority: 1,
    depth: 0,
    at,
    point: at,
    elsewhere: [],
    size: { w: 100, h: 28 },
    visible: true,
    focused: false,
    quiet: false,
    below: false,
    offLine: false,
    tip: null,
    ...over,
  };
}

function place(
  candidates: Candidate[],
  r: Room = room(),
  last: ReadonlyMap<string, ShownAt> = new Map(),
): Map<string, Placement> {
  return new Map(placeLabels(candidates, r, last).map((p) => [p.id, p]));
}

/** The shown ones, with their rectangles. */
function shown(placements: Map<string, Placement>): (Placement & { rect: Rect })[] {
  return [...placements.values()].filter((p): p is Placement & { rect: Rect } => p.rect !== null);
}

/** A shown label's leader, as a band one line thick, or null for none. */
function leaderBand(p: Placement): Band | null {
  const from = p.rect && p.point ? leaderStart(p.rect, p.point) : null;
  return from && p.point ? { ax: from.x, ay: from.y, bx: p.point.x, by: p.point.y, r: 1 } : null;
}

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('placeLabels', () => {
  it('shows the highest-priority labels up to the cap, and a focused one however many', () => {
    const placed = place(
      [
        label('a', { x: 100, y: 100 }, { priority: 3 }),
        label('b', { x: 400, y: 100 }, { priority: 2 }),
        label('c', { x: 700, y: 100 }, { priority: 1 }),
        label('d', { x: 400, y: 400 }, { priority: 0, focused: true }),
      ],
      room({ maxVisible: 2 }),
    );
    expect(placed.get('d')?.state).toBe('');
    expect(placed.get('a')?.state).toBe('');
    expect(placed.get('b')?.state).toBe('capped');
    expect(placed.get('c')?.state).toBe('capped');
  });

  it('keeps quiet labels and labels out of view out of sight', () => {
    const placed = place([
      label('quiet', { x: 200, y: 200 }, { quiet: true }),
      label('behind', { x: 400, y: 200 }, { visible: false }),
    ]);
    expect(placed.get('quiet')?.state).toBe('capped');
    expect(placed.get('behind')?.state).toBe('off');
  });

  it('hangs a label off a line it would cover, on a leader to its point', () => {
    // A line rising to the right, the label's anchor on it, as on a phone's three-quarter view.
    const line: Band = { ax: 200, ay: 500, bx: 600, by: 100, r: 6 };
    const at = { x: 400, y: 300 };
    const placed = place([label('line', at, { offLine: true })], room({ keepClear: [line] }));
    const p = placed.get('line');
    expect(p?.state).toBe('');
    if (!p?.rect) throw new Error('not shown');
    expect(covers(line, p.rect)).toBe(false);
    expect(p.point).toEqual(at);
  });

  it('keeps every label off the others and their leaders, and every leader from under them', () => {
    // Four things close together: each label finds a spot of its own, in full or as its icon.
    const placed = shown(
      place([
        label('a', { x: 400, y: 300 }, { priority: 4 }),
        label('b', { x: 430, y: 340 }, { priority: 3 }),
        label('c', { x: 370, y: 330 }, { priority: 2, below: true }),
        label('d', { x: 460, y: 280 }, { priority: 1 }),
      ]),
    );
    expect(placed).toHaveLength(4);
    for (const p of placed) {
      for (const q of placed) {
        if (p === q) continue;
        expect(overlap(p.rect, q.rect), `${p.id} over ${q.id}`).toBe(false);
        const lead = leaderBand(q);
        if (lead) expect(covers(lead, p.rect), `${p.id} over ${q.id}'s leader`).toBe(false);
      }
    }
  });

  it("keeps clear of a focused label's open definition", () => {
    // Centred under the label, against the middle of its top edge.
    const tip = { x: -80, y: 34, w: 160, h: 40 };
    const placed = place([
      label('open', { x: 400, y: 300 }, { focused: true, tip }),
      label('next', { x: 400, y: 330 }, { below: true }),
    ]);
    const open = placed.get('open')?.rect;
    const next = placed.get('next')?.rect;
    if (!open || !next) throw new Error('not shown');
    const at = { ...tip, x: open.x + open.w / 2 + tip.x, y: open.y + tip.y };
    expect(overlap(next, at)).toBe(false);
  });

  it('hangs a label on a line a row further off before moving it to either side', () => {
    // A level line through the anchor, and a stub of another just above the spot over it.
    const line: Band = { ax: 0, ay: 300, bx: 800, by: 300, r: 6 };
    const stub: Band = { ax: 395, ay: 270, bx: 405, by: 270, r: 4 };
    const at = { x: 400, y: 300 };
    const keepClear = [line, stub];
    const off = place([label('a', at, { offLine: true })], room({ keepClear })).get('a')?.rect;
    const plain = place([label('a', at)], room({ keepClear })).get('a')?.rect;
    // Off the line: straight up a row, still centred on its point...
    expect(off).toEqual({ x: 350, y: 222, w: 100, h: 28 });
    // ...where a label on a point steps to the side first.
    expect(plain).toEqual({ x: 290, y: 258, w: 100, h: 28 });
  });

  it('sits a label at another of its places when its anchor has no room', () => {
    // A control over the anchor and all round it; the label's next place is clear.
    const control = { x: 250, y: 150, w: 300, h: 300 };
    const elsewhere = { x: 650, y: 300 };
    const placed = place(
      [label('line', { x: 400, y: 300 }, { elsewhere: [null, elsewhere] })],
      room({ noGo: [control] }),
    );
    const p = placed.get('line');
    expect(p?.state).toBe('');
    expect(p?.point).toEqual(elsewhere);
    expect(p?.shownAt?.at).toBe(2);
    if (p?.rect) expect(overlap(p.rect, control)).toBe(false);
  });

  it('places labels tied to one point before those that may sit elsewhere', () => {
    const at = { x: 400, y: 300 };
    // The movable one ranks higher, but the one tied to the point keeps the spot over it.
    const placed = place([
      label('movable', at, { priority: 2, elsewhere: [{ x: 600, y: 300 }] }),
      label('tied', at, { priority: 1 }),
    ]);
    expect(placed.get('tied')?.rect).toEqual({ x: 350, y: 258, w: 100, h: 28 });
    expect(placed.get('movable')?.state).toBe('');
    expect(placed.get('movable')?.rect).not.toEqual(placed.get('tied')?.rect);
  });

  it("leaves a label's place empty when it has no room, rather than show one further down", () => {
    const control = { x: 0, y: 0, w: 400, h: 600 };
    const placed = place(
      [
        label('boxed in', { x: 200, y: 300 }, { priority: 3 }),
        label('free', { x: 600, y: 300 }, { priority: 2 }),
        label('next', { x: 600, y: 100 }, { priority: 1 }),
      ],
      room({ noGo: [control], maxVisible: 2 }),
    );
    expect(placed.get('boxed in')?.state).toBe('capped');
    expect(placed.get('free')?.state).toBe('');
    expect(placed.get('next')?.state).toBe('capped');
  });

  it('shows labels as their icons in a small view, and a focused one in full', () => {
    const placed = place(
      [label('a', { x: 200, y: 300 }), label('b', { x: 600, y: 300 }, { focused: true })],
      room({ icons: true }),
    );
    expect(placed.get('a')?.state).toBe('compact');
    expect(placed.get('a')?.rect).toMatchObject(ICON);
    expect(placed.get('b')?.state).toBe('');
    expect(placed.get('b')?.rect).toMatchObject({ w: 100, h: 28 });
  });

  it('keeps a focused label where it was shown, growing from its icon with the icon still', () => {
    const at = { x: 400, y: 300 };
    const first = placeLabels([label('a', at)], room({ icons: true }), new Map());
    const was = first[0];
    if (!was?.rect || !was.shownAt) throw new Error('not shown');
    const then = place(
      [label('a', at, { focused: true })],
      room({ icons: true }),
      new Map([['a', was.shownAt]]),
    );
    expect(then.get('a')?.state).toBe('');
    expect(then.get('a')?.rect).toEqual({ x: was.rect.x - 1, y: was.rect.y, w: 100, h: 28 });
  });

  it('in a small view, opens a label in full over the others, which stay where they were', () => {
    const small = room({ icons: true });
    const labels = [
      label('a', { x: 300, y: 300 }),
      label('b', { x: 340, y: 300 }),
      label('c', { x: 380, y: 300 }),
    ];
    const before = placeLabels(labels, small, new Map());
    expect(before.map((p) => p.state)).toEqual(['compact', 'compact', 'compact']);
    const last = new Map(before.flatMap((p) => (p.shownAt ? [[p.id, p.shownAt] as const] : [])));
    // The last placed, so it would otherwise go first and take its neighbours' room.
    const opened = place(
      labels.map((l) => (l.id === 'c' ? { ...l, focused: true } : l)),
      small,
      last,
    );
    expect(opened.get('c')?.state).toBe('');
    expect(opened.get('c')?.rect).toMatchObject({ w: 100, h: 28 });
    for (const p of before.filter((q) => q.id !== 'c')) {
      expect(opened.get(p.id)?.state, p.id).toBe('compact');
      expect(opened.get(p.id)?.rect, p.id).toEqual(p.rect);
    }
  });

  it('lets a focused label follow its anchor into view, pulled in, without drifting from it', () => {
    // The anchor starts off the view's right edge and glides to its middle, frame by frame.
    let last = new Map<string, ShownAt>();
    let rect: Rect | null = null;
    for (let i = 0; i <= 20; i++) {
      const at = { x: 1200 - i * 40, y: 300 };
      const placed = placeLabels([label('lit', at, { focused: true })], room(), last);
      const p = placed[0];
      rect = p?.rect ?? null;
      if (i === 0) expect(rect?.x, 'pulled into view').toBe(800 - 4 - 100);
      last = new Map(p?.shownAt ? [['lit', p.shownAt]] : []);
    }
    expect(rect).toEqual({ x: 350, y: 258, w: 100, h: 28 });
  });

  it('pulls a focused label out from under the controls', () => {
    const control = { x: 300, y: 200, w: 200, h: 100 };
    const placed = place(
      [label('a', { x: 400, y: 300 }, { focused: true })],
      room({ noGo: [control] }),
    );
    const r = placed.get('a')?.rect;
    if (!r) throw new Error('not shown');
    expect(overlap(r, control)).toBe(false);
  });
});
