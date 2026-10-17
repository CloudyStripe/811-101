/**
 * The diorama's shots and the camera's limits, checked through the page's own camera: framed by
 * LabCamera into the room the guide and the dock leave, then projected to CSS pixels. What each
 * shot must show lands in that room and out from under the controls. Every stop is seen from a
 * share of the overview's distance that shows where it sits, with the stops either side where they
 * fit, near enough for the ground's whole night grade, which the overview never gets. The phone's
 * overview fills its width. However the reader moves it, the camera stays above the grass.
 */
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { LabCamera, type View, type VisibleArea } from '../../../kit3d/camera.ts';
import { stopsOf } from '../journey.ts';
import {
  ORBIT,
  ORBIT_STEP,
  STOP_SHOT,
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
const byId = new Map(models.map((m) => [m.id, m]));

/** The dock in the bottom left corner, and the camera's buttons in the bottom right, on desktop. */
const DOCK = { x: 16, y: 776, width: 363, height: 108 };
const CAMERA = { x: 836, y: 680, width: 196, height: 140 };

/** The room the page measures for the view at desktop and phone sizes, in CSS pixels. */
const LAYOUTS: { name: string; canvas: { width: number; height: number }; area: VisibleArea }[] = [
  {
    // Below the header and left of the guide, clear of the dock and the camera's buttons.
    name: 'desktop, guide open',
    canvas: { width: 1440, height: 900 },
    area: { x: 0, y: 58, width: 1032, height: 842, keepOut: [DOCK, CAMERA] },
  },
  {
    // The whole width, clear of the dock, the buttons and the closed guide's title bar.
    name: 'desktop, guide closed',
    canvas: { width: 1440, height: 900 },
    area: {
      x: 0,
      y: 58,
      width: 1440,
      height: 842,
      keepOut: [DOCK, { ...CAMERA, x: 1228 }, { x: 1120, y: 66, width: 304, height: 54 }],
    },
  },
  {
    // Between the header and the sheet's bar, clear of the camera's buttons.
    name: 'phone',
    canvas: { width: 390, height: 844 },
    area: {
      x: 0,
      y: 58,
      width: 390,
      height: 595,
      keepOut: [{ x: 186, y: 509, width: 204, height: 144 }],
    },
  },
  {
    // Held sideways: the column beside the guide and the dock, clear of the stacked buttons.
    name: 'phone held sideways',
    canvas: { width: 667, height: 375 },
    area: {
      x: 356,
      y: 0,
      width: 311,
      height: 375,
      keepOut: [{ x: 475, y: 241, width: 180, height: 126 }],
    },
  },
  {
    // Between the header and the open sheet.
    name: 'phone, sheet open',
    canvas: { width: 390, height: 844 },
    area: { x: 0, y: 58, width: 390, height: 265 },
  },
];

const tall = (area: VisibleArea) => area.height > area.width * 1.05;

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

/** A stop's neighbors on the natural gas tour, or the gasoline one for its own stops. */
function neighborsOf(model: StopModel): { prev?: StopModel; next?: StopModel } {
  const gas = stopsOf('gas');
  const path = gas.includes(model.id) ? gas : stopsOf('gasoline');
  const i = path.indexOf(model.id);
  return { prev: byId.get(path[i - 1] ?? model.id), next: byId.get(path[i + 1] ?? model.id) };
}

/** A stop's shot in a room, as the scene takes it. */
function shotIn(model: StopModel, layout: (typeof LAYOUTS)[number]) {
  const overview = distanceFor(overviewView(overviewPoints(models), tall(layout.area)), layout);
  const neighbors = neighborsOf(model);
  const shot = stopShot(
    model,
    {
      ...(neighbors.prev === model ? {} : { prev: neighbors.prev }),
      ...(neighbors.next === model ? {} : { next: neighbors.next }),
    },
    overview,
    (view) => distanceFor(view, layout),
  );
  return { shot, overview, share: distanceFor(shot, layout) / overview };
}

describe('stop shots', () => {
  for (const layout of LAYOUTS) {
    it.each(models.map((m) => [m.id, m] as const))(
      `${layout.name}: %s shows all it must, clear of the controls, from between 0.4 and 0.8 of the overview's distance`,
      (_id, model) => {
        const { shot, share } = shotIn(model, layout);
        expectFramed(shot, layout);
        expect(share).toBeGreaterThanOrEqual(STOP_SHOT.near - 0.005);
        expect(share).toBeLessThanOrEqual(STOP_SHOT.far + 0.005);
      },
    );
  }

  it.each(models.map((m) => [m.id, m] as const))(
    'desktop: %s shows the stops either side of it',
    (_id, model) => {
      const layout = LAYOUTS[0];
      if (!layout) throw new Error('no desktop layout');
      const { shot } = shotIn(model, layout);
      const { prev, next } = neighborsOf(model);
      for (const n of [prev, next]) {
        if (!n || n === model) continue;
        const seen = shot.mustSee.some((p) => p.every((v, i) => v === n.label.at[i]));
        expect(seen, `${n.id} beside ${model.id}`).toBe(true);
      }
    },
  );

  it('looks at every stop from at least 15° above level, aimed within the bounds the reader pans in', () => {
    const bounds = orbitBounds();
    for (const m of models) {
      const { from, to } = stopAim(m);
      const dir = new Vector3(...from).sub(new Vector3(...to)).normalize();
      expect(Math.asin(dir.y), m.id).toBeGreaterThanOrEqual((15 * Math.PI) / 180);
      expect(bounds.containsPoint(new Vector3(...to)), m.id).toBe(true);
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
  it('looks, framed, at a point within the bounds the reader pans in: the overview and every stop, in every room', () => {
    const bounds = orbitBounds().expandByScalar(1e-6);
    for (const layout of LAYOUTS) {
      const overview = overviewView(overviewPoints(models), tall(layout.area));
      const views = [
        { id: 'overview', view: overview },
        ...models.map((m) => ({ id: m.id, view: shotIn(m, layout).shot })),
      ];
      for (const { id, view } of views) {
        const { target } = framedFor(view, layout).pose;
        const at = target
          .toArray()
          .map((n) => n.toFixed(1))
          .join(',');
        expect(bounds.containsPoint(target), `${layout.name}: ${id} at ${at}`).toBe(true);
      }
    }
  });

  it('goes all the way round in 18 turns of a button or key', () => {
    expect(ORBIT_STEP.turn * 18).toBeCloseTo(Math.PI * 2);
  });

  it('keeps the camera above the grass, at every limit and wherever it looks', () => {
    const bounds = orbitBounds();
    const s = new Spherical();
    for (const y of [bounds.min.y, 0, bounds.max.y]) {
      for (const phi of ORBIT.polar) {
        for (const radius of [ORBIT.near, 1000]) {
          s.set(radius, phi, 0);
          const camera = new Vector3().setFromSpherical(s).add(new Vector3(0, y, 0));
          expect(camera.y, `looking at ${String(y)}, ${String(radius)} away`).toBeGreaterThan(0);
        }
      }
    }
  });
});
