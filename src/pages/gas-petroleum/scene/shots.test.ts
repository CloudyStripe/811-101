/**
 * The diorama's shots, checked through the page's own camera: framed by LabCamera into the room the
 * guide and the dock leave, then projected to CSS pixels. What each shot must show lands in that
 * room and out from under the controls, for every stop, and for the overview however it's turned;
 * and every stop is seen from closer in than the overview.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { LabCamera, type View, type VisibleArea } from '../../../kit3d/camera.ts';
import { TURN_LIMIT, clampYaw, overviewPoints, overviewView, stopView } from './shots.ts';
import { buildStops } from './stops/index.ts';

const models = buildStops({ current: null });

/** The dock in the bottom left corner, on desktop. */
const DOCK = { x: 16, y: 776, width: 363, height: 108 };

/** The room the page measures for the view at desktop and phone sizes, in CSS pixels. */
const LAYOUTS: { name: string; canvas: { width: number; height: number }; area: VisibleArea }[] = [
  {
    // Below the header and left of the guide, clear of the dock.
    name: 'desktop, guide open',
    canvas: { width: 1440, height: 900 },
    area: { x: 0, y: 58, width: 1032, height: 842, keepOut: [DOCK] },
  },
  {
    // The whole width, clear of the dock and the closed guide's title bar.
    name: 'desktop, guide closed',
    canvas: { width: 1440, height: 900 },
    area: {
      x: 0,
      y: 58,
      width: 1440,
      height: 842,
      keepOut: [DOCK, { x: 1120, y: 66, width: 304, height: 54 }],
    },
  },
  {
    // Between the header and the sheet's bar.
    name: 'phone',
    canvas: { width: 390, height: 844 },
    area: { x: 0, y: 58, width: 390, height: 595 },
  },
  {
    // Between the header and the open sheet.
    name: 'phone, sheet open',
    canvas: { width: 390, height: 844 },
    area: { x: 0, y: 58, width: 390, height: 265 },
  },
];

/** The camera, framed for this view in this room. */
function framedFor(view: View, canvas: { width: number; height: number }, area: VisibleArea) {
  const camera = new PerspectiveCamera(34, canvas.width / canvas.height, 0.5, 3000);
  const lab = new LabCamera(camera);
  lab.setLayout(canvas.width, canvas.height, area);
  lab.frame(view);
  return camera;
}

/** How far the camera stands from what it looks at. */
const distanceFor = (view: View, layout: (typeof LAYOUTS)[number]) =>
  framedFor(view, layout.canvas, layout.area).position.distanceTo(new Vector3(...view.target));

/** The view's must-see points in canvas pixels, with the camera framed for this room. */
function onCanvas(view: View, canvas: { width: number; height: number }, area: VisibleArea) {
  const camera = framedFor(view, canvas, area);
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

function expectFramed(view: View, layout: (typeof LAYOUTS)[number]) {
  const { area } = layout;
  for (const q of onCanvas(view, layout.canvas, area)) {
    const at = `${q.p.map((n) => n.toFixed(1)).join(',')} at ${q.x.toFixed(0)},${q.y.toFixed(0)}`;
    expect(q.inFront, `${at} in front`).toBe(true);
    expect(q.x, at).toBeGreaterThanOrEqual(area.x - 0.5);
    expect(q.x, at).toBeLessThanOrEqual(area.x + area.width + 0.5);
    expect(q.y, at).toBeGreaterThanOrEqual(area.y - 0.5);
    expect(q.y, at).toBeLessThanOrEqual(area.y + area.height + 0.5);
    for (const k of area.keepOut ?? []) {
      const under = q.x > k.x && q.x < k.x + k.width && q.y > k.y && q.y < k.y + k.height;
      expect(under, `${at} under the controls`).toBe(false);
    }
  }
}

describe('stop shots', () => {
  const overview = overviewView(overviewPoints(models), 0);
  for (const layout of LAYOUTS) {
    it.each(models.map((m) => [m.id, m] as const))(
      `${layout.name}: %s shows all it must, clear of the controls, from closer than the overview`,
      (_id, model) => {
        const view = stopView(model);
        expectFramed(view, layout);
        expect(distanceFor(view, layout)).toBeLessThan(distanceFor(overview, layout) * 0.8);
      },
    );
  }
});

describe('the overview', () => {
  const points = overviewPoints(models);

  it('turns only within its bounds', () => {
    expect(clampYaw(9)).toBe(TURN_LIMIT);
    expect(clampYaw(-9)).toBe(-TURN_LIMIT);
    expect(clampYaw(0.1)).toBe(0.1);
  });

  for (const layout of LAYOUTS) {
    it.each([-TURN_LIMIT, 0, TURN_LIMIT])(
      `${layout.name}: turned by %f, shows the whole model`,
      (yaw) => {
        expectFramed(overviewView(points, yaw), layout);
      },
    );
  }
});
