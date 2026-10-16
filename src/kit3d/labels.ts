/**
 * HTML labels that follow points in the 3D scene. Ported from the diorama's layout: the focused
 * and highest-priority labels go first, nearer labels before farther ones; a crowded label shrinks
 * to its icon, then steps out of sight. The panel, sheet and toolbars are no-go zones. A label out
 * of sight for want of room stays in the tab order, and a focused label is always placed so it's
 * never hidden (WCAG 2.4.11). A thin leader line ties each shown label to the point it names, and
 * only so many show at once, so the scene stays the hero.
 */
import { Vector3, type PerspectiveCamera } from 'three';

const SVG_NS = 'http://www.w3.org/2000/svg';

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
  /** Shown only while focused: out of sight otherwise, however much room, but in the tab order. */
  quiet?: boolean;
  /** Hangs below its anchor instead of above it, e.g. to keep clear of a line just above. */
  below?: boolean;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (r: Rect, list: readonly Rect[]) =>
  list.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);

/** A label's open definition, as a rectangle in the label layer, or null when it's closed. */
function openTip(element: HTMLElement): Rect | null {
  const tip = element.querySelector<HTMLElement>('[role="tooltip"]');
  const layer = element.parentElement;
  if (!tip || tip.hidden || !layer) return null;
  const t = tip.getBoundingClientRect();
  if (t.width === 0 || t.height === 0) return null;
  const l = layer.getBoundingClientRect();
  return { x: t.left - l.left, y: t.top - l.top, w: t.width, h: t.height };
}

/**
 * Moves a rectangle out from under the given ones by as little as it can, within the view: a
 * focused label that would sit under a control shows beside it instead (WCAG 2.4.11).
 */
function clearOf(r: Rect, blocks: readonly Rect[], width: number, height: number, margin: number) {
  if (!overlaps(r, blocks)) return r;
  const within = (c: Rect) =>
    c.x >= margin && c.y >= margin && c.x + c.w <= width - margin && c.y + c.h <= height - margin;
  let best = r;
  let bestMove = Infinity;
  for (const q of blocks) {
    if (!overlaps(r, [q])) continue;
    for (const c of [
      { ...r, y: q.y - r.h - margin },
      { ...r, y: q.y + q.h + margin },
      { ...r, x: q.x - r.w - margin },
      { ...r, x: q.x + q.w + margin },
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

export class LabelLayer {
  private labels: Label[] = [];
  private readonly sizes = new Map<string, { w: number; h: number }>();
  private readonly lastKey = new Map<string, string>();
  private readonly projected = new Vector3();
  private readonly toCamera = new Vector3();
  private readonly camera: PerspectiveCamera;
  /** No-go rectangles in the label container's coordinates. */
  private readonly noGo: () => readonly Rect[];
  /** One leader line and anchor dot per label, drawn in an SVG under the labels. */
  private svg: SVGSVGElement | null = null;
  private readonly leaders = new Map<
    string,
    { group: SVGGElement; line: SVGLineElement; dot: SVGCircleElement }
  >();

  constructor(camera: PerspectiveCamera, noGo: () => readonly Rect[]) {
    this.camera = camera;
    this.noGo = noGo;
  }

  setLabels(labels: Label[]): void {
    this.labels = labels;
    this.buildLeaders();
    this.measure();
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

  /**
   * Places every label for the current camera. `bounds` is the part of the view a focused label
   * is pulled into, so the panel or sheet never covers it; it defaults to the whole view. At most
   * `maxVisible` labels show at once (a focused one always does), highest priority first.
   */
  update(
    width: number,
    height: number,
    bounds: Rect = { x: 0, y: 0, w: width, h: height },
    maxVisible = Infinity,
  ): void {
    // The controls first; each label placed joins them, so later ones keep clear of it.
    const placed: Rect[] = [...this.noGo()];
    const focused = document.activeElement;
    const items = this.labels
      .map((label) => {
        this.projected.copy(label.anchor).project(this.camera);
        const p = this.projected;
        const facingOk =
          !label.facing ||
          this.toCamera.copy(this.camera.position).sub(label.anchor).dot(label.facing) > 0;
        const x = (p.x * 0.5 + 0.5) * width;
        const y = (-p.y * 0.5 + 0.5) * height;
        const depth = p.z;
        // The leader's end, on the thing itself, when it differs from where the label sits.
        const q = label.point ? this.projected.copy(label.point).project(this.camera) : null;
        return {
          label,
          x,
          y,
          point: q ? { x: (q.x * 0.5 + 0.5) * width, y: (-q.y * 0.5 + 0.5) * height } : { x, y },
          depth,
          visible: !label.hidden && facingOk && depth > -1 && depth < 1,
          focused: !label.hidden && (label.highlight === true || label.element.contains(focused)),
        };
      })
      .sort(
        (a, b) =>
          Number(b.focused) - Number(a.focused) ||
          b.label.priority - a.label.priority ||
          a.depth - b.depth,
      );

    const margin = 4;
    const inside = (r: Rect) =>
      r.x >= margin && r.y >= margin && r.x + r.w <= width - margin && r.y + r.h <= height - margin;
    const clamp = (r: Rect): Rect => ({
      ...r,
      x: Math.min(Math.max(r.x, bounds.x + margin), bounds.x + bounds.w - margin - r.w),
      y: Math.min(Math.max(r.y, bounds.y + margin), bounds.y + bounds.h - margin - r.h),
    });

    // Near an edge, a label may slide inward along its row, up to a little over half its width,
    // so it stays readable and still sits by its anchor.
    const slide = (r: Rect): Rect | null => {
      const x = Math.min(Math.max(r.x, margin), width - margin - r.w);
      return Math.abs(x - r.x) <= r.w * 0.6 ? { ...r, x } : null;
    };

    let shown = 0;
    for (const it of items) {
      it.label.element.classList.toggle('lit', it.label.highlight === true && !it.label.hidden);
      const size = this.sizes.get(it.label.id) ?? { w: 120, h: 28 };
      // Labels sit a little above their point (or below it), with room for the leader between.
      const below = it.label.below === true;
      const full = {
        x: it.x - size.w / 2,
        y: below ? it.y + 14 : it.y - size.h - 14,
        w: size.w,
        h: size.h,
      };
      const slid = slide(full);
      const compact = { x: it.x - 15, y: below ? it.y + 12 : it.y - 42, w: 30, h: 30 };
      // A leader only when its point is in view: a label pulled in from off screen has none.
      const point = it.visible ? it.point : null;
      if (it.focused) {
        // A focused label is always shown, pulled into the free part of the view and out from
        // under the controls and any label shown before it (WCAG 2.4.11).
        const r = clearOf(clamp(full), placed, width, height, margin);
        placed.push(r);
        shown++;
        this.place(it.label, r, '', point);
        // Its definition may be open beside it; later labels keep clear of that too.
        const tip = openTip(it.label.element);
        if (tip) placed.push(tip);
      } else if (!it.visible) {
        this.place(it.label, full, 'off', null);
      } else if (it.label.quiet === true || shown >= maxVisible) {
        // Quiet, or over the cap: out of sight, but still in the tab order, so focusing it shows it.
        this.place(it.label, full, 'capped', null);
      } else if (slid && inside(slid) && !overlaps(slid, placed)) {
        placed.push(slid);
        shown++;
        this.place(it.label, slid, '', point);
      } else if (inside(compact) && !overlaps(compact, placed)) {
        placed.push(compact);
        shown++;
        this.place(it.label, compact, 'compact', point);
      } else {
        // No room beside the others: out of sight like a label over the cap, and like it, still
        // reachable by keyboard.
        this.place(it.label, full, 'capped', null);
      }
    }
  }

  private place(
    label: Label,
    r: Rect,
    state: '' | 'compact' | 'off' | 'capped',
    point: { x: number; y: number } | null,
  ): void {
    const { classList, style } = label.element;
    // A label being hidden fades out where it is, at its current size, rather than jumping first.
    const key =
      state === 'off' || state === 'capped'
        ? state
        : `${Math.round(r.x)},${Math.round(r.y)},${state},${point ? `${Math.round(point.x)},${Math.round(point.y)}` : '-'}`;
    if (this.lastKey.get(label.id) === key) return;
    this.lastKey.set(label.id, key);
    const showing = state === '' || state === 'compact';
    this.drawLeader(label.id, showing ? r : null, point);
    classList.toggle('off', state === 'off');
    classList.toggle('capped', state === 'capped');
    if (!showing) return;
    style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`;
    classList.toggle('compact', state === 'compact');
  }

  /**
   * A line from the label's nearest edge to its point, and a dot on the point. Hidden, it fades out
   * where it was, as its label does.
   */
  private drawLeader(id: string, r: Rect | null, point: { x: number; y: number } | null): void {
    const leader = this.leaders.get(id);
    if (!leader) return;
    const { group, line, dot } = leader;
    const covered =
      r && point && point.x > r.x && point.x < r.x + r.w && point.y > r.y && point.y < r.y + r.h;
    if (!r || !point || covered) {
      group.classList.add('off');
      return;
    }
    const pad = Math.min(12, r.w / 2);
    const fromX = Math.min(Math.max(point.x, r.x + pad), r.x + r.w - pad);
    const fromY = Math.min(Math.max(point.y, r.y), r.y + r.h);
    line.setAttribute('x1', fromX.toFixed(1));
    line.setAttribute('y1', fromY.toFixed(1));
    line.setAttribute('x2', point.x.toFixed(1));
    line.setAttribute('y2', point.y.toFixed(1));
    dot.setAttribute('cx', point.x.toFixed(1));
    dot.setAttribute('cy', point.y.toFixed(1));
    group.classList.remove('off');
  }
}
