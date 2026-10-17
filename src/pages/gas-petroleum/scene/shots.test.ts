/**
 * The diorama's shots and the camera's limits, checked through the page's own camera: framed by
 * LabCamera into the room the guide, the dock and the camera's buttons leave, then projected to CSS
 * pixels. What each shot must show lands in that room and out from under the controls. Every stop's
 * subject sits at the middle of the room and fills it, as the biggest thing in view, near enough
 * for the ground's whole night grade, which the overview never gets. The phone's overview fills its
 * width. However the reader moves it, the camera stays above the grass.
 */
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { LabCamera, type View, type VisibleArea } from '../../../kit3d/camera.ts';
import { fitLimits } from '../../../kit3d/fit.ts';
import {
  CLEARANCE,
  ORBIT,
  ORBIT_STEP,
  nearestAt,
  nightGradeAt,
  orbitBounds,
  overviewPoints,
  overviewView,
  stopAim,
  stopShot,
} from './shots.ts';
import type { StopModel } from './stop.ts';
import { buildStops } from './stops/index.ts';

const models = buildStops({ current: null });

/**
 * The room the page measures for the view at a stop, in CSS pixels: below the header, beside the
 * guide or the dock, and above the camera's buttons, as measured in the page.
 */
const LAYOUTS: { name: string; canvas: { width: number; height: number }; area: VisibleArea }[] = [
  {
    // Left of the guide, above the row of the dock and the camera's buttons.
    name: 'desktop, guide open',
    canvas: { width: 1440, height: 900 },
    area: { x: 0, y: 58, width: 1032, height: 692 },
  },
  {
    // The whole width, above that row, clear of the closed guide's title bar.
    name: 'desktop, guide closed',
    canvas: { width: 1440, height: 900 },
    area: {
      x: 0,
      y: 58,
      width: 1440,
      height: 692,
      keepOut: [{ x: 997, y: 66, width: 427, height: 54 }],
    },
  },
  {
    // Between the header and the camera's buttons, over the sheet's bar.
    name: 'phone',
    canvas: { width: 390, height: 844 },
    area: { x: 0, y: 58, width: 390, height: 546 },
  },
  {
    // Held sideways: the column beside the guide and the dock, below the header and above the
    // buttons.
    name: 'phone held sideways',
    canvas: { width: 667, height: 375 },
    area: { x: 356, y: 58, width: 311, height: 259 },
  },
  {
    // Between the header and the buttons over the open sheet.
    name: 'phone, sheet open',
    canvas: { width: 390, height: 844 },
    area: { x: 0, y: 58, width: 390, height: 211 },
  },
];

const tall = (area: VisibleArea) => area.height > area.width * 1.05;

/** More screens, their rooms worked out as the page does, roughly: for the camera's limits. */
const SWEEP = [
  ...[
    [1280, 720],
    [1920, 1080],
    [2560, 1440],
  ].map(([width = 0, height = 0]) => ({
    name: `${String(width)} x ${String(height)}`,
    canvas: { width, height },
    area: { x: 0, y: 58, width: width - 408, height: height - 208 },
  })),
  ...[
    [844, 390],
    [932, 430],
    [1280, 560],
  ].map(([width = 0, height = 0]) => ({
    name: `${String(width)} x ${String(height)}, short`,
    canvas: { width, height },
    area: { x: 356, y: 58, width: width - 356, height: height - 116 },
  })),
];

/** The camera, framed for this view in this room. */
function framedFor(view: View, layout: (typeof LAYOUTS)[number]) {
  const camera = new PerspectiveCamera(34, layout.canvas.width / layout.canvas.height, 0.5, 3000);
  const lab = new LabCamera(camera);
  lab.setLayout(layout.canvas.width, layout.canvas.height, layout.area);
  return { camera, pose: lab.poseFor(view) };
}

/** How far the camera stands from what it looks at. */
const distanceFor = (view: View, layout: (typeof LAYOUTS)[number]) => {
  const { pose } = framedFor(view, layout);
  return pose.position.distanceTo(pose.target);
};

/** The view's must-see points in canvas pixels, with the camera framed for this room. */
function onCanvas(view: View, layout: (typeof LAYOUTS)[number]) {
  const { camera, pose } = framedFor(view, layout);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  camera.updateMatrixWorld();
  const lab = new LabCamera(camera);
  lab.setLayout(layout.canvas.width, layout.canvas.height, layout.area, pose.shift);
  return view.mustSee.map((p) => {
    const v = new Vector3(...p).project(camera);
    return {
      p,
      x: ((v.x + 1) / 2) * layout.canvas.width,
      y: ((1 - v.y) / 2) * layout.canvas.height,
      inFront: v.z > -1 && v.z < 1,
    };
  });
}

function expectFramed(view: View, layout: (typeof LAYOUTS)[number]) {
  const { area } = layout;
  for (const q of onCanvas(view, layout)) {
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

/** A stop's shot in a room, as the scene takes it, and how near it stands, against the overview. */
function shotIn(model: StopModel, layout: (typeof LAYOUTS)[number]) {
  const overview = distanceFor(overviewView(overviewPoints(models), tall(layout.area)), layout);
  const shot = stopShot(model);
  return { shot, overview, share: distanceFor(shot, layout) / overview };
}

describe('stop shots', () => {
  for (const layout of LAYOUTS) {
    it.each(models.map((m) => [m.id, m] as const))(
      `${layout.name}: %s shows all it must, centered in the room and filling it`,
      (_id, model) => {
        const { shot } = shotIn(model, layout);
        expectFramed(shot, layout);
        const { area } = layout;
        const xs = onCanvas(shot, layout).map((q) => ((q.x - area.x) / area.width) * 2 - 1);
        const ys = onCanvas(shot, layout).map((q) => 1 - ((q.y - area.y) / area.height) * 2);
        const [x0, x1, y0, y1] = [
          Math.min(...xs),
          Math.max(...xs),
          Math.min(...ys),
          Math.max(...ys),
        ];
        // Centered...
        expect(Math.abs(x0 + x1) / 2, 'across').toBeLessThan(0.02);
        expect(Math.abs(y0 + y1) / 2, 'up and down').toBeLessThan(0.02);
        // ...and filling the room but for its margin, one way or the other, unless the camera
        // already stands as near as it comes.
        const limit = fitLimits(
          { from: shot.position, to: shot.target, mustSee: [], labelRoom: shot.labelRoom },
          { width: area.width, height: area.height, canvasHeight: layout.canvas.height },
          shot.margin,
        );
        const fills = Math.max((x1 - x0) / (2 * limit.x), (y1 - y0) / (2 * limit.y));
        const { pose } = framedFor(shot, layout);
        const nearest = pose.position.distanceTo(pose.target) <= nearestAt(pose.target.y) * 1.01;
        expect(fills >= 0.98 || nearest, `fills ${fills.toFixed(2)}`).toBe(true);
      },
    );
  }

  it('looks at every stop from at least 15° above level, aimed within the bounds the reader pans in', () => {
    const bounds = orbitBounds();
    for (const m of models) {
      const { from, to } = stopAim(m);
      const dir = new Vector3(...from).sub(new Vector3(...to)).normalize();
      expect(Math.asin(dir.y), m.id).toBeGreaterThanOrEqual((15 * Math.PI) / 180);
      expect(bounds.containsPoint(new Vector3(...to)), m.id).toBe(true);
    }
  });

  it('looks, at every stop and the overview, at a point within the pan bounds, from no nearer than it may come, on screens of every shape', () => {
    const bounds = orbitBounds().expandByScalar(1e-6);
    for (const layout of [...LAYOUTS, ...SWEEP]) {
      const overview = overviewView(overviewPoints(models), tall(layout.area));
      for (const [id, view] of [
        ['overview', overview] as const,
        ...models.map((m) => [m.id, stopShot(m)] as const),
      ]) {
        const { pose } = framedFor(view, layout);
        const at = `${layout.name}: ${id}`;
        expect(bounds.containsPoint(pose.target), at).toBe(true);
        expect(pose.position.distanceTo(pose.target), at).toBeGreaterThanOrEqual(
          nearestAt(pose.target.y) - 1e-6,
        );
      }
    }
  });
});

describe("the ground's night grade", () => {
  for (const layout of LAYOUTS) {
    it(`${layout.name}: all of it at every stop`, () => {
      for (const m of models) {
        expect(nightGradeAt(shotIn(m, layout).share), m.id).toBe(1);
      }
    });
  }

  it('none in the overview, or farther out, as the arrival starts and the reader zooms out', () => {
    for (const share of [0.95, 1, 1.2, ORBIT.far, 1.8, 3]) expect(nightGradeAt(share)).toBe(0);
  });
});

describe('the overview', () => {
  const points = overviewPoints(models);

  for (const layout of LAYOUTS) {
    it(`${layout.name}: shows the whole model, clear of the controls`, () => {
      expectFramed(overviewView(points, tall(layout.area)), layout);
    });
  }

  it('looks from the south on a wide screen, and from the east on a tall one', () => {
    const wide = overviewView(points, false);
    const upright = overviewView(points, true);
    const from = (view: View) => new Vector3(...view.position).sub(new Vector3(...view.target));
    expect(from(wide).z).toBeGreaterThan(Math.abs(from(wide).x) * 2);
    expect(from(upright).x).toBeGreaterThan(Math.abs(from(upright).z) * 2);
  });

  it("phone: fills at least 92% of the screen's width", () => {
    const layout = LAYOUTS[2];
    if (!layout) throw new Error('no phone layout');
    const xs = onCanvas(overviewView(points, true), layout).map((q) => q.x);
    expect((Math.max(...xs) - Math.min(...xs)) / layout.area.width).toBeGreaterThanOrEqual(0.92);
  });
});

describe("the camera's limits", () => {
  it('goes all the way round in 18 turns of a button or key', () => {
    expect(ORBIT_STEP.turn * 18).toBeCloseTo(Math.PI * 2);
  });

  it('keeps the camera above the grass, at every limit and wherever it looks', () => {
    const bounds = orbitBounds();
    const s = new Spherical();
    for (const y of [bounds.min.y, -4, -1, 0, bounds.max.y]) {
      for (const phi of ORBIT.polar) {
        for (const radius of [nearestAt(y), 1000]) {
          s.set(radius, phi, 0);
          const camera = new Vector3().setFromSpherical(s).add(new Vector3(0, y, 0));
          const at = `looking at ${String(y)}, ${radius.toFixed(1)} away`;
          expect(camera.y, at).toBeGreaterThanOrEqual(CLEARANCE - 1e-9);
        }
      }
    }
  });

  it('comes nearer to what it looks at the higher that is, down to its nearest at the grass', () => {
    expect(nearestAt(0)).toBe(ORBIT.near);
    expect(nearestAt(ORBIT.floor)).toBeGreaterThan(nearestAt(-4));
    expect(nearestAt(-4)).toBeGreaterThan(nearestAt(0));
  });
});
