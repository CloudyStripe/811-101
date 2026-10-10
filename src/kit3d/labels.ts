/**
 * HTML labels that follow points in the 3D scene. Ported from the diorama's layout: the focused
 * and highest-priority labels go first, nearer labels before farther ones; a crowded label shrinks
 * to its icon, then hides. The panel, sheet and toolbars are no-go zones, and a focused label is
 * always placed so it's never hidden (WCAG 2.4.11).
 */
import { Vector3, type PerspectiveCamera } from 'three';

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

  constructor(camera: PerspectiveCamera, noGo: () => readonly Rect[]) {
    this.camera = camera;
    this.noGo = noGo;
  }

  setLabels(labels: Label[]): void {
    this.labels = labels;
    this.measure();
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
   * is pulled into, so the panel or sheet never covers it; it defaults to the whole view.
   */
  update(width: number, height: number, bounds: Rect = { x: 0, y: 0, w: width, h: height }): void {
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

    for (const it of items) {
      const size = this.sizes.get(it.label.id) ?? { w: 120, h: 28 };
      const full = { x: it.x - size.w / 2, y: it.y - size.h - 6, w: size.w, h: size.h };
      const compact = { x: it.x - 15, y: it.y - 36, w: 30, h: 30 };
      if (it.focused) {
        // A focused label is always shown, pulled into the free part of the view (WCAG 2.4.11).
        const r = clamp(full);
        placed.push(r);
        this.place(it.label, r, '');
      } else if (!it.visible) {
        this.place(it.label, full, 'off');
      } else if (inside(full) && !overlaps(full, placed)) {
        placed.push(full);
        this.place(it.label, full, '');
      } else if (inside(compact) && !overlaps(compact, placed)) {
        placed.push(compact);
        this.place(it.label, compact, 'compact');
      } else {
        this.place(it.label, compact, 'off');
      }
    }
  }

  private place(label: Label, r: Rect, state: '' | 'compact' | 'off'): void {
    const { classList, style } = label.element;
    // A label being hidden fades out where it is, at its current size, rather than jumping first.
    const key = state === 'off' ? 'off' : `${Math.round(r.x)},${Math.round(r.y)},${state}`;
    if (this.lastKey.get(label.id) === key) return;
    this.lastKey.set(label.id, key);
    if (state === 'off') {
      classList.add('off');
      return;
    }
    style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`;
    classList.toggle('compact', state === 'compact');
    classList.remove('off');
  }
}
