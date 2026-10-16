/**
 * The lab's layout at every depth it's drawn at, and its views, checked through the page's own
 * camera: framed by LabCamera into a canvas whose free area the chrome leaves, then projected to
 * CSS pixels. What the lesson needs must land in it.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { LabCamera, type VisibleArea } from '../../../kit3d/camera.ts';
import { SURFACE, labLayout, tallView, viewFor, wideView, type LabLayout } from './layout.ts';

const DEPTHS = [1, 3, 5] as const;

describe.each(DEPTHS)('the layout at %i× depth', (depth) => {
  const layout = labLayout({ depth });
  const { block, strata, lines, trench, hookup } = layout;

  it('stacks the strata from the ground down to the slab bottom, with no gaps', () => {
    expect(strata[0]?.top).toBe(0);
    expect(strata.at(-1)?.bottom).toBe(block.bottom);
    strata.forEach((s, i) => {
      expect(s.bottom).toBeLessThan(s.top);
      if (i > 0) expect(s.top).toBe(strata[i - 1]?.bottom);
    });
    expect(block.bottom).toBeCloseTo(-10 * depth);
  });

  it('draws the lines as many times thicker and deeper as the ground', () => {
    const real = labLayout({ depth: 1 }).lines;
    for (const name of ['steel', 'plastic', 'tracer', 'telecom'] as const) {
      expect(lines[name].radius).toBeCloseTo(real[name].radius * depth);
      expect(lines[name].y).toBeCloseTo(real[name].y * depth);
    }
    expect(lines.water.radius).toBeCloseTo(real.water.radius * depth);
  });

  it('keeps every line buried and clear of the others, in its true order', () => {
    const gap = (upper: { y: number; radius: number }, lower: { y: number; radius: number }) =>
      upper.y - upper.radius - (lower.y + lower.radius);
    // Telecom over the gas main, both over the water main; the tracer rides on the plastic main.
    expect(gap(lines.telecom, lines.steel)).toBeGreaterThan(0);
    expect(gap(lines.steel, lines.water)).toBeGreaterThan(0);
    expect(gap(lines.tracer, lines.plastic)).toBeGreaterThanOrEqual(0);
    expect(gap(lines.tracer, lines.plastic)).toBeLessThan(0.1 * depth);
    for (const line of [lines.telecom, lines.steel, lines.plastic, lines.water]) {
      expect(line.y + line.radius).toBeLessThan(0);
      expect(line.y - line.radius).toBeGreaterThan(block.bottom);
    }
  });

  it('lays the gas main in its trench, with fill all round it', () => {
    expect(lines.steel.y - lines.steel.radius).toBeGreaterThan(trench.bottom);
    expect(-trench.zBack).toBeGreaterThan(lines.steel.radius * 1.5);
    expect(lines.telecom.y - lines.telecom.radius).toBeGreaterThan(trench.bottom);
  });

  it('drives the ground stake into the ground, clear of every line', () => {
    expect(hookup.stake.tip).toBeLessThan(0);
    expect(hookup.stake.x).toBeLessThan(lines.telecom.x0);
    expect(hookup.stake.x).toBeLessThan(lines.steel.x0);
  });

  it('keeps everything above ground at true size', () => {
    const real = labLayout({ depth: 1 });
    expect(layout.hookup.transmitter).toEqual(real.hookup.transmitter);
    expect(layout.leads).toEqual(real.leads);
    expect(layout.trees).toEqual(real.trees);
  });

  it('sets every shrub whole on the far lawn, none hanging off the slab', () => {
    for (const shrub of layout.shrubs) {
      expect(shrub.z - shrub.size / 2).toBeGreaterThan(block.z0);
      expect(shrub.z + shrub.size / 2).toBeLessThan(SURFACE.sidewalkBack);
    }
  });

  it('keeps the scenery small: trees well under the cut face, on the far lawn', () => {
    for (const tree of layout.trees) {
      expect(tree.height).toBeLessThan(15);
      expect(tree.z).toBeLessThan(-34);
      expect(tree.z).toBeGreaterThan(block.z0);
    }
  });
});

/** The view's must-see points in canvas pixels, with the camera framed for this free area. */
function onCanvas(layout: LabLayout, canvas: { width: number; height: number }, area: VisibleArea) {
  const camera = new PerspectiveCamera(34, canvas.width / canvas.height, 0.5, 900);
  const lab = new LabCamera(camera);
  lab.setLayout(canvas.width, canvas.height, area);
  const view = viewFor(layout, area, canvas);
  lab.frame(view);
  return view.mustSee.map((p) => {
    const v = new Vector3(...p).project(camera);
    return {
      p,
      x: ((v.x + 1) / 2) * canvas.width,
      y: ((1 - v.y) / 2) * canvas.height,
      inFront: v.z > -1 && v.z < 1,
    };
  });
}

const CASES = [
  {
    name: 'desktop, guide open',
    canvas: { width: 1440, height: 900 },
    area: { x: 0, y: 0, width: 1000, height: 900, portrait: false },
  },
  {
    name: 'desktop, guide closed',
    canvas: { width: 1440, height: 900 },
    area: { x: 0, y: 0, width: 1440, height: 900, portrait: false },
  },
  {
    name: 'tablet, portrait',
    canvas: { width: 820, height: 1180 },
    area: { x: 0, y: 110, width: 820, height: 900, portrait: true },
  },
  {
    name: 'phone, between header and sheet',
    canvas: { width: 390, height: 844 },
    area: { x: 0, y: 150, width: 390, height: 520 },
  },
  {
    name: 'phone, landscape',
    canvas: { width: 844, height: 390 },
    area: { x: 300, y: 0, width: 544, height: 390 },
  },
] as const;

describe('views', () => {
  const layout = labLayout({ depth: 3 });

  it('picks the tall view on screens held upright, else the wide one, unless the area asks', () => {
    const wide = wideView(layout);
    const tall = tallView(layout);
    const desktop = { width: 1440, height: 900 };
    const phone = { width: 390, height: 844 };
    expect(viewFor(layout, { x: 0, y: 0, width: 1000, height: 900 }, desktop)).toEqual(wide);
    // On a phone held upright, whatever strip the controls leave.
    expect(viewFor(layout, { x: 0, y: 66, width: 390, height: 520 }, phone)).toEqual(tall);
    expect(viewFor(layout, { x: 0, y: 66, width: 390, height: 248 }, phone)).toEqual(tall);
    expect(
      viewFor(layout, { x: 0, y: 0, width: 820, height: 900 }, { width: 820, height: 1180 }),
    ).toEqual(tall);
    // About square, or held sideways, goes wide; a portrait area asks for the tall view.
    expect(
      viewFor(layout, { x: 0, y: 0, width: 600, height: 620 }, { width: 600, height: 620 }),
    ).toEqual(wide);
    expect(
      viewFor(layout, { x: 300, y: 0, width: 544, height: 390 }, { width: 844, height: 390 }),
    ).toEqual(wide);
    // Beside the controls on a small phone held sideways, the free area is taller than wide.
    expect(
      viewFor(layout, { x: 330, y: 0, width: 311, height: 375 }, { width: 667, height: 375 }),
    ).toEqual(tall);
    expect(
      viewFor(layout, { x: 0, y: 0, width: 400, height: 900, portrait: true }, desktop),
    ).toEqual(tall);
  });

  it('shows the whole slab, the trees on it, and the hookup in every view', () => {
    for (const view of [wideView(layout), tallView(layout)]) {
      expect(view.mustSee).toEqual(layout.mustSee);
      const xs = view.mustSee.map((p) => p[0]);
      expect(Math.min(...xs)).toBeLessThanOrEqual(layout.block.x0);
      expect(Math.max(...xs)).toBeGreaterThanOrEqual(layout.block.x1);
      expect(Math.min(...view.mustSee.map((p) => p[1]))).toBeLessThanOrEqual(layout.block.bottom);
    }
  });

  it.each(CASES)('$name: everything the lesson needs lands in the free area', (c) => {
    for (const q of onCanvas(layout, c.canvas, c.area)) {
      const at = `${q.p.join(',')} at ${q.x.toFixed(0)},${q.y.toFixed(0)}`;
      expect(q.inFront, `${at} in front`).toBe(true);
      expect(q.x, at).toBeGreaterThanOrEqual(c.area.x - 0.5);
      expect(q.x, at).toBeLessThanOrEqual(c.area.x + c.area.width + 0.5);
      expect(q.y, at).toBeGreaterThanOrEqual(c.area.y - 0.5);
      expect(q.y, at).toBeLessThanOrEqual(c.area.y + c.area.height + 0.5);
    }
  });

  it.each(CASES)('$name: the view is centered, and as close as it may come', (c) => {
    const points = onCanvas(layout, c.canvas, c.area);
    const xs = points.map((q) => q.x);
    const ys = points.map((q) => q.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    expect(Math.abs((x0 + x1) / 2 - (c.area.x + c.area.width / 2))).toBeLessThan(4);
    expect(Math.abs((y0 + y1) / 2 - (c.area.y + c.area.height / 2))).toBeLessThan(4);
    const view = viewFor(layout, c.area, c.canvas);
    const margin = view.margin ?? 0.08;
    const roomX = Math.max((margin * c.area.width) / 2, view.labelRoom ?? 0);
    const roomY = (margin * c.area.height) / 2;
    expect(x0 - c.area.x, 'room on the left').toBeGreaterThanOrEqual(roomX - 1);
    expect(c.area.x + c.area.width - x1, 'room on the right').toBeGreaterThanOrEqual(roomX - 1);
    expect(y0 - c.area.y, 'room above').toBeGreaterThanOrEqual(roomY - 1);
    expect(c.area.y + c.area.height - y1, 'room below').toBeGreaterThanOrEqual(roomY - 1);
    // As close as that room allows, across or up and down.
    const reach = Math.max(
      (x1 - x0) / (c.area.width - 2 * roomX),
      (y1 - y0) / (c.area.height - 2 * roomY),
    );
    expect(reach).toBeGreaterThan(0.99);
  });
});
