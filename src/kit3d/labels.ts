/**
 * HTML labels that follow points in the 3D scene. This layer projects each label's anchor, measures
 * the labels, reads what has focus, and moves them; where each goes is decided apart, in
 * placement.ts. The focused and highest-priority labels show, up to a cap; a crowded label shrinks
 * to its icon, then steps out of sight. The panel, sheet and toolbars are no-go zones, and labels
 * keep off whatever the scene asks them not to cover, such as buried lines: a label that would
 * cover one hangs further out, on a longer leader, and no label sits on another's leader. In a
 * small view every label shows as its icon, and a label shown as its icon shows its name again
 * while it's focused or its definition is pinned open. A label out of sight for want of room stays
 * in the tab order, and a focused label is always placed so it's never hidden (WCAG 2.4.11). A thin
 * leader line ties each shown label to the point it names, and only so many show at once, so the
 * scene stays the hero. Placed as markers instead (placeMarkers), every one in view shows, as its
 * badge, with its name beside it where there's room.
 */
import { Vector3, type PerspectiveCamera } from 'three';
import {
  leaderStart,
  placeLabels,
  type Band,
  type Candidate,
  type Placement,
  type Rect,
  type Room,
  type ShownAt,
} from './placement.ts';

export type { Rect } from './placement.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Room kept between a label and anything it keeps off, in CSS pixels. */
const CLEARANCE = 3;

export interface Label {
  readonly id: string;
  readonly element: HTMLElement;
  /** Where the label sits: just above this point, or just below it with `below`. */
  anchor: Vector3;
  /** Where its leader line points, on the thing it names. Left out, it's the anchor. */
  point?: Vector3;
  /** Higher goes first. */
  priority: number;
  /** When set, the label shows only while the camera is on this side of the anchor. */
  facing?: Vector3;
  hidden?: boolean;
  /** Shown however crowded the view, like a focused label: pointed at from elsewhere, e.g. a key. */
  highlight?: boolean;
  /** Placed as a marker, shown by its badge alone unless focused, as on a path faded back. */
  badgeOnly?: boolean;
  /** Hangs below its anchor instead of above it, e.g. to keep clear of a line just above. */
  below?: boolean;
  /**
   * Names a line: where it can't sit by its point, it hangs further off the line before it moves
   * to either side, so it never slides over another stretch of the line.
   */
  offLine?: boolean;
  /**
   * Other places on the thing it names where it may sit instead, in order, should there be no
   * room by its anchor: further along a line, say. Its leader then points there.
   */
  along?: readonly Vector3[];
}

/** Something labels keep off, such as a buried line: a tube this thick through these points. */
export interface KeepClear {
  points: readonly Vector3[];
  radius: number;
}

/**
 * A label's open definition, against the middle of the label's top edge, or null when it's closed.
 * The definition is centred on its label, so this holds as the label grows from its icon.
 */
function openTip(element: HTMLElement): Rect | null {
  const tip = element.querySelector<HTMLElement>('[role="tooltip"]');
  if (!tip || tip.hidden) return null;
  const t = tip.getBoundingClientRect();
  if (t.width === 0 || t.height === 0) return null;
  const l = element.getBoundingClientRect();
  return { x: t.left - (l.left + l.width / 2), y: t.top - l.top, w: t.width, h: t.height };
}

/** How a layer decides where its labels go: placeLabels, or placeMarkers. */
export type Placer = (
  candidates: readonly Candidate[],
  room: Room,
  last: ReadonlyMap<string, ShownAt>,
) => Placement[];

export class LabelLayer {
  private labels: Label[] = [];
  private keep: readonly KeepClear[] = [];
  private readonly sizes = new Map<string, { w: number; h: number }>();
  private readonly lastKey = new Map<string, string>();
  /** Where the labels shown at the last update sit, for what else must keep clear of them. */
  private shownRects: readonly Rect[] = [];
  /** Where each shown label was shown, so a label focused stays where it is. */
  private readonly shownAt = new Map<string, ShownAt>();
  /**
   * Labels shown as their icon when their definition was pinned open: they show their name until
   * it closes.
   */
  private readonly named = new Set<string>();
  private readonly projected = new Vector3();
  private readonly toCamera = new Vector3();
  private readonly lifted = new Vector3();
  private readonly camera: PerspectiveCamera;
  /** No-go rectangles in the label container's coordinates. */
  private readonly noGo: () => readonly Rect[];
  private readonly placer: Placer;
  /** One leader line and anchor dot per label, drawn in an SVG under the labels. */
  private svg: SVGSVGElement | null = null;
  private readonly leaders = new Map<
    string,
    { group: SVGGElement; line: SVGLineElement; dot: SVGCircleElement }
  >();

  constructor(
    camera: PerspectiveCamera,
    noGo: () => readonly Rect[],
    placer: Placer = placeLabels,
  ) {
    this.camera = camera;
    this.noGo = noGo;
    this.placer = placer;
  }

  setLabels(labels: Label[]): void {
    this.labels = labels;
    // New anchors: where the old labels sat no longer says where these go.
    this.shownAt.clear();
    this.named.clear();
    this.buildLeaders();
    this.measure();
  }

  /** What labels keep off from now on, such as the lines the view is about. */
  setKeepClear(keep: readonly KeepClear[]): void {
    this.keep = keep;
  }

  /** Leaders live in an SVG layer in the labels' own container, beneath the labels. */
  private buildLeaders(): void {
    const container = this.labels[0]?.element.parentElement;
    if (!container) return;
    if (this.svg?.parentElement !== container) {
      this.svg?.remove();
      this.svg = document.createElementNS(SVG_NS, 'svg');
      this.svg.classList.add('lbl-leaders');
      this.svg.setAttribute('aria-hidden', 'true');
      container.prepend(this.svg);
      this.leaders.clear();
    }
    for (const label of this.labels) {
      if (this.leaders.has(label.id)) continue;
      // Each leader fades with its label (the CSS transitions the group's opacity).
      const group = document.createElementNS(SVG_NS, 'g');
      const line = document.createElementNS(SVG_NS, 'line');
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('r', '2.5');
      group.classList.add('off');
      group.append(line, dot);
      this.svg.append(group);
      this.leaders.set(label.id, { group, line, dot });
    }
  }

  /**
   * Re-measures label sizes (after fonts load or text changes) at full size, on hidden copies.
   * Toggling the labels' own classes would restart their fade transitions and flash them.
   */
  measure(): void {
    const copies = this.labels.map((l) => {
      const copy = l.element.cloneNode(true) as HTMLElement;
      copy.classList.remove('compact', 'off');
      copy.setAttribute('aria-hidden', 'true');
      copy.style.cssText = 'visibility: hidden; transition: none; transform: none';
      l.element.after(copy);
      return { id: l.id, copy };
    });
    // All copies are in place before the first read, so this lays out once.
    for (const { id, copy } of copies) {
      this.sizes.set(id, { w: copy.offsetWidth || 120, h: copy.offsetHeight || 28 });
    }
    for (const { copy } of copies) copy.remove();
  }

  /** A point's place on screen, in CSS pixels, and its depth (-1 to 1 in view). */
  private toScreen(p: Vector3, width: number, height: number) {
    const q = this.projected.copy(p).project(this.camera);
    return { x: (q.x * 0.5 + 0.5) * width, y: (-q.y * 0.5 + 0.5) * height, z: q.z };
  }

  /** What labels keep off, as bands on screen: each tube as thick as it's drawn, and a little more. */
  private bands(width: number, height: number): Band[] {
    const bands: Band[] = [];
    for (const k of this.keep) {
      const on = k.points.flatMap((p) => {
        const s = this.toScreen(p, width, height);
        if (s.z <= -1 || s.z >= 1) return [];
        const t = this.toScreen(this.lifted.copy(p).setY(p.y + k.radius), width, height);
        return [{ x: s.x, y: s.y, r: Math.hypot(t.x - s.x, t.y - s.y) + CLEARANCE }];
      });
      const ends = on.length === 1 ? [on[0], on[0]] : on;
      for (let i = 1; i < ends.length; i++) {
        const a = ends[i - 1];
        const b = ends[i];
        if (a && b) bands.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, r: Math.max(a.r, b.r) });
      }
    }
    return bands;
  }

  /**
   * Places every label for the current camera. `bounds` is the part of the view a focused label
   * is pulled into, so the panel or sheet never covers it; it defaults to the whole view. At most
   * `maxVisible` labels show at once (a focused one always does), highest priority first. With
   * `icons`, for a small view, they show as their icons.
   */
  update(
    width: number,
    height: number,
    bounds: Rect = { x: 0, y: 0, w: width, h: height },
    maxVisible = Infinity,
    icons = false,
  ): void {
    const focused = document.activeElement;
    const candidates = this.labels.map((label): Candidate => {
      const s = this.toScreen(label.anchor, width, height);
      const facingOk =
        !label.facing ||
        this.toCamera.copy(this.camera.position).sub(label.anchor).dot(label.facing) > 0;
      const visible = !label.hidden && facingOk && s.z > -1 && s.z < 1;
      // The leader's end, on the thing itself, when it differs from where the label sits.
      const q = label.point ? this.toScreen(label.point, width, height) : s;
      // A label shown as its icon, as all are in a small view, shows its name while its definition
      // is pinned open by a tap or click, as when it's focused. (Not for a hover, which the name,
      // taking more room, could move out from under.)
      const pinned = label.element.dataset.tip === 'pinned';
      if (!pinned) this.named.delete(label.id);
      else if (icons || this.shownAt.get(label.id)?.icon) this.named.add(label.id);
      label.element.classList.toggle('lit', label.highlight === true && !label.hidden);
      const isFocused =
        !label.hidden &&
        (label.highlight === true ||
          label.element.contains(focused) ||
          (pinned && this.named.has(label.id)));
      return {
        id: label.id,
        priority: label.priority,
        depth: s.z,
        at: { x: s.x, y: s.y },
        // A leader only when its point is in view: a label pulled in from off screen has none.
        point: visible ? { x: q.x, y: q.y } : null,
        // Its other places, on screen; one out of view is no place for it.
        elsewhere: (label.along ?? []).map((p) => {
          const a = this.toScreen(p, width, height);
          return a.z > -1 && a.z < 1 ? { x: a.x, y: a.y } : null;
        }),
        size: this.sizes.get(label.id) ?? { w: 120, h: 28 },
        visible,
        focused: isFocused,
        lit: label.highlight === true && !label.hidden,
        badgeOnly: label.badgeOnly === true,
        below: label.below === true,
        offLine: label.offLine === true,
        // Only a focused label's definition is kept clear of.
        tip: isFocused ? openTip(label.element) : null,
      };
    });
    const placements = this.placer(
      candidates,
      {
        width,
        height,
        bounds,
        noGo: this.noGo(),
        keepClear: this.bands(width, height),
        maxVisible,
        icons,
      },
      this.shownAt,
    );
    const byId = new Map(this.labels.map((label) => [label.id, label]));
    for (const placement of placements) {
      const label = byId.get(placement.id);
      if (label) this.place(label, placement);
    }
    this.shownRects = placements.flatMap((p) =>
      p.rect && (p.state === '' || p.state === 'compact') ? [p.rect] : [],
    );
  }

  /** Where the labels shown sit, as of the last update. */
  get shown(): readonly Rect[] {
    return this.shownRects;
  }

  private place(label: Label, { rect: r, state, point, shownAt, side, from }: Placement): void {
    if (shownAt) this.shownAt.set(label.id, shownAt);
    else this.shownAt.delete(label.id);
    const { classList, style } = label.element;
    // A label being hidden fades out where it is, at its current size, rather than jumping first.
    const key = !r
      ? state
      : `${Math.round(r.x)},${Math.round(r.y)},${state},${side ?? ''},${point ? `${Math.round(point.x)},${Math.round(point.y)}` : '-'}`;
    if (this.lastKey.get(label.id) === key) return;
    this.lastKey.set(label.id, key);
    // From the whole label, or a named marker's badge.
    this.drawLeader(label.id, from ?? r, point);
    classList.toggle('off', state === 'off');
    classList.toggle('capped', state === 'capped');
    if (!r) return;
    style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`;
    classList.toggle('compact', state === 'compact');
    // A marker's name on the left of its badge.
    classList.toggle('left', side === 'left');
  }

  /**
   * A line from the label's nearest edge to its point, and a dot on the point. Hidden, it fades out
   * where it was, as its label does.
   */
  private drawLeader(id: string, r: Rect | null, point: { x: number; y: number } | null): void {
    const leader = this.leaders.get(id);
    if (!leader) return;
    const { group, line, dot } = leader;
    const from = r && point ? leaderStart(r, point) : null;
    if (!from || !point) {
      group.classList.add('off');
      return;
    }
    line.setAttribute('x1', from.x.toFixed(1));
    line.setAttribute('y1', from.y.toFixed(1));
    line.setAttribute('x2', point.x.toFixed(1));
    line.setAttribute('y2', point.y.toFixed(1));
    dot.setAttribute('cx', point.x.toFixed(1));
    dot.setAttribute('cy', point.y.toFixed(1));
    group.classList.remove('off');
  }
}
