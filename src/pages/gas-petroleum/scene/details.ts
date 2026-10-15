/**
 * The small labels on an open stop's parts ("Gas", "Cap rock (the lid)", "LNG ship"), and the
 * time-lapse's clock. They repeat what the panel says, for the eye, so they're hidden from
 * assistive tech. Each follows its point on screen, and hides when its point is behind the
 * camera, on the far side of the face it's drawn on, or under the controls.
 */
import { Vector3, type PerspectiveCamera } from 'three';
import { DETAILS, type StopId } from '../../../../content/utilities/gas-petroleum.ts';
import type { DetailSpec, StopModel } from './stop.ts';

interface Item {
  stop: StopId | null;
  spec: DetailSpec;
  element: HTMLElement;
  text: HTMLElement;
  key: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (r: Rect, list: readonly Rect[]) =>
  list.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);

export class DetailLayer {
  private readonly items: Item[] = [];
  private readonly clock: Item;
  private readonly v = new Vector3();
  private readonly toCamera = new Vector3();
  private readonly facing = new Vector3();

  constructor(
    container: HTMLElement,
    stops: readonly StopModel[],
    clockAt: readonly [number, number, number],
  ) {
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
    return { stop, spec, element, text: span, key: '' };
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
    const placed: Rect[] = [...noGo];
    for (const item of [this.clock, ...this.items]) {
      const wanted = item === this.clock ? clockShown : item.stop === open && open !== null;
      if (!wanted) {
        this.set(item, 'off', 0, 0);
        continue;
      }
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
      const x = (this.v.x * 0.5 + 0.5) * width;
      const y = (-this.v.y * 0.5 + 0.5) * height;
      const inFront = this.v.z > -1 && this.v.z < 1;
      const w = item.element.offsetWidth || 80;
      const h = item.element.offsetHeight || 22;
      const r = { x: x - w / 2, y: y - h / 2, w, h };
      const inside = r.x >= 2 && r.y >= 2 && r.x + w <= width - 2 && r.y + h <= height - 2;
      if (!facingOk || !inFront || !inside || overlaps(r, placed)) {
        this.set(item, 'off', r.x, r.y);
        continue;
      }
      placed.push(r);
      this.set(item, '', r.x, r.y);
    }
  }

  private set(item: Item, state: '' | 'off', x: number, y: number) {
    const key = state === 'off' ? 'off' : `${String(Math.round(x))},${String(Math.round(y))}`;
    if (item.key === key) return;
    item.key = key;
    item.element.classList.toggle('off', state === 'off');
    if (state === '')
      item.element.style.transform = `translate(${String(Math.round(x))}px, ${String(Math.round(y))}px)`;
  }

  dispose() {
    for (const item of [this.clock, ...this.items]) item.element.remove();
  }
}
