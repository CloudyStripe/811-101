/**
 * The small labels on an open stop's parts ("Gas", "Cap rock (the lid)", "LNG ship"), and the
 * time-lapse's clock. They repeat what the panel says, for the eye, so they're hidden from
 * assistive tech. Each sits beside its point, on a short leader to a dot on it, so no label covers
 * a part that's named: above it where there's room, else beside or below it, clear of the controls,
 * the stops' labels and each other. It hides when its point is behind the camera, on the far side
 * of the face it's drawn on, or where there's no room. The clock sits on its own point. The
 * reader can hide the parts' labels, as the lab's labels hide; the clock shows all the same.
 */
import { Vector3, type PerspectiveCamera } from 'three';
import { DETAILS, type StopId } from '../../../../content/utilities/gas-petroleum.ts';
import { EDGE, leaderStart } from '../../../kit3d/placement.ts';
import type { DetailSpec, StopModel } from './stop.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** How far a label stands off its point, in CSS pixels. */
const GAP = 12;
/** The room kept clear round every named point, in CSS pixels, so each part shows. */
const POINT = 10;

interface Leader {
  group: SVGGElement;
  line: SVGLineElement;
  dot: SVGCircleElement;
}

interface Item {
  stop: StopId | null;
  spec: DetailSpec;
  element: HTMLElement;
  text: HTMLElement;
  key: string;
  /** Its leader to its point; none for the clock. */
  leader: Leader | null;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (r: Rect, list: readonly Rect[]) =>
  list.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);

/** Where a label may sit by its point, in turn: above, above to either side, beside, below. */
function spots(x: number, y: number, w: number, h: number): Rect[] {
  const above = y - GAP - h;
  return [
    { x: x - w / 2, y: above, w, h },
    { x: x + GAP / 2, y: above, w, h },
    { x: x - GAP / 2 - w, y: above, w, h },
    { x: x + GAP, y: y - h / 2, w, h },
    { x: x - GAP - w, y: y - h / 2, w, h },
    { x: x - w / 2, y: y + GAP, w, h },
  ];
}

export class DetailLayer {
  private readonly items: Item[] = [];
  private readonly clock: Item;
  /** Whether the parts' labels show; the clock's doesn't hang on it. */
  private partsShown = true;
  /** The leaders, in an SVG under the labels. */
  private readonly svg: SVGSVGElement;
  private readonly v = new Vector3();
  private readonly toCamera = new Vector3();
  private readonly facing = new Vector3();

  constructor(
    container: HTMLElement,
    stops: readonly StopModel[],
    clockAt: readonly [number, number, number],
  ) {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.classList.add('lbl-leaders');
    this.svg.setAttribute('aria-hidden', 'true');
    container.prepend(this.svg);
    for (const stop of stops) {
      const texts = DETAILS[stop.id] as Readonly<Record<string, { text: string }>>;
      for (const spec of stop.details) {
        const text = texts[spec.key]?.text;
        if (!text) continue;
        this.items.push(this.create(container, stop.id, spec, text));
      }
    }
    this.clock = this.create(container, null, { key: 'clock', at: clockAt }, '');
    this.clock.element.classList.add('dlbl-clock');
    this.clock.leader?.group.remove();
    this.clock.leader = null;
  }

  private create(
    container: HTMLElement,
    stop: StopId | null,
    spec: DetailSpec,
    text: string,
  ): Item {
    const element = document.createElement('div');
    element.className = 'dlbl off';
    element.setAttribute('aria-hidden', 'true');
    if (spec.swatch) {
      const swatch = document.createElement('span');
      swatch.className = 'dlbl-swatch';
      swatch.style.background = spec.swatch;
      element.append(swatch);
    }
    const span = document.createElement('span');
    span.textContent = text;
    element.append(span);
    container.append(element);
    const group = document.createElementNS(SVG_NS, 'g');
    const line = document.createElementNS(SVG_NS, 'line');
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '2.5');
    group.classList.add('off');
    group.append(line, dot);
    this.svg.append(group);
    return { stop, spec, element, text: span, key: '', leader: { group, line, dot } };
  }

  /** Shows or hides the parts' labels, from the next update on. */
  setPartsShown(shown: boolean) {
    this.partsShown = shown;
  }

  /** The clock's words while the time-lapse plays; null hides it. */
  setClock(text: string | null) {
    this.clock.text.textContent = text ?? '';
    this.clock.stop = text === null ? null : 'formation';
    this.clock.key = '';
  }

  /** Places every label for the camera, showing those of the open stop that fit. */
  update(
    camera: PerspectiveCamera,
    width: number,
    height: number,
    open: StopId | null,
    noGo: readonly Rect[],
    clockShown: boolean,
  ) {
    // Where each wanted label's point lands, if it's in view and facing the camera.
    const points = new Map<Item, { x: number; y: number }>();
    for (const item of [this.clock, ...this.items]) {
      const wanted =
        item === this.clock ? clockShown : this.partsShown && item.stop === open && open !== null;
      if (!wanted) continue;
      const { spec } = item;
      this.v.set(...spec.at);
      if (spec.follow) spec.follow.localToWorld(this.v);
      const facingOk =
        !spec.facing ||
        this.toCamera
          .copy(camera.position)
          .sub(this.v)
          .dot(this.facing.set(...spec.facing)) > 0;
      this.v.project(camera);
      if (!facingOk || this.v.z <= -1 || this.v.z >= 1) continue;
      points.set(item, { x: (this.v.x * 0.5 + 0.5) * width, y: (-this.v.y * 0.5 + 0.5) * height });
    }
    // No label covers a named point, so every part named shows.
    const named = [...points]
      .filter(([item]) => item !== this.clock)
      .map(([, p]) => ({ x: p.x - POINT / 2, y: p.y - POINT / 2, w: POINT, h: POINT }));
    const placed: Rect[] = [...noGo];
    // A gutter from the view's edges, as every label in the view keeps.
    const inside = (r: Rect) =>
      r.x >= EDGE && r.y >= EDGE && r.x + r.w <= width - EDGE && r.y + r.h <= height - EDGE;
    for (const item of [this.clock, ...this.items]) {
      const p = points.get(item);
      if (!p) {
        this.set(item, null, null);
        continue;
      }
      const w = item.element.offsetWidth || 80;
      const h = item.element.offsetHeight || 22;
      const tries =
        item === this.clock ? [{ x: p.x - w / 2, y: p.y - h / 2, w, h }] : spots(p.x, p.y, w, h);
      const r = tries.find((t) => inside(t) && !overlaps(t, placed) && !overlaps(t, named));
      if (!r) {
        this.set(item, null, null);
        continue;
      }
      placed.push(r);
      this.set(item, r, p);
    }
  }

  /** Shows a label at `r`, its leader to its point `p`; with no room, it fades out where it is. */
  private set(item: Item, r: Rect | null, p: { x: number; y: number } | null) {
    const key = r && p ? [r.x, r.y, p.x, p.y].map((n) => Math.round(n)).join(',') : 'off';
    if (item.key === key) return;
    item.key = key;
    item.element.classList.toggle('off', !r);
    const { leader } = item;
    const from = r && p ? leaderStart(r, p) : null;
    if (leader) {
      leader.group.classList.toggle('off', !from);
      if (from && p) {
        leader.line.setAttribute('x1', from.x.toFixed(1));
        leader.line.setAttribute('y1', from.y.toFixed(1));
        leader.line.setAttribute('x2', p.x.toFixed(1));
        leader.line.setAttribute('y2', p.y.toFixed(1));
        leader.dot.setAttribute('cx', p.x.toFixed(1));
        leader.dot.setAttribute('cy', p.y.toFixed(1));
      }
    }
    if (r) {
      item.element.style.transform = `translate(${String(Math.round(r.x))}px, ${String(Math.round(r.y))}px)`;
    }
  }

  dispose() {
    for (const item of [this.clock, ...this.items]) item.element.remove();
    this.svg.remove();
  }
}
