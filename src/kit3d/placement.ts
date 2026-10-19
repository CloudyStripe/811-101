/**
 * Where 3D labels go on screen, worked out apart from the page so it's tested without a browser.
 * The label layer (labels.ts) projects the scene, measures the labels and moves them; this decides
 * which show and where each sits, in the label layer's CSS pixels.
 *
 * Focused labels and the highest-priority others show, up to a cap. They're placed in turn:
 * focused labels first, then those tied to one point, then those that may sit at other places
 * along what they name, so these find room around the rest. Each takes the first spot by its
 * point that's inside the view, clear of the controls and the labels placed, covering nothing kept
 * clear (buried lines, say, and the leaders drawn so far) nor another shown label's point, with its
 * own leader under no label; last, the spots on the other side of its point. It shows in full where there's room and as its icon where there isn't, or always as its icon in a
 * small view; with no room at all it steps out of sight, leaving its place empty. A focused label
 * always shows in full where it was shown before, pulled into the free part of the view and out
 * from under the controls (WCAG 2.4.11). In a small view it shows in full over the others, keeping
 * only its icon's room, so they stay where they are.
 *
 * Markers (placeMarkers) are labels that never give way to each other: every one in view shows, as
 * a numbered badge, with its name beside it where there's room. A focused one keeps its badge, and
 * its name's side, where they were shown.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A tube on screen: a segment, and how far either side of it is covered. */
export interface Band {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  r: number;
}

/** A label as placing it needs to know it. */
export interface Candidate {
  id: string;
  /** Higher goes first; among equals, the nearer. */
  priority: number;
  /** How far away its anchor is, -1 to 1 in view. */
  depth: number;
  /** Where its anchor lands. */
  at: Point;
  /** Where its leader points from its anchor: null for none, as when its point is out of view. */
  point: Point | null;
  /** Its other places, in order, should there be no room by its anchor (null where out of view). */
  elsewhere: readonly (Point | null)[];
  /** Its size in full. */
  size: { w: number; h: number };
  /** In view, facing the camera, and not hidden. */
  visible: boolean;
  /** Shown in full however crowded: focused, pointed at from elsewhere, or named while pinned. */
  focused: boolean;
  /** Hangs below its anchor instead of above it. */
  below: boolean;
  /** Names a line: steps further off it before to either side. */
  offLine: boolean;
  /** Its definition, open beside it, against the middle of the label's top edge; null when closed. */
  tip: Rect | null;
  /** A marker shown by its badge alone unless it's focused, as on a path faded back. */
  badgeOnly?: boolean;
  /**
   * Pointed at from elsewhere, as the open stop is. As a marker, its name is placed with its
   * badge, before the others', which keep clear of both.
   */
  lit?: boolean;
}

/** Where a label was shown: by which of its places (0 for its anchor), against it, and how. */
export interface ShownAt {
  at: number;
  dx: number;
  dy: number;
  icon: boolean;
  /** A marker's name, the side of its badge it was shown on. */
  side?: 'left' | 'right';
}

/** The view the labels go in. */
export interface Room {
  width: number;
  height: number;
  /** The part of the view a focused label is pulled into. */
  bounds: Rect;
  /** The controls over the view. */
  noGo: readonly Rect[];
  /** What labels keep off, such as buried lines. */
  keepClear: readonly Band[];
  /** At most this many show; a focused label always does. */
  maxVisible: number;
  /** A small view: labels show as their icons. */
  icons: boolean;
}

export interface Placement {
  id: string;
  /** In full, as its icon, out of view, or out of sight for want of room or over the cap. */
  state: '' | 'compact' | 'off' | 'capped';
  /** Where it sits, when shown. */
  rect: Rect | null;
  /** Where its leader points, when it has one. */
  point: Point | null;
  /** Where it was shown, to keep it there should it be focused. */
  shownAt: ShownAt | null;
  /** A marker's name, shown on the left of its badge rather than the right. */
  side?: 'left';
  /** Where its leader leaves from, when not the whole of it: a named marker's badge. */
  from?: Rect;
}

/** A label shown as its icon. */
export const ICON = { w: 30, h: 30 };
/**
 * A label's icon sits a pixel further in when it shows in full than as an icon alone (its padding
 * is 3 px, not 2), so a label growing from its icon starts that much to the left, its icon still.
 */
const ICON_SHIFT = 1;
/** Room between a label and its anchor, for the leader. */
const GAP = 14;
/** Room kept between a label and what it's moved clear of. */
const MARGIN = 4;
/** Room kept between labels and the view's edges, and the free part's: the page's own gutter. */
const EDGE = 16;
/**
 * How far a marker's icon tab stands out of its badge, to the side and up: the edges keep clear of
 * it too.
 */
const TAB = { x: 7, y: 6 };

/**
 * A spot by a label's anchor, in steps of about its own size, or beside it, level with it, or
 * (`other`) on the other side of it from where it hangs, a step of its width to either side.
 */
type Spot = readonly [number, number] | 'left' | 'right' | readonly ['other', number];

/** On the other side of the anchor, under a label that hangs over it (or over one that hangs under). */
const OTHER_SIDE: readonly Spot[] = [
  ['other', 0],
  ['other', -1],
  ['other', 1],
];

/**
 * Where a label may sit, nearest first: over its point (or under it), then to either side, then
 * beside the point, level with it, then a row or two further out, so labels on things close
 * together stack beside each other, each with its leader.
 */
const NEAR_SPOTS: readonly Spot[] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  'left',
  'right',
  [0, 1],
  [-1, 1],
  [1, 1],
  [0, 2],
  [-1, 2],
  [1, 2],
];
/** And last, with no room on its side, on the other side of its point, before it gives way. */
const SPOTS: readonly Spot[] = [...NEAR_SPOTS, ...OTHER_SIDE];
/** The same, for a label on a line: a row further off before either side, so it hangs clear. */
const OFF_LINE_SPOTS: readonly Spot[] = [
  [0, 0],
  [0, 1],
  [-1, 0],
  [1, 0],
  'left',
  'right',
  [-1, 1],
  [1, 1],
  [0, 2],
  [-1, 2],
  [1, 2],
  ...OTHER_SIDE,
];

const overlaps = (r: Rect, list: readonly Rect[]) =>
  list.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);

/** Whether a point lies inside a rectangle. */
const holds = (r: Rect, p: Point) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;

/** How far a point is from a rectangle: 0 inside it. */
function fromRect(x: number, y: number, r: Rect): number {
  return Math.hypot(Math.max(r.x - x, 0, x - r.x - r.w), Math.max(r.y - y, 0, y - r.y - r.h));
}

/** How far a point is from a band's middle line. */
function fromBand(x: number, y: number, b: Band): number {
  const vx = b.bx - b.ax;
  const vy = b.by - b.ay;
  const length = vx * vx + vy * vy;
  const t =
    length === 0 ? 0 : Math.min(1, Math.max(0, ((x - b.ax) * vx + (y - b.ay) * vy) / length));
  return Math.hypot(x - b.ax - t * vx, y - b.ay - t * vy);
}

/** Whether a band's middle line passes through a rectangle (Liang–Barsky clipping). */
function crosses(b: Band, r: Rect): boolean {
  const dx = b.bx - b.ax;
  const dy = b.by - b.ay;
  let enter = 0;
  let exit = 1;
  for (const [p, q] of [
    [-dx, b.ax - r.x],
    [dx, r.x + r.w - b.ax],
    [-dy, b.ay - r.y],
    [dy, r.y + r.h - b.ay],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else exit = Math.min(exit, t);
    if (enter > exit) return false;
  }
  return true;
}

/**
 * Whether a band covers any of a rectangle. Apart, the nearest two points are an end of the
 * segment and the rectangle, or a corner of the rectangle and the segment.
 */
export function covers(b: Band, r: Rect): boolean {
  if (crosses(b, r)) return true;
  if (fromRect(b.ax, b.ay, r) < b.r || fromRect(b.bx, b.by, r) < b.r) return true;
  return [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x, r.y + r.h],
    [r.x + r.w, r.y + r.h],
  ].some(([x = 0, y = 0]) => fromBand(x, y, b) < b.r);
}

/**
 * Where a label's leader leaves it for the point it names: the nearest point of its edge, short of
 * its rounded ends. Null when the label covers the point, and needs no leader.
 */
export function leaderStart(r: Rect, point: Point): Point | null {
  if (point.x > r.x && point.x < r.x + r.w && point.y > r.y && point.y < r.y + r.h) return null;
  const pad = Math.min(12, r.w / 2);
  return {
    x: Math.min(Math.max(point.x, r.x + pad), r.x + r.w - pad),
    y: Math.min(Math.max(point.y, r.y), r.y + r.h),
  };
}

/** A label's leader from here to the point it names, as a band one line thick; null for none. */
function leaderOf(r: Rect, point: Point | null): Band | null {
  if (!point) return null;
  const from = leaderStart(r, point);
  return from ? { ax: from.x, ay: from.y, bx: point.x, by: point.y, r: 2 } : null;
}

/**
 * Moves a rectangle out from under the given ones by as little as it can, within the view: a
 * focused label that would sit under a control shows beside it instead (WCAG 2.4.11).
 */
function clearOf(r: Rect, blocks: readonly Rect[], width: number, height: number): Rect {
  if (!overlaps(r, blocks)) return r;
  const within = (c: Rect) =>
    c.x >= EDGE && c.y >= EDGE && c.x + c.w <= width - EDGE && c.y + c.h <= height - EDGE;
  let best = r;
  let bestMove = Infinity;
  for (const q of blocks) {
    if (!overlaps(r, [q])) continue;
    for (const c of [
      { ...r, y: q.y - r.h - MARGIN },
      { ...r, y: q.y + q.h + MARGIN },
      { ...r, x: q.x - r.w - MARGIN },
      { ...r, x: q.x + q.w + MARGIN },
    ]) {
      const move = Math.abs(c.x - r.x) + Math.abs(c.y - r.y);
      if (move < bestMove && within(c) && !overlaps(c, blocks)) {
        best = c;
        bestMove = move;
      }
    }
  }
  return best;
}

/** A label this size over its anchor, or under it. */
function over(at: Point, size: { w: number; h: number }, below: boolean): Rect {
  return {
    x: at.x - size.w / 2,
    y: below ? at.y + GAP : at.y - size.h - GAP,
    w: size.w,
    h: size.h,
  };
}

/**
 * Where a label this size may sit by a place of its, nearest first, in a view this wide. Near an
 * edge, it may slide inward along its row, up to a little over half its width, so it stays
 * readable and still sits by its place.
 */
function spotsBy(
  at: Point,
  size: { w: number; h: number },
  c: Pick<Candidate, 'below' | 'offLine'>,
  width: number,
  list: readonly Spot[] = c.offLine ? OFF_LINE_SPOTS : SPOTS,
): Rect[] {
  const first = over(at, size, c.below);
  const dx = size.w / 2 + 10;
  const dy = (size.h + 8) * (c.below ? 1 : -1);
  const level = at.y - size.h / 2;
  return list.flatMap((spot) => {
    const r =
      spot === 'left'
        ? { ...first, x: at.x - size.w - 10, y: level }
        : spot === 'right'
          ? { ...first, x: at.x + 10, y: level }
          : spot[0] === 'other'
            ? { ...first, x: first.x + spot[1] * dx, y: over(at, size, !c.below).y }
            : { ...first, x: first.x + spot[0] * dx, y: first.y + spot[1] * dy };
    const x = Math.min(Math.max(r.x, EDGE), width - EDGE - r.w);
    return Math.abs(x - r.x) <= r.w * 0.6 ? [{ ...r, x }] : [];
  });
}

/** Decides which labels show and where, given where they were shown last. */
export function placeLabels(
  candidates: readonly Candidate[],
  room: Room,
  last: ReadonlyMap<string, ShownAt>,
): Placement[] {
  const { width, height, bounds } = room;
  // The controls first; each label placed joins them, so later ones keep clear of it.
  const placed: Rect[] = [...room.noGo];
  // What labels keep off; each leader drawn joins it, so no label sits on another's leader.
  const bands: Band[] = [...room.keepClear];
  // The labels placed, which no leader may pass under.
  const shownRects: Rect[] = [];

  const inside = (r: Rect) =>
    r.x >= EDGE && r.y >= EDGE && r.x + r.w <= width - EDGE && r.y + r.h <= height - EDGE;
  const clamp = (r: Rect): Rect => ({
    ...r,
    x: Math.min(Math.max(r.x, bounds.x + EDGE), bounds.x + bounds.w - EDGE - r.w),
    y: Math.min(Math.max(r.y, bounds.y + EDGE), bounds.y + bounds.h - EDGE - r.h),
  });
  /** Where the labels that show point, so none sits over another's point and its leader. */
  let points: readonly { id: string; point: Point }[] = [];
  /**
   * Inside the view, clear of the controls and the labels placed, covering nothing kept clear or
   * any leader, nor another label's point, and its own leader to `point` under no label.
   */
  const free = (point: Point | null, id: string) => (r: Rect) => {
    if (!inside(r) || overlaps(r, placed) || bands.some((band) => covers(band, r))) return false;
    if (points.some((q) => q.id !== id && holds(r, q.point))) return false;
    const own = leaderOf(r, point);
    return !own || !shownRects.some((q) => crosses(own, q));
  };
  /** Takes the room a label shown here needs, and its leader's. */
  const take = (r: Rect, point: Point | null) => {
    placed.push(r);
    shownRects.push(r);
    const own = leaderOf(r, point);
    if (own) bands.push(own);
  };
  const spots = (at: Point, size: { w: number; h: number }, c: Candidate): Rect[] =>
    spotsBy(at, size, c, width);

  const out: Placement[] = [];
  const hide = (c: Candidate, state: 'off' | 'capped') => {
    out.push({ id: c.id, state, rect: null, point: null, shownAt: null });
  };

  // Which show: focused labels, then the highest-priority others up to the cap. One with no room
  // leaves its place empty rather than give it to a label further down.
  const shown: Candidate[] = [];
  const byRank = [...candidates].sort(
    (a, b) => Number(b.focused) - Number(a.focused) || b.priority - a.priority || a.depth - b.depth,
  );
  for (const c of byRank) {
    if (c.focused) shown.push(c);
    else if (!c.visible) hide(c, 'off');
    // Over the cap: out of sight, but still in the tab order, so focusing it shows it.
    else if (shown.length >= room.maxVisible) hide(c, 'capped');
    else shown.push(c);
  }
  points = shown.flatMap((c) => (c.point ? [{ id: c.id, point: c.point }] : []));
  // Placed in turn: focused labels, then those tied to one point, then those with other places.
  shown.sort(
    (a, b) =>
      Number(b.focused) - Number(a.focused) ||
      Number(a.elsewhere.length > 0) - Number(b.elsewhere.length > 0),
  );

  for (const c of shown) {
    // Its anchor, then its other places, each with where its leader points from there.
    const anchor = { ...c.at, point: c.point };
    const places = [anchor, ...c.elsewhere.map((p) => p && { ...p, point: p })];
    /** The first free spot for a label this size, by the first of its places with room. */
    const find = (size: { w: number; h: number }) => {
      for (const [at, p] of places.entries()) {
        if (!p) continue;
        const r = spots(p, size, c).find(free(p.point, c.id));
        if (r) return { r, at, p };
      }
      return null;
    };
    const was = last.get(c.id);
    const by = was ? places[was.at] : null;
    if (c.focused && room.icons) {
      // In a small view, a focused label shows in full over the others, keeping only its icon's
      // room, where its icon was: the icons beside it stay where they are, to be tapped in turn.
      const icon =
        was?.icon && by
          ? { r: { x: by.x + was.dx, y: by.y + was.dy, ...ICON }, at: was.at, p: by }
          : (find(ICON) ?? { r: over(c.at, ICON, c.below), at: 0, p: anchor });
      take(icon.r, icon.p.point);
      // Grown from its icon, its icon still; out from under the controls only.
      const grown = { x: icon.r.x - ICON_SHIFT, y: icon.r.y, ...c.size };
      out.push({
        id: c.id,
        state: '',
        rect: clearOf(clamp(grown), room.noGo, width, height),
        point: icon.p.point,
        shownAt: { at: icon.at, dx: icon.r.x - icon.p.x, dy: icon.r.y - icon.p.y, icon: true },
      });
      continue;
    }
    if (c.focused) {
      // Where it was shown, in full: grown from its icon, its icon still, if it was shown as one.
      // Kept against its place, before any pull into view, so it follows its place as that moves.
      const kept =
        was && by
          ? {
              r: { x: by.x + was.dx - (was.icon ? ICON_SHIFT : 0), y: by.y + was.dy, ...c.size },
              at: was.at,
              p: by,
            }
          : null;
      const {
        r: spot,
        at,
        p,
      } = kept ?? find(c.size) ?? { r: over(c.at, c.size, c.below), at: 0, p: anchor };
      const r = clearOf(clamp(spot), placed, width, height);
      take(r, p.point);
      // Its definition may be open beside it; later labels keep clear of that too.
      if (c.tip) placed.push({ ...c.tip, x: r.x + r.w / 2 + c.tip.x, y: r.y + c.tip.y });
      out.push({
        id: c.id,
        state: '',
        rect: r,
        point: p.point,
        shownAt: { at, dx: spot.x - p.x, dy: spot.y - p.y, icon: false },
      });
      continue;
    }
    // In full where there's room, as its icon where there isn't, or in a small view.
    const full = room.icons ? null : find(c.size);
    const found = full ?? find(ICON);
    if (!found) {
      // No room beside the others: out of sight like a label over the cap, and like it, still
      // reachable by keyboard.
      hide(c, 'capped');
      continue;
    }
    take(found.r, found.p.point);
    out.push({
      id: c.id,
      state: full ? '' : 'compact',
      rect: found.r,
      point: found.p.point,
      shownAt: {
        at: found.at,
        dx: found.r.x - found.p.x,
        dy: found.r.y - found.p.y,
        icon: !full,
      },
    });
  }
  return out;
}

/** A marker's badge: what shows of it without its name. */
export const MARKER = { w: 26, h: 26 };
/** Room kept between badges, so none touches another. */
const APART = 2;

/**
 * Where a marker's badge may sit, nearest first: as a label may, then further out to either side,
 * a row higher, and under its point, so that badges on points bunched together, as far stops can
 * be, each find a place.
 */
const MARKER_SPOTS: readonly Spot[] = [
  ...NEAR_SPOTS,
  [-2, 0],
  [2, 0],
  [-2, 1],
  [2, 1],
  [0, -2],
  [-1, -2],
  [1, -2],
  [0, 3],
  [-1, 3],
  [1, 3],
  [-2, 2],
  [2, 2],
  [-2, -2],
  [2, -2],
];

/**
 * Where markers go: numbered badges that, unlike labels, never give way to each other, so every
 * one in view shows. In turn (focused first, then by priority, the nearer first), each badge takes
 * the first free spot by its point, on a leader: over it, a little to either side, beside it, a row
 * or more further up or under it, clear of the controls, the badges placed and their leaders, and
 * off the other markers' points, which their leaders must reach. With no such spot, it takes the
 * first that's at least clear of the controls and the other badges, and failing that, sits over
 * its point all the same, so none is dropped for want of room. Then, in the same order, each shows
 * its name beside its badge, on the right or else the left, wherever that's clear of the controls,
 * the other badges, every point (its own too, so its leader shows), the names shown and the others'
 * leaders; where neither side is, its badge shows alone. A focused marker always shows its name;
 * in a small view, or shown by its badge alone (badgeOnly), only then. A lit one's name, as the
 * open stop's, is placed as soon as its badge is, so the badges after it keep clear of it. A
 * focused marker stays where it was shown, kept in the free part of the view and out from under
 * the controls (WCAG 2.4.11); one whose point is out of sight is pulled in, without a leader, and
 * where it was shown is kept for when its point comes back. Unfocused, a marker whose point is out
 * of view, or under a control, steps out of sight.
 */
export function placeMarkers(
  candidates: readonly Candidate[],
  room: Room,
  last: ReadonlyMap<string, ShownAt>,
): Placement[] {
  const { width, height, bounds, noGo } = room;
  const view = { x: 0, y: 0, w: width, h: height };
  // Clear of the edges by the gutter, and of the icon tab standing out of the badge.
  const inside = (r: Rect) =>
    r.x >= EDGE + TAB.x &&
    r.y >= EDGE + TAB.y &&
    r.x + r.w <= width - EDGE - TAB.x &&
    r.y + r.h <= height - EDGE;
  const within = (r: Rect, b: Rect): Rect => ({
    ...r,
    x: Math.min(Math.max(r.x, b.x + EDGE + TAB.x), b.x + b.w - EDGE - TAB.x - r.w),
    y: Math.min(Math.max(r.y, b.y + EDGE + TAB.y), b.y + b.h - EDGE - r.h),
  });
  const inSight = (c: Candidate) =>
    c.visible &&
    c.at.x >= 0 &&
    c.at.x <= width &&
    c.at.y >= 0 &&
    c.at.y <= height &&
    !noGo.some((q) => c.at.x >= q.x && c.at.x <= q.x + q.w && c.at.y >= q.y && c.at.y <= q.y + q.h);

  const badges: Rect[] = [];
  /** The lit markers' names, placed with their badges, for the badges after them to keep off. */
  const held = new Map<string, { rect: Rect; side: 'right' | 'left' }>();
  const heldNames: Rect[] = [];
  const leaders = new Map<string, Band>();
  const bands: Band[] = [...room.keepClear];
  const order = [...candidates].sort(
    (a, b) => Number(b.focused) - Number(a.focused) || b.priority - a.priority || a.depth - b.depth,
  );
  /** The points of the markers in sight, where their leaders end. */
  const points = order.filter(inSight).map((c) => c.at);
  const onPoint = (r: Rect, own: Point) => points.some((p) => p !== own && holds(r, p));
  /** Inside the view, clear of the controls, and a little apart from the badges and lit names. */
  const roomy = (r: Rect) => {
    const apart = { x: r.x - APART, y: r.y - APART, w: r.w + 2 * APART, h: r.h + 2 * APART };
    return (
      inside(r) && !overlaps(r, noGo) && !overlaps(apart, badges) && !overlaps(apart, heldNames)
    );
  };
  /** Roomy, off the other points, clear of the leaders, its own crossing no badge or lit name. */
  const free = (c: Candidate, point: Point | null) => (r: Rect) => {
    if (!roomy(r) || onPoint(r, c.at) || bands.some((band) => covers(band, r))) return false;
    const own = leaderOf(r, point);
    return !own || ![...badges, ...heldNames].some((q) => crosses(own, q));
  };
  /** A marker's whole label, its name beside its badge: on the right of it, or the left. */
  const besides = (c: Candidate, badge: Rect) => {
    const right = { x: badge.x, y: badge.y + (MARKER.h - c.size.h) / 2, w: c.size.w, h: c.size.h };
    return { right, left: { ...right, x: badge.x + MARKER.w - c.size.w } };
  };
  /**
   * The side for a name that shows however crowded: one in view clear of the controls and its own
   * point (`clear`) if it can be, else one in view.
   */
  const anyway = (right: Rect, left: Rect, clear: (r: Rect) => boolean): 'right' | 'left' =>
    ([right, left].find((r) => inside(r) && clear(r)) ?? [right, left].find(inside) ?? right) ===
    left
      ? 'left'
      : 'right';

  const out: Placement[] = [];
  const placed: { c: Candidate; badge: Rect; point: Point | null; shownAt: ShownAt | null }[] = [];
  for (const c of order) {
    const seen = inSight(c);
    if (!seen && !c.focused) {
      out.push({ id: c.id, state: 'off', rect: null, point: null, shownAt: null });
      continue;
    }
    const point = seen ? c.point : null;
    const was = last.get(c.id);
    let badge: Rect;
    let shownAt: ShownAt | null;
    if (!seen) {
      // Focused with its point out of sight: pulled into the free part of the view, and where it
      // was shown kept for when its point comes back.
      badge = clearOf(within(over(c.at, MARKER, c.below), bounds), noGo, width, height);
      shownAt = was ?? null;
    } else if (c.focused && was?.at === 0) {
      // Focused, it stays where it was, so the reader's eye and pointer find it there, but kept in
      // the free part of the view, out from under the controls.
      const kept = { x: c.at.x + was.dx, y: c.at.y + was.dy, ...MARKER };
      badge = clearOf(within(kept, bounds), noGo, width, height);
      shownAt = was;
    } else {
      const spots = spotsBy(c.at, MARKER, c, width, MARKER_SPOTS);
      badge =
        spots.find(free(c, point)) ??
        spots.find(roomy) ??
        clearOf(within(over(c.at, MARKER, c.below), view), noGo, width, height);
      shownAt = { at: 0, dx: badge.x - c.at.x, dy: badge.y - c.at.y, icon: true };
    }
    if (c.lit) {
      // Its name now, beside its badge where that's clear of all placed so far and of every
      // point, so the badges after it keep clear of the name as well as the badge.
      const { right, left } = besides(c, badge);
      const clear = (r: Rect) => !overlaps(r, noGo) && !(point && holds(r, point));
      const open = (r: Rect) =>
        inside(r) &&
        clear(r) &&
        !overlaps(r, badges) &&
        !overlaps(r, heldNames) &&
        !onPoint(r, c.at) &&
        !bands.some((band) => covers(band, r));
      const side = open(right) ? 'right' : open(left) ? 'left' : anyway(right, left, clear);
      const rect = side === 'left' ? left : right;
      held.set(c.id, { rect, side });
      heldNames.push(rect);
    }
    badges.push(badge);
    const own = leaderOf(badge, point);
    if (own) {
      bands.push(own);
      leaders.set(c.id, own);
    }
    placed.push({ c, badge, point, shownAt });
  }

  const names: Rect[] = [...heldNames];
  for (const { c, badge, point, shownAt } of placed) {
    const { right, left } = besides(c, badge);
    const own = leaders.get(c.id);
    const others = badges.filter((b) => b !== badge);
    const clear = (r: Rect) => !overlaps(r, noGo) && !(point && holds(r, point));
    const fits = (r: Rect) =>
      inside(r) &&
      clear(r) &&
      !overlaps(r, others) &&
      !overlaps(r, names) &&
      !onPoint(r, c.at) &&
      !bands.some((band) => band !== own && covers(band, r));
    // A lit marker's name went with its badge. A focused one's stays on the side it was shown on,
    // while that's in view and clear of the controls, so it doesn't jump from under the reader's
    // eye and pointer. No room either side for a focused marker's name: over the others, on a side
    // in view, clear of the controls and its own point if it can be.
    const before = c.focused ? shownAt?.side : undefined;
    const was = before === 'left' ? left : right;
    const stays = before && inside(was) && clear(was) ? before : null;
    const side: 'right' | 'left' | null =
      held.get(c.id)?.side ??
      stays ??
      (c.focused || !(room.icons || c.badgeOnly)
        ? fits(right)
          ? 'right'
          : fits(left)
            ? 'left'
            : c.focused
              ? anyway(right, left, clear)
              : null
        : null);
    const kept = held.has(c.id);
    const rect = side === 'left' ? left : side === 'right' ? right : badge;
    if (side && !kept) names.push(rect);
    out.push({
      id: c.id,
      state: side ? '' : 'compact',
      rect,
      point,
      shownAt: shownAt && {
        at: shownAt.at,
        dx: shownAt.dx,
        dy: shownAt.dy,
        icon: side === null,
        ...(side ? { side } : {}),
      },
      ...(side === 'left' ? { side } : {}),
      ...(side ? { from: badge } : {}),
    });
  }
  return out;
}
