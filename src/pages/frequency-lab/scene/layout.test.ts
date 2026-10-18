/**
 * The lab's layout at every depth it's drawn at, the equipment at the size it's drawn, and its
 * views, checked through the page's own camera: framed by LabCamera into a canvas whose free area
 * the chrome leaves, then projected to CSS pixels. What the lesson needs must land in it, the cut
 * face must lead, and the hookup must be big enough to see.
 */
import { CatmullRomCurve3, Object3D, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { LabCamera, type VisibleArea } from '../../../kit3d/camera.ts';
import {
  EQUIPMENT_SIZE,
  SURFACE,
  VIEW_GROUND,
  labLayout,
  layoutFor,
  tallView,
  viewFor,
  viewKind,
  viewOf,
  wideView,
} from './layout.ts';

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
  });

  it('keeps every line buried and clear of the others, in its true order', () => {
    const gap = (upper: { y: number; radius: number }, lower: { y: number; radius: number }) =>
      upper.y - upper.radius - (lower.y + lower.radius);
    // Telecom over the gas main; the tracer rides on the plastic main.
    expect(gap(lines.telecom, lines.steel)).toBeGreaterThan(0);
    expect(gap(lines.tracer, lines.plastic)).toBeGreaterThanOrEqual(0);
    expect(gap(lines.tracer, lines.plastic)).toBeLessThan(0.1 * depth);
    for (const line of [lines.telecom, lines.steel, lines.plastic]) {
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

  it('keeps everything above ground at true size, unless the equipment is drawn larger', () => {
    const real = labLayout({ depth: 1 });
    expect(layout.hookup.transmitter).toEqual(real.hookup.transmitter);
    expect(layout.leads).toEqual(real.leads);
    expect(layout.trees).toEqual(real.trees);
    expect(layout.equipment).toBe(1);
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

describe('lines drawn thinner than the ground is deep', () => {
  it('draws the lines `thick` times their true thickness, at the depths the ground puts them', () => {
    const real = labLayout({ depth: 1 }).lines;
    const { lines } = labLayout({ depth: 12, under: 1.5, thick: 5 });
    for (const name of ['steel', 'plastic', 'tracer', 'telecom'] as const) {
      expect(lines[name].radius).toBeCloseTo(real[name].radius * 5);
    }
    for (const name of ['steel', 'plastic', 'telecom'] as const) {
      expect(lines[name].y).toBeCloseTo(real[name].y * 12);
    }
    // The tracer still rides on the plastic main.
    const gap = lines.tracer.y - lines.tracer.radius - (lines.plastic.y + lines.plastic.radius);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(0.1 * 5);
  });
});

describe.each(['wide', 'tall'] as const)("the %s view's layout", (kind) => {
  const layout = layoutFor(kind);
  const { hookup, terminals, leads, leadRadius } = layout;
  const k = EQUIPMENT_SIZE;

  it('draws the ground as deep and the lines as thick as the view asks, and the equipment larger than true', () => {
    expect(layout.depth).toBe(VIEW_GROUND[kind].depth);
    expect(layout.under).toBe(VIEW_GROUND[kind].under);
    expect(layout.thick).toBe(VIEW_GROUND[kind].thick);
    expect(layout.equipment).toBe(k);
    expect(VIEW_GROUND.tall.thick).toBeGreaterThan(VIEW_GROUND.wide.thick);
  });

  it('runs every lead from its terminal on the transmitter to its clip', () => {
    for (const setup of ['steel', 'plastic'] as const) {
      expect(leads.signal[setup][0]).toEqual(terminals.signal);
      expect(leads.signal[setup].at(-1)).toEqual(terminals.access[setup]);
    }
    expect(leads.ground[0]).toEqual(terminals.ground);
    expect(leads.ground.at(-1)).toEqual(terminals.stake);
  });

  it('lays the leads in the grass all along, never sunk into the ground', () => {
    // Sampled along the curve the scene draws through the points, not just at the points.
    for (const lead of [leads.signal.steel, leads.signal.plastic, leads.ground]) {
      const curve = new CatmullRomCurve3(lead.map(([x, y, z]) => new Vector3(x, y, z)));
      for (let i = 0; i <= 400; i++) {
        // At most a third of its thickness down among the grass, which tops out at 0.12 ft.
        expect(curve.getPoint(i / 400).y).toBeGreaterThanOrEqual(0.12 + leadRadius / 3);
      }
    }
  });

  it('puts the terminals where the transmitter, as the scene turns and sizes it, has them', () => {
    // The transmitter's frame as lines.ts builds it: on the grass, turned, at the equipment's size.
    const tx = hookup.transmitter;
    const unit = new Object3D();
    unit.position.set(tx.x, 0.12, tx.z);
    unit.rotation.y = tx.turn;
    unit.scale.setScalar(k);
    unit.updateMatrixWorld();
    const at = (x: number, y: number, z: number) =>
      new Vector3(x, y, z).applyMatrix4(unit.matrixWorld);
    for (const [terminal, local] of [
      [terminals.signal, at(0.45, 0.22, 0.64)],
      [terminals.ground, at(-0.45, 0.22, 0.64)],
    ] as const) {
      terminal.forEach((v, i) => {
        expect(v).toBeCloseTo(local.getComponent(i), 6);
      });
    }
    // The signal terminal faces the access point, the ground terminal the stake.
    expect(terminals.signal[0]).toBeGreaterThan(terminals.ground[0]);
  });

  it('stands the transmitter on the verge, clear of the access point, the stake and the pedestal', () => {
    const tx = hookup.transmitter;
    const [c, s] = [Math.cos(tx.turn), Math.sin(tx.turn)];
    // The case's corners, 1.5 by 1.0 ft true, at the size it's drawn.
    const corners = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) => {
        const [x, z] = [0.75 * sx * k, 0.5 * sz * k];
        return [tx.x + x * c + z * s, tx.z + z * c - x * s] as const;
      }),
    );
    for (const [x, z] of corners) {
      expect(z).toBeLessThan(0);
      expect(z).toBeGreaterThan(SURFACE.vergeBack);
      expect(x).toBeLessThan(hookup.access.x - 0.44 * k);
      expect(x).toBeGreaterThan(hookup.pedestal.x + 0.5);
      expect(x).toBeGreaterThan(hookup.stake.x);
    }
  });
});

/** The camera framed for this free area, with the view and layout that suit it. */
function framed(canvas: { width: number; height: number }, area: VisibleArea) {
  const kind = viewKind(area, canvas);
  const layout = layoutFor(kind);
  const camera = new PerspectiveCamera(34, canvas.width / canvas.height, 0.5, 900);
  const lab = new LabCamera(camera);
  lab.setLayout(canvas.width, canvas.height, area);
  const view = viewOf(layout, kind);
  lab.frame(view);
  /** A point of the scene in canvas pixels. */
  const px = (x: number, y: number, z: number) => {
    const v = new Vector3(x, y, z).project(camera);
    return {
      x: ((v.x + 1) / 2) * canvas.width,
      y: ((1 - v.y) / 2) * canvas.height,
      inFront: v.z > -1 && v.z < 1,
    };
  };
  return { layout, view, px };
}

/** The view's must-see points in canvas pixels, with the camera framed for this free area. */
function onCanvas(canvas: { width: number; height: number }, area: VisibleArea) {
  const { view, px } = framed(canvas, area);
  return view.mustSee.map((p) => ({ p, ...px(...p) }));
}

/** A polygon's area. */
function areaOf(points: readonly { x: number; y: number }[]): number {
  let twice = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length] ?? p;
    twice += p.x * q.y - q.x * p.y;
  });
  return Math.abs(twice) / 2;
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

describe.each(['wide', 'tall'] as const)("the %s view's ground", (kind) => {
  const layout = layoutFor(kind);
  const { strata, lines, trench, block, depth, under } = layout;
  const real = labLayout({ depth: 1 });

  it('draws the layers under the trench flatter than the ones the lines lie in', () => {
    expect(under).toBeLessThan(depth);
    expect(trench.bottom).toBeCloseTo(real.trench.bottom * depth);
    strata.forEach((s, i) => {
      const r = real.strata[i];
      if (!r) throw new Error(`no true stratum ${String(i)}`);
      const scale = (s.top - s.bottom) / (r.top - r.bottom);
      expect(scale, s.name).toBeCloseTo(s.bottom >= trench.bottom ? depth : under);
    });
    expect(layout.drawn(-10)).toBeCloseTo(block.bottom);
  });

  it('lets the lines lead the cut face, with well under half of it below the gas main', () => {
    const below = lines.steel.y - lines.steel.radius - block.bottom;
    expect(below / -block.bottom).toBeLessThan(0.4);
  });

  it('keeps every line buried, apart from the others, and in its trench', () => {
    expect(lines.telecom.y + lines.telecom.radius).toBeLessThan(0);
    expect(lines.telecom.y - lines.telecom.radius).toBeGreaterThan(
      lines.steel.y + lines.steel.radius,
    );
    expect(lines.steel.y - lines.steel.radius).toBeGreaterThan(trench.bottom);
    expect(-trench.zBack).toBeGreaterThan(lines.steel.radius * 1.5);
  });
});

describe('views', () => {
  const layout = layoutFor('wide');

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

  it('keeps the view it has while the screen is near the line between them', () => {
    // A square screen: not tall enough to turn a wide view tall, nor short enough to turn a tall
    // view wide, so a window dragged across the line doesn't rebuild the block back and forth.
    const square = { width: 1000, height: 1000 };
    const area = { x: 0, y: 0, ...square };
    expect(viewKind(area, square)).toBe('wide');
    expect(viewKind(area, square, 'wide')).toBe('wide');
    expect(viewKind(area, square, 'tall')).toBe('tall');
    // Clearly wide, it turns.
    const wide = { width: 1000, height: 900 };
    expect(viewKind({ ...area, ...wide }, wide, 'tall')).toBe('wide');
  });

  it('shows the whole slab, the trees on it, and the hookup in every view', () => {
    for (const kind of ['wide', 'tall'] as const) {
      const built = layoutFor(kind);
      const view = viewOf(built, kind);
      expect(view.mustSee).toEqual(built.mustSee);
      const xs = view.mustSee.map((p) => p[0]);
      expect(Math.min(...xs)).toBeLessThanOrEqual(built.block.x0);
      expect(Math.max(...xs)).toBeGreaterThanOrEqual(built.block.x1);
      expect(Math.min(...view.mustSee.map((p) => p[1]))).toBeLessThanOrEqual(built.block.bottom);
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
    const view = viewOf(layoutFor(viewKind(c.area, c.canvas)), viewKind(c.area, c.canvas));
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

/**
 * The free area the page leaves the view at the sizes the lab is designed for: below the header
 * and above the console (or the open drawer), nothing else over it. Where nothing but the console
 * is open, the block fills it.
 */
const ROOMS: {
  name: string;
  canvas: { width: number; height: number };
  area: VisibleArea;
  desktop?: boolean;
  fills?: boolean;
}[] = [
  {
    name: 'desktop',
    canvas: { width: 1440, height: 900 },
    area: { x: 0, y: 58, width: 1440, height: 717 },
    desktop: true,
    fills: true,
  },
  {
    name: 'desktop, guide open',
    canvas: { width: 1440, height: 900 },
    area: { x: 0, y: 58, width: 1440, height: 348 },
  },
  {
    name: 'laptop',
    canvas: { width: 1366, height: 768 },
    area: { x: 0, y: 58, width: 1366, height: 585 },
    fills: true,
  },
  {
    name: 'small laptop',
    canvas: { width: 1024, height: 768 },
    area: { x: 0, y: 58, width: 1024, height: 519 },
    fills: true,
  },
  {
    name: 'tablet, upright',
    canvas: { width: 820, height: 1180 },
    area: { x: 0, y: 58, width: 820, height: 909 },
    fills: true,
  },
  {
    name: 'phone',
    canvas: { width: 390, height: 844 },
    area: { x: 0, y: 58, width: 390, height: 519 },
    fills: true,
  },
  {
    name: 'phone, sideways',
    canvas: { width: 844, height: 390 },
    area: { x: 340, y: 66, width: 504, height: 324 },
  },
];

describe('framing at the sizes the lab is designed for', () => {
  it.each(ROOMS)(
    '$name: the cut face leads, larger than the top and the trees together',
    (room) => {
      const { layout, px } = framed(room.canvas, room.area);
      const { block } = layout;
      const face = areaOf([
        px(block.x0, 0, 0),
        px(block.x1, 0, 0),
        px(block.x1, block.bottom, 0),
        px(block.x0, block.bottom, 0),
      ]);
      const top = areaOf([
        px(block.x0, 0, block.z0),
        px(block.x1, 0, block.z0),
        px(block.x1, 0, 0),
        px(block.x0, 0, 0),
      ]);
      // Each tree as the box it stands in.
      const trees = layout.trees.reduce((sum, t) => {
        const r = t.height * 0.34;
        return (
          sum +
          areaOf([
            px(t.x - r, 0, t.z),
            px(t.x + r, 0, t.z),
            px(t.x + r, t.height, t.z),
            px(t.x - r, t.height, t.z),
          ])
        );
      }, 0);
      expect(face).toBeGreaterThan(top + trees);
      // On a desktop screen, the cut face takes over a quarter of the room the view has.
      if (room.desktop) {
        expect(face / (room.area.width * room.area.height)).toBeGreaterThanOrEqual(0.28);
      }
    },
  );

  it.each(ROOMS.filter((r) => r.fills))(
    '$name: the block fills the height between the header and the console, no band of sky under it',
    (room) => {
      const { view, px } = framed(room.canvas, room.area);
      const ys = view.mustSee.map((p) => px(...p).y);
      const above = Math.min(...ys) - room.area.y;
      const under = room.area.y + room.area.height - Math.max(...ys);
      expect(above / room.area.height, 'sky above').toBeLessThan(0.06);
      expect(under / room.area.height, 'sky under').toBeLessThan(0.06);
    },
  );

  it.each(ROOMS)('$name: the trees stand at most half as tall as the cut face', (room) => {
    const { layout, px } = framed(room.canvas, room.area);
    for (const t of layout.trees) {
      const tree = Math.abs(px(t.x, t.height, t.z).y - px(t.x, 0, t.z).y);
      const face = Math.abs(px(t.x, layout.block.bottom, 0).y - px(t.x, 0, 0).y);
      expect(tree, `the tree at ${String(t.x)} ft`).toBeLessThanOrEqual(face / 2);
    }
  });

  it('phone: the lines are drawn large, the gas main at least 16 px thick by the hookup', () => {
    const room = ROOMS.find((r) => r.name === 'phone');
    if (!room) throw new Error('no phone room');
    const { layout, px } = framed(room.canvas, room.area);
    const main = layout.lines.steel;
    const top = px(0, main.y + main.radius, 0);
    const bottom = px(0, main.y - main.radius, 0);
    expect(Math.hypot(top.x - bottom.x, top.y - bottom.y)).toBeGreaterThanOrEqual(16);
  });

  it('desktop: the transmitter is at least 24 px across', () => {
    const room = ROOMS[0];
    if (!room) throw new Error('no desktop room');
    const { layout, px } = framed(room.canvas, room.area);
    const tx = layout.hookup.transmitter;
    const k = layout.equipment;
    const [c, s] = [Math.cos(tx.turn), Math.sin(tx.turn)];
    // The case's top corners, 1.5 by 1.0 ft true, at the size it's drawn.
    const xs = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) => {
        const [x, z] = [0.75 * sx * k, 0.5 * sz * k];
        return px(tx.x + x * c + z * s, 0.12 + 0.92 * k, tx.z + z * c - x * s).x;
      }),
    );
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(24);
  });
});
