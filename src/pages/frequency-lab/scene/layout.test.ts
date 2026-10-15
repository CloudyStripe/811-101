/**
 * The views, checked through the page's own camera: framed by LabCamera into a canvas whose free
 * area the chrome leaves, then projected to CSS pixels. What the lesson needs must land in it.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { LabCamera, type VisibleArea } from '../../../kit3d/camera.ts';
import { MUST_SEE, PHONE_VIEW, TALL_VIEW, WIDE_VIEW, viewFor } from './layout.ts';

/** The view's must-see points in canvas pixels, with the camera framed for this free area. */
function onCanvas(canvas: { width: number; height: number }, area: VisibleArea) {
  const camera = new PerspectiveCamera(34, canvas.width / canvas.height, 0.5, 900);
  const lab = new LabCamera(camera);
  lab.setLayout(canvas.width, canvas.height, area);
  const view = viewFor(area, canvas);
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
    heldBack: false,
  },
  {
    // So wide that the camera would come in close: it holds back and shows more town instead.
    name: 'desktop, guide closed',
    canvas: { width: 1440, height: 900 },
    area: { x: 0, y: 0, width: 1440, height: 900, portrait: false },
    heldBack: true,
  },
  {
    name: 'tablet, portrait',
    canvas: { width: 820, height: 1180 },
    area: { x: 0, y: 110, width: 820, height: 900, portrait: true },
    heldBack: false,
  },
  {
    name: 'phone, between header and sheet',
    canvas: { width: 390, height: 844 },
    area: { x: 0, y: 150, width: 390, height: 520 },
    heldBack: false,
  },
  {
    name: 'phone, landscape',
    canvas: { width: 844, height: 390 },
    area: { x: 300, y: 0, width: 544, height: 390 },
    heldBack: true,
  },
] as const;

describe('views', () => {
  it('picks the phone view on phones held upright, the tall view for portrait areas, else wide', () => {
    const phone = { width: 390, height: 664 };
    // In the browser, with its bars showing, a phone's free area is about square.
    expect(viewFor({ x: 0, y: 66, width: 390, height: 330 }, phone)).toBe(PHONE_VIEW);
    expect(viewFor({ x: 0, y: 66, width: 390, height: 520 }, { width: 390, height: 844 })).toBe(
      PHONE_VIEW,
    );
    // With the guide's sheet half open, the area left is clearly wider than tall.
    expect(viewFor({ x: 0, y: 66, width: 390, height: 248 }, phone)).toBe(WIDE_VIEW);
    // A tablet held upright, and the strip beside the controls on a phone held sideways.
    expect(viewFor({ x: 0, y: 0, width: 820, height: 900 }, { width: 820, height: 1180 })).toBe(
      TALL_VIEW,
    );
    expect(viewFor({ x: 330, y: 0, width: 311, height: 375 }, { width: 667, height: 375 })).toBe(
      TALL_VIEW,
    );
    const desktop = { width: 1440, height: 900 };
    expect(viewFor({ x: 0, y: 0, width: 1000, height: 900 }, desktop)).toBe(WIDE_VIEW);
    expect(viewFor({ x: 0, y: 0, width: 1000, height: 900, portrait: true }, desktop)).toBe(
      TALL_VIEW,
    );
    expect(PHONE_VIEW.fov).toBeGreaterThan(40);
  });

  it('every view shows the hookup and the far end of the line', () => {
    for (const view of [WIDE_VIEW, TALL_VIEW, PHONE_VIEW]) {
      for (const p of MUST_SEE) expect(view.mustSee).toContainEqual(p);
    }
  });

  it.each(CASES)('$name: everything the lesson needs lands in the free area', (c) => {
    for (const q of onCanvas(c.canvas, c.area)) {
      const at = `${q.p.join(',')} at ${q.x.toFixed(0)},${q.y.toFixed(0)}`;
      expect(q.inFront, `${at} in front`).toBe(true);
      expect(q.x, at).toBeGreaterThanOrEqual(c.area.x - 0.5);
      expect(q.x, at).toBeLessThanOrEqual(c.area.x + c.area.width + 0.5);
      expect(q.y, at).toBeGreaterThanOrEqual(c.area.y - 0.5);
      expect(q.y, at).toBeLessThanOrEqual(c.area.y + c.area.height + 0.5);
    }
  });

  it.each(CASES)('$name: the view is centered, and as close as it may come', (c) => {
    const points = onCanvas(c.canvas, c.area);
    const xs = points.map((q) => q.x);
    const ys = points.map((q) => q.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    expect(Math.abs((x0 + x1) / 2 - (c.area.x + c.area.width / 2))).toBeLessThan(4);
    expect(Math.abs((y0 + y1) / 2 - (c.area.y + c.area.height / 2))).toBeLessThan(4);
    // Room at the sides: the view's margin, and at least half a label's width (48 px), so a label
    // on a point near either side still fits beside it.
    const margin = viewFor(c.area, c.canvas).margin ?? 0.08;
    const roomX = Math.max((margin * c.area.width) / 2, 48);
    const roomY = (margin * c.area.height) / 2;
    expect(x0 - c.area.x, 'room on the left').toBeGreaterThanOrEqual(roomX - 1);
    expect(c.area.x + c.area.width - x1, 'room on the right').toBeGreaterThanOrEqual(roomX - 1);
    expect(y0 - c.area.y, 'room above').toBeGreaterThanOrEqual(roomY - 1);
    expect(c.area.y + c.area.height - y1, 'room below').toBeGreaterThanOrEqual(roomY - 1);
    // As close as that room allows, across or up and down, unless the view holds back.
    const reach = Math.max(
      (x1 - x0) / (c.area.width - 2 * roomX),
      (y1 - y0) / (c.area.height - 2 * roomY),
    );
    if (c.heldBack) {
      expect(reach).toBeLessThan(0.98);
      expect(reach).toBeGreaterThan(0.6);
    } else {
      expect(reach).toBeGreaterThan(0.99);
    }
  });
});
