/**
 * HTML labels that follow points in the 3D scene. Ported from the diorama's layout: the focused
 * and highest-priority labels go first, nearer labels before farther ones; a crowded label shrinks
 * to its icon, then hides. The panel, sheet and toolbars are no-go zones, and a focused label is
 * always placed so it's never hidden (WCAG 2.4.11). A thin leader line ties each shown label to
 * the point it names, and only so many show at once, so the scene stays the hero.
 */
import { Vector3, type PerspectiveCamera } from 'three';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface Label {
  readonly id: string;
  readonly element: HTMLElement;
  anchor: Vector3;
  /** Higher goes first. */
  priority: number;
  /** When set, the label shows only while the camera is on this side of the anchor. */
  facing?: Vector3;
  hidden?: boolean;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (r: Rect, list: readonly Rect[]) =>
  list.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);

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
  private readonly leaders = new Map<string, { line: SVGLineElement; dot: SVGCircleElement }>();

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
      const line = document.createElementNS(SVG_NS, 'line');
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('r', '2.5');
      line.style.display = dot.style.display = 'none';
      this.svg.append(line, dot);
      this.leaders.set(label.id, { line, dot });
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
    const placed: Rect[] = [...this.noGo()];
    const focused = document.activeElement;
    const items = this.labels
      .map((label) => {
        this.projected.copy(label.anchor).project(this.camera);
        const p = this.projected;
        const facingOk =
          !label.facing ||
          this.toCamera.copy(this.camera.position).sub(label.anchor).dot(label.facing) > 0;
        return {
          label,
          x: (p.x * 0.5 + 0.5) * width,
          y: (-p.y * 0.5 + 0.5) * height,
          depth: p.z,
          visible: !label.hidden && facingOk && p.z > -1 && p.z < 1,
          focused: !label.hidden && label.element.contains(focused),
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
      const size = this.sizes.get(it.label.id) ?? { w: 120, h: 28 };
      // Labels sit a little above their point, with room for the leader line between.
      const full = { x: it.x - size.w / 2, y: it.y - size.h - 14, w: size.w, h: size.h };
      const slid = slide(full);
      const compact = { x: it.x - 15, y: it.y - 42, w: 30, h: 30 };
      const anchor = { x: it.x, y: it.y };
      if (it.focused) {
        // A focused label is always shown, pulled into the free part of the view (WCAG 2.4.11).
        const r = clamp(full);
        placed.push(r);
        shown++;
        this.place(it.label, r, '', anchor);
      } else if (!it.visible || shown >= maxVisible) {
        this.place(it.label, full, 'off', anchor);
      } else if (slid && inside(slid) && !overlaps(slid, placed)) {
        placed.push(slid);
        shown++;
        this.place(it.label, slid, '', anchor);
      } else if (inside(compact) && !overlaps(compact, placed)) {
        placed.push(compact);
        shown++;
        this.place(it.label, compact, 'compact', anchor);
      } else {
        this.place(it.label, compact, 'off', anchor);
      }
    }
  }

  private place(
    label: Label,
    r: Rect,
    state: '' | 'compact' | 'off',
    anchor: { x: number; y: number },
  ): void {
    const { classList, style } = label.element;
    // A label being hidden fades out where it is, at its current size, rather than jumping first.
    const key =
      state === 'off'
        ? 'off'
        : `${Math.round(r.x)},${Math.round(r.y)},${state},${Math.round(anchor.x)},${Math.round(anchor.y)}`;
    if (this.lastKey.get(label.id) === key) return;
    this.lastKey.set(label.id, key);
    this.drawLeader(label.id, state === 'off' ? null : r, anchor);
    if (state === 'off') {
      classList.add('off');
      return;
    }
    style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`;
    classList.toggle('compact', state === 'compact');
    classList.remove('off');
  }

  /** A line from the label's nearest edge to its point, and a dot on the point; none when hidden. */
  private drawLeader(id: string, r: Rect | null, anchor: { x: number; y: number }): void {
    const leader = this.leaders.get(id);
    if (!leader) return;
    const { line, dot } = leader;
    const inside =
      r && anchor.x > r.x && anchor.x < r.x + r.w && anchor.y > r.y && anchor.y < r.y + r.h;
    if (!r || inside) {
      line.style.display = dot.style.display = 'none';
      return;
    }
    const pad = Math.min(12, r.w / 2);
    const fromX = Math.min(Math.max(anchor.x, r.x + pad), r.x + r.w - pad);
    const fromY = Math.min(Math.max(anchor.y, r.y), r.y + r.h);
    line.setAttribute('x1', fromX.toFixed(1));
    line.setAttribute('y1', fromY.toFixed(1));
    line.setAttribute('x2', anchor.x.toFixed(1));
    line.setAttribute('y2', anchor.y.toFixed(1));
    dot.setAttribute('cx', anchor.x.toFixed(1));
    dot.setAttribute('cy', anchor.y.toFixed(1));
    line.style.display = dot.style.display = '';
  }
}
