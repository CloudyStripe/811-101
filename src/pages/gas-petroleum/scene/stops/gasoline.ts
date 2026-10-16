/**
 * The gasoline path: crude oil moving to the refinery, the distillation tower that sorts it into
 * fuels, the terminal and tanker truck that deliver the gasoline, and the station that sells it.
 * The tower's fuels are a ramp of values, dark to light; only gasoline's band is the path's own.
 */
import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three';
import { PATH_STYLE } from '../../../../design/paths.ts';
import { DIORAMA_COLORS as C, WORLD_COLORS } from '../../../../design/tokens.ts';
import { mulberry32 } from '../../../../kit3d/rng.ts';
import { Parts, createFinishes } from '../build.ts';
import { faceStrip, glowing, pad } from '../kit.ts';
import { FACE, SITE } from '../layout.ts';
import { hit, type StopModel } from '../stop.ts';

const FRONT = [0, 0, 1] as const;

function start() {
  const finishes = createFinishes();
  return { finishes, parts: new Parts(finishes) };
}

export function crudeTransport(): StopModel {
  const { finishes, parts } = start();
  // The rails and their sleepers.
  parts.box(17.8, 0.1, 0.09, C.steel, -15.3, 0.06, 15.05, { finish: 'metal' });
  parts.box(17.8, 0.1, 0.09, C.steel, -15.3, 0.06, 15.95, { finish: 'metal' });
  for (let x = -23.8; x <= -6.8; x += 0.85)
    parts.box(0.22, 0.07, 1.4, WORLD_COLORS.trunk, x, 0, 15.5, { cast: false });
  parts.box(0.3, 0.6, 1.2, C.machineDark, -6.2, 0, 15.5);
  // A train of tank cars carrying crude oil.
  const train = parts.moving(-14.5, 0, 15.5, () => {
    parts.box(2.6, 1.0, 1.15, C.machine, 4.1, 0.35, 0);
    parts.box(0.9, 0.55, 1.18, C.graphite, 4.95, 1.0, 0);
    parts.box(2.62, 0.16, 1.17, C.machineDark, 4.1, 0.55, 0);
    for (const x of [1.3, -1.6, -4.5]) {
      parts.box(2.7, 0.18, 1.0, C.machineDark, x, 0.3, 0);
      parts.bullet(2.2, 0.52, C.graphite, x, 1.02, 0);
      parts.box(0.6, 0.1, 0.6, C.machineDark, x, 1.5, 0);
    }
  });
  const root = parts.finish();
  let shuttle = 0;
  return {
    id: 'crude-transport',
    root,
    finishes,
    hits: [hit(-14.5, 1.1, 15.5, 12.4, 2.4, 2.2)],
    view: { from: [-12, 18, 31], to: [-13.5, 0.5, 14.5] },
    focus: [],
    label: { at: [-15, 3.4, 15.5] },
    details: [
      { key: 'crude', at: [-22.8, 1.3, 13.4], swatch: C.oil },
      { key: 'rail', at: [-11.5, 2.4, 15.5] },
    ],
    pops: [],
    animate({ dt, open }) {
      // The train shuttles gently, and more while its stop is open.
      shuttle += dt * (0.35 + 0.65 * open);
      train.position.x = -14.5 + 2.1 * Math.sin(shuttle * 0.45);
    },
  };
}

/** The fractions, bottom to top: heavy to light, and a ramp of values to match. */
const FRACTIONS = [
  { key: 'asphalt', hex: C.asphalt, y0: 0.6, y1: 2.3 },
  { key: 'heavy', hex: C.heavyOil, y0: 2.3, y1: 4.2 },
  { key: 'diesel', hex: C.diesel, y0: 4.2, y1: 6.0 },
  { key: 'jet', hex: C.jetFuel, y0: 6.0, y1: 7.8 },
  { key: 'gasoline', hex: PATH_STYLE.gasoline.color, y0: 7.8, y1: 9.8 },
  { key: 'light', hex: C.lightGases, y0: 9.8, y1: 11.8 },
] as const;

export function distillation(): StopModel {
  const { finishes, parts } = start();
  const { x: tx, z: tz } = SITE.tower;
  const R = 1.45;
  const H = 12;
  const fx = tx - 3.8;
  pad(parts, 8.8, 6.4, tx - 1.8, tz);
  // The furnace that heats the crude, and the pipe that feeds the hot crude to the tower.
  parts.box(2.4, 2.2, 2.4, C.brick, fx, 0, tz);
  parts.box(2.5, 0.25, 2.5, C.machineDark, fx, 2.2, tz);
  parts.cyl(0.24, 0.3, 3.2, C.brick, fx - 0.6, 2.4, tz - 0.6, { segments: 8 });
  parts.rod([fx + 1.2, 1.0, tz], [tx - R + 0.05, 1.0, tz], 0.18, C.steel, { finish: 'metal' });
  parts.cyl(R + 0.15, R + 0.25, 0.6, C.steel, tx, 0, tz, { finish: 'metal', segments: 24 });
  parts.dome(R, 1, C.machine, tx, H, tz, { segments: 24 });
  // A tray and an outlet at each fraction's level; the outlets carry each fuel away.
  for (const f of FRACTIONS) {
    parts.cyl(R - 0.04, R - 0.04, 0.07, C.machineDark, tx, f.y0, tz, { segments: 24, cast: false });
    const ym = (f.y0 + f.y1) / 2;
    parts.rod([tx + R - 0.05, ym, tz], [tx + R + 1.0, ym, tz], 0.11, f.hex);
    parts.rod([tx + R + 1.0, ym, tz], [tx + R + 1.0, ym - 0.5, tz], 0.11, f.hex);
  }
  const root = parts.finish();
  // Each fraction inside the tower, through its glass shell.
  for (const f of FRACTIONS) {
    const band = new Mesh(
      new CylinderGeometry(R - 0.14, R - 0.14, f.y1 - f.y0 - 0.06, 24),
      finishes.track(
        new MeshStandardMaterial({
          color: new Color(f.hex),
          roughness: 0.6,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
        }),
      ),
    );
    band.position.set(tx, (f.y0 + f.y1) / 2, tz);
    root.add(band);
  }
  const shell = new Mesh(
    new CylinderGeometry(R, R, H - 0.6, 24, 1, true),
    finishes.track(
      new MeshStandardMaterial({
        color: new Color(C.shell),
        roughness: 0.2,
        transparent: true,
        opacity: 0.24,
        side: DoubleSide,
        depthWrite: false,
      }),
    ),
  );
  shell.position.set(tx, 0.6 + (H - 0.6) / 2, tz);
  root.add(shell);
  const furnace = finishes.track(glowing(C.furnaceGlow, 1.6));
  const furnaceWindow = new Mesh(new BoxGeometry(1.6, 0.5, 0.05), furnace);
  furnaceWindow.position.set(fx, 1.1, tz + 1.22);
  root.add(furnaceWindow);

  // Vapor rising from the bottom and turning back to liquid at its own fraction's level.
  const N = 70;
  const vapor = new InstancedMesh(
    new IcosahedronGeometry(0.12, 1),
    finishes.track(new MeshStandardMaterial({ roughness: 0.5 })),
    N,
  );
  vapor.frustumCulled = false;
  vapor.castShadow = false;
  root.add(vapor);
  const random = mulberry32(42);
  const pos = new Float32Array(N * 3);
  const target = new Uint8Array(N);
  const speed = new Float32Array(N);
  const life = new Float32Array(N);
  const hot = new Color(C.flameCore);
  const bandColors = FRACTIONS.map((f) => new Color(f.hex));
  const tmp = new Color();
  const m = new Matrix4();
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);
  const v = new Vector3();
  const spawn = (i: number) => {
    const a = random() * Math.PI * 2;
    const r = random() * (R - 0.35);
    pos.set([tx + Math.cos(a) * r, 0.9 + random() * 0.4, tz + Math.sin(a) * r], i * 3);
    // Every fraction but the asphalt, which stays at the bottom.
    target[i] = 1 + Math.floor(random() * 5);
    speed[i] = 1.4 + random() * 1.2;
    life[i] = 0;
  };
  for (let i = 0; i < N; i++) {
    spawn(i);
    pos[i * 3 + 1] = 0.9 + random() * 10;
  }
  vapor.visible = false;
  return {
    id: 'distillation',
    root,
    finishes,
    hits: [hit(tx, 6.1, tz, 3.4, 12.6, 3.4), hit(fx, 1.3, tz, 2.8, 2.8, 2.8)],
    view: { from: [11, 9, 37], to: [-1, 6, 14] },
    focus: [],
    label: { at: [-1, 13.4, 14] },
    details: [
      { key: 'furnace', at: [fx, 3.1, tz + 1.3] },
      ...FRACTIONS.map((f) => ({
        key: f.key,
        at: [tx + R + 1.35, (f.y0 + f.y1) / 2, tz] as const,
        swatch: f.hex,
      })),
    ],
    pops: [],
    animate({ time, dt, open }) {
      furnace.emissiveIntensity = 1.2 + open * (0.6 + Math.sin(time * 11) * 0.12);
      vapor.visible = open > 0.05;
      if (!vapor.visible) return;
      for (let i = 0; i < N; i++) {
        const f = FRACTIONS[target[i] ?? 1] ?? FRACTIONS[1];
        const ym = (f.y0 + f.y1) / 2;
        let y = pos[i * 3 + 1] ?? 0;
        if (y < ym) {
          y = Math.min(ym, y + dt * (speed[i] ?? 1));
          tmp
            .copy(hot)
            .lerp(
              bandColors[target[i] ?? 1] ?? hot,
              Math.min(1, Math.max(0, (y - 0.9) / (ym - 0.9))) * 0.6,
            );
        } else {
          life[i] = (life[i] ?? 0) + dt;
          tmp.copy(bandColors[target[i] ?? 1] ?? hot);
          if ((life[i] ?? 0) > 0.9) {
            spawn(i);
            y = pos[i * 3 + 1] ?? 0;
          }
        }
        pos[i * 3 + 1] = y;
        v.set(pos[i * 3] ?? 0, y, pos[i * 3 + 2] ?? 0);
        vapor.setMatrixAt(i, m.compose(v, q, one));
        vapor.setColorAt(i, tmp);
      }
      vapor.instanceMatrix.needsUpdate = true;
      if (vapor.instanceColor) vapor.instanceColor.needsUpdate = true;
    },
  };
}

/** The tanker truck's loop: from the terminal to the station and back. */
const TRUCK_LOOP = new CatmullRomCurve3(
  [
    [18, 10.6],
    [22.5, 10.6],
    [25.8, 12.9],
    [28.2, 16.2],
    [27.8, 21.3],
    [24.0, 22.7],
    [20.4, 21.9],
    [18.9, 18.0],
    [18.6, 14.0],
  ].map(([x, z]) => new Vector3(x, 0, z)),
  true,
  'centripetal',
);

export function delivery(): StopModel {
  const { finishes, parts } = start();
  pad(parts, 7.8, 4.8, 18, 6.6);
  // The storage terminal's tanks, and its loading rack.
  for (const x of [16.2, 19.8]) {
    parts.cyl(1.5, 1.5, 2.6, C.tank, x, 0, 6.2, { segments: 24 });
    parts.cone(1.53, 0.45, C.machine, x, 2.83, 6.2, { segments: 24 });
  }
  for (const [x, z] of [
    [17.0, 8.9],
    [19.4, 8.9],
  ] as const) {
    parts.box(0.15, 2.2, 0.15, C.steel, x, 0, z, { finish: 'metal' });
  }
  parts.box(2.8, 0.15, 1.2, C.steel, 18.2, 2.2, 8.9, { finish: 'metal' });
  parts.rod([18.2, 2.2, 8.9], [18.6, 1.6, 10.1], 0.06, C.machineDark);
  // The tanker truck.
  const truck = parts.moving(18, 0, 10.6, () => {
    parts.box(4.2, 0.25, 1.0, C.graphite, 0, 0.32, 0);
    parts.box(1.1, 1.15, 1.3, C.truck, 1.75, 0.45, 0);
    parts.box(0.5, 0.4, 1.32, C.graphite, 2.1, 1.05, 0);
    parts.bullet(2.4, 0.55, C.tank, -0.55, 1.1, 0);
    for (const a of [-1.5, -0.6, 1.6]) {
      for (const b of [-0.52, 0.52])
        parts.cyl(0.27, 0.27, 0.2, C.graphite, a, 0.18, b, {
          rx: Math.PI / 2,
          finish: 'matte',
          segments: 10,
        });
    }
  });
  const root = parts.finish();
  const length = TRUCK_LOOP.getLength();
  const p = new Vector3();
  const ahead = new Vector3();
  let u = 0;
  let wait = 0;
  return {
    id: 'delivery',
    root,
    finishes,
    hits: [hit(18, 1.4, 6.6, 7.4, 3, 3.8)],
    followHits: [{ box: hit(0, 0.9, 0, 4.4, 1.9, 1.6), follow: truck }],
    view: { from: [16, 12, 28], to: [19, 0.5, 11] },
    focus: [],
    label: { at: [17.5, 4.4, 6] },
    details: [
      { key: 'terminal', at: [16.2, 3.6, 6.2] },
      { key: 'truck', at: [0, 2.3, 0], follow: truck },
    ],
    pops: [],
    animate({ dt, open }) {
      if (wait > 0) {
        wait -= dt;
        return;
      }
      const before = u;
      u = (u + (dt * (1.2 + 2 * open)) / length) % 1;
      // A pause to unload at the station.
      if (before < 0.62 && u >= 0.62) wait = 1.4;
      TRUCK_LOOP.getPointAt(u, p);
      TRUCK_LOOP.getPointAt((u + 0.01) % 1, ahead);
      truck.position.copy(p);
      truck.rotation.y = Math.atan2(-(ahead.z - p.z), ahead.x - p.x);
    },
  };
}

export function pump(): StopModel {
  const { finishes, parts } = start();
  parts.box(11.5, 0.06, 11.4, C.concrete, 23.4, 0, 17.9, { cast: false, finish: 'ground' });
  // The canopy over the pumps.
  parts.box(6.4, 0.45, 4.4, C.tank, 23.5, 3.6, 18);
  parts.box(6.46, 0.16, 4.46, C.machineDark, 23.5, 3.72, 18);
  for (const [x, z] of [
    [21, 16.4],
    [26, 16.4],
    [21, 19.6],
    [26, 19.6],
  ] as const) {
    parts.cyl(0.12, 0.12, 3.6, C.steel, x, 0, z, { finish: 'metal', segments: 8 });
  }
  parts.box(4.6, 0.2, 0.9, C.pad, 23.5, 0, 18);
  for (const x of [22.2, 24.8]) {
    parts.box(0.7, 1.5, 0.5, C.tank, x, 0.2, 18);
    parts.box(0.72, 0.18, 0.52, C.machineDark, x, 1.7, 18);
    parts.rod([x + 0.3, 1.1, 18.2], [x + 0.45, 0.6, 18.35], 0.035, C.graphite, { segments: 4 });
  }
  // A car at the pump.
  parts.group(23.6, 0, 19.75, () => {
    parts.box(3.6, 0.7, 1.6, C.truck, 0, 0.3, 0);
    parts.box(2.0, 0.62, 1.42, C.truck, -0.25, 1.0, 0);
    parts.box(1.85, 0.42, 1.45, C.graphite, -0.25, 1.08, 0);
    for (const a of [-1.15, 1.15]) {
      for (const b of [-0.78, 0.78])
        parts.cyl(0.34, 0.34, 0.26, C.graphite, a, 0.21, b, {
          rx: Math.PI / 2,
          finish: 'matte',
          segments: 10,
        });
    }
  });
  // The station's shop.
  parts.box(3.2, 2.0, 2.2, C.wall, 30.6, 0, 20.6);
  parts.box(3.25, 0.25, 2.25, C.roof, 30.6, 1.75, 20.6, { finish: 'matte' });
  parts.box(1.6, 0.8, 0.05, C.graphite, 30.6, 0.6, 21.72);
  // The tanks buried under the station, on the cut face, full of fuel.
  for (const x of [22.0, 25.6]) faceStrip(parts, x - 0.9, -0.15, -1.25, 0.13, C.graphite, 0.06);
  const root = parts.finish();
  const tankShape = (w: number, h: number, r: number) => {
    const s = new Shape();
    const [x0, y0] = [-w / 2, -h / 2];
    s.moveTo(x0 + r, y0);
    s.lineTo(x0 + w - r, y0);
    s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x0 + w, y0 + h - r);
    s.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x0 + r, y0 + h);
    s.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x0, y0 + r);
    s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
    return new ShapeGeometry(s, 6);
  };
  const wallMaterial = finishes.track(
    new MeshStandardMaterial({ color: new Color(C.graphite), roughness: 0.8 }),
  );
  const fuelMaterial = finishes.track(
    new MeshStandardMaterial({ color: new Color(C.fuel), roughness: 0.5 }),
  );
  for (const x of [22.0, 25.6]) {
    const wall = new Mesh(tankShape(3.24, 1.22, 0.58), wallMaterial);
    wall.position.set(x, -1.75, FACE + 0.02);
    const fuel = new Mesh(tankShape(3.0, 1.05, 0.5), fuelMaterial);
    fuel.position.set(x, -1.75, FACE + 0.05);
    root.add(wall, fuel);
  }
  // The pumps' screens, and the fuel flowing from the nozzle while the stop is open.
  const screens = finishes.track(glowing(WORLD_COLORS.window, 0));
  for (const x of [22.2, 24.8]) {
    const s = new Mesh(new BoxGeometry(0.46, 0.3, 0.04), screens);
    s.position.set(x, 1.35, 18.27);
    root.add(s);
  }
  const drops = new InstancedMesh(
    new IcosahedronGeometry(0.07, 1),
    finishes.track(new MeshStandardMaterial({ color: new Color(C.fuel), roughness: 0.4 })),
    5,
  );
  drops.frustumCulled = false;
  root.add(drops);
  const m = new Matrix4();
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);
  const v = new Vector3();
  return {
    id: 'pump',
    root,
    finishes,
    hits: [
      hit(23.5, 2.2, 18, 7.4, 4.8, 5.6),
      hit(23.8, -1.75, 24, 7.8, 1.8, 1.2),
      hit(30.6, 1.1, 20.6, 3.4, 2.4, 2.4),
    ],
    view: { from: [25, 9, 38], to: [22.5, 1.5, 19.5] },
    focus: [],
    label: { at: [23.5, 4.6, 18] },
    details: [{ key: 'tanks', at: [23.8, -3.05, FACE], facing: FRONT }],
    pops: [],
    animate({ time, open }) {
      const on = open > 0.05;
      // A slow blink: well under three flashes a second.
      screens.emissiveIntensity = on ? 0.5 + 0.4 * (Math.sin(time * 3) > 0 ? 1 : 0) : 0.1;
      drops.visible = on;
      if (!on) return;
      for (let i = 0; i < 5; i++) {
        const p = (time * 0.9 + i / 5) % 1;
        v.set(22.65 + 0.25 * p, 0.6 - p * 0.05 + Math.sin(p * Math.PI) * 0.15, 18.4 + 0.6 * p);
        drops.setMatrixAt(i, m.compose(v, q, one));
      }
      drops.instanceMatrix.needsUpdate = true;
    },
  };
}
