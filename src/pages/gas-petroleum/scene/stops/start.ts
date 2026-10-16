/**
 * The shared start: how oil and gas form, where they collect, finding and drilling for them, and
 * lifting them up the wells to the separator, where the paths fork. Machines are neutral; the
 * layers and what fills them carry the only color.
 */
import {
  Color,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
} from 'three';
import { DIORAMA_COLORS as C, WORLD_COLORS } from '../../../../design/tokens.ts';
import { Parts, createFinishes } from '../build.ts';
import { faceStrip, pad } from '../kit.ts';
import { FACE, SITE, boundary } from '../layout.ts';
import { hit, type StopModel } from '../stop.ts';
import { TimeLapse } from '../timelapse.ts';

const FRONT = [0, 0, 1] as const;

/** The stop's materials and a builder for its parts. */
function start() {
  const finishes = createFinishes();
  return { finishes, parts: new Parts(finishes) };
}

export function formation(timelapse: { current: TimeLapse | null }): StopModel {
  const { finishes, parts } = start();
  // Fossil specks in the source rock, on the cut face.
  const specks: [number, number][] = [
    [-41, -13.1],
    [-40, -12.6],
    [-39.1, -13.5],
    [-38.1, -12.9],
    [-37.2, -13.4],
    [-36.3, -12.8],
    [-34.9, -13.2],
  ];
  specks.forEach(([x, y], i) => {
    if (i % 2)
      parts.torus(0.2, 0.07, C.fossil, x, y, FACE + 0.04, {
        cast: false,
        finish: 'matte',
        segments: 10,
      });
    else
      parts.cyl(0.22, 0.22, 0.04, C.fossil, x, y, FACE + 0.01, {
        rx: Math.PI / 2,
        cast: false,
        finish: 'matte',
        segments: 8,
      });
  });
  const root = parts.finish();
  // The glass column that replays how the layers formed.
  timelapse.current = new TimeLapse(root);
  return {
    id: 'formation',
    root,
    finishes,
    hits: [hit(-38, -13, 24, 8, 2.8, 1.2), hit(-47.5, -7.5, 18, 5, 17.5, 5)],
    view: { from: [-67, 1, 61], to: [-42, -7, 17] },
    focus: [],
    label: { at: [-47.5, 2.4, 18] },
    details: [{ key: 'source', at: [-38, -15.1, FACE], facing: FRONT }],
    pops: [],
    animate({ dt }) {
      timelapse.current?.update(dt);
    },
  };
}

export function reservoir(): StopModel {
  const { finishes, parts } = start();
  const root = parts.finish();
  // A magnifier on a stick: sand grains with oil in the gaps between them.
  const lens = new Object3D();
  lens.position.set(-38, -11.4, 27.4);
  const inner = new Object3D();
  inner.scale.setScalar(0.78);
  lens.add(inner);
  const lensParts = new Parts(finishes);
  lensParts.torus(2.25, 0.16, C.graphite, 0, 0, 0, { cast: false, segments: 30 });
  const sands = [C.sand, C.sandDark, C.fossil, C.sand];
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996;
    const rr = 1.85 * Math.sqrt((i + 0.5) / 26);
    lensParts.ball(
      0.42 + (i % 4) * 0.05,
      sands[i % 4] ?? C.sand,
      Math.cos(a) * rr,
      Math.sin(a) * rr,
      0.2,
      {
        cast: false,
        finish: 'matte',
        segments: 6,
      },
    );
  }
  inner.add(lensParts.finish());
  const oil = new Mesh(
    new RingGeometry(0, 2.2, 30),
    new MeshStandardMaterial({ color: new Color(C.oilZone), roughness: 0.4 }),
  );
  oil.position.z = -0.05;
  inner.add(oil);
  const stickParts = new Parts(finishes);
  stickParts.rod([-37.2, -9.7, 27.4], [-34.6, -6.45, FACE + 0.05], 0.05, C.graphite, {
    cast: false,
  });
  const stick = stickParts.finish();
  root.add(lens, stick);
  return {
    id: 'reservoir',
    root,
    finishes,
    hits: [hit(-28, -6.4, 24, 22, 4.4, 1.2)],
    view: { from: [-27, -1, 62], to: [-28, -7, 24] },
    focus: [],
    label: { at: [-24, -3.6, 24.4], facing: FRONT },
    details: [
      { key: 'gas', at: [-28, -5.55, FACE], swatch: C.gasZone, facing: FRONT },
      { key: 'oil', at: [-35.2, -6.5, FACE], swatch: C.oilZone, facing: FRONT },
      { key: 'water', at: [-19.5, -7.9, FACE], swatch: C.waterZone, facing: FRONT },
      { key: 'cap', at: [-21.5, -5.3, FACE], swatch: C.capRock, facing: FRONT },
      { key: 'zoom', at: [-38, -13.6, 27.4] },
    ],
    pops: [lens, stick],
  };
}

export function drilling(): StopModel {
  const { finishes, parts } = start();
  const rx = -21;
  const rz = 22.2;
  pad(parts, 6.4, 3.4, rx, rz);
  // The substructure, the drill floor and the derrick.
  for (const [a, b] of [
    [-1.5, -1.3],
    [1.5, -1.3],
    [-1.5, 1.3],
    [1.5, 1.3],
  ] as const) {
    parts.box(0.3, 2.2, 0.3, C.machineDark, rx + a, 0, rz + b);
    parts.rod([rx + a, 2.5, rz + b], [rx + a * 0.25, 11.4, rz + b * 0.25], 0.09, C.machine, {
      segments: 6,
    });
  }
  parts.box(3.6, 0.3, 3.0, C.machineDark, rx, 2.2, rz);
  const top = 11.4;
  for (const y of [4.6, 7.0, 9.3]) {
    const f = 1 - ((y - 2.5) / (top - 2.5)) * 0.75;
    const c = [
      [-1.5 * f, -1.3 * f],
      [1.5 * f, -1.3 * f],
      [1.5 * f, 1.3 * f],
      [-1.5 * f, 1.3 * f],
    ] as const;
    c.forEach((p, i) => {
      const q = c[(i + 1) % 4] ?? p;
      parts.rod([rx + p[0], y, rz + p[1]], [rx + q[0], y, rz + q[1]], 0.05, C.machine, {
        segments: 4,
      });
    });
  }
  parts.box(0.9, 0.6, 0.9, C.machineDark, rx, top, rz);
  // The top drive slides down as the pipe turns and the hole deepens.
  const drive = parts.moving(rx, 7.2, rz, () => {
    parts.box(0.6, 0.8, 0.6, C.machineDark, 0, 0, 0);
  });
  const pipe = parts.moving(rx, 2.5, rz, () => {
    parts.cyl(0.08, 0.08, 1, C.steel, 0, 0, 0, { finish: 'metal', segments: 6 });
  });
  parts.box(2.2, 1.6, 1.6, C.tank, rx - 4.2, 0, rz + 0.6); // the doghouse
  parts.box(2.2, 1.1, 1.3, C.machine, rx + 3.6, 0, rz + 0.8); // mud tanks
  parts.box(2.2, 1.1, 1.3, C.machine, rx + 3.6, 0, rz - 0.8);
  for (let i = 0; i < 5; i++) {
    const y = 0.42 + (i % 2) * 0.16;
    parts.rod(
      [rx - 3.2, y, rz - 2.2 - i * 0.18],
      [rx + 2.8, y, rz - 2.2 - i * 0.18],
      0.08,
      C.steel,
      {
        finish: 'metal',
        segments: 6,
      },
    );
  }

  // The well on the cut face: cement, then steel casing, then the open hole, turning to run
  // along the rock, where the cracks are held open by sand.
  faceStrip(parts, rx, -0.15, -4.4, 0.62, C.concrete, 0, 'matte');
  faceStrip(parts, rx, -0.15, -4.4, 0.38, C.steel, 0.02, 'metal');
  faceStrip(parts, rx, -0.15, -11.2, 0.16, C.graphite, 0.04);
  const yH = -12.85;
  const bend = [
    [-21, -11.2],
    [-20.85, -11.95],
    [-20.45, -12.45],
    [-19.85, -12.75],
    [-19.2, -12.85],
  ] as const;
  for (let i = 0; i < bend.length - 1; i++) {
    const [a, b] = [bend[i], bend[i + 1]];
    if (!a || !b) continue;
    parts.rod([a[0], a[1], FACE + 0.05], [b[0], b[1], FACE + 0.05], 0.08, C.graphite, {
      cast: false,
      segments: 5,
    });
  }
  parts.rod([-19.2, yH, FACE + 0.05], [-6.6, yH, FACE + 0.05], 0.08, C.graphite, {
    cast: false,
    segments: 5,
  });
  const bit = parts.moving(-6.3, yH, FACE + 0.08, () => {
    parts.cone(0.28, 0.55, C.steel, 0, 0, 0, {
      rz: -Math.PI / 2,
      cast: false,
      finish: 'metal',
      segments: 6,
    });
  });
  const fracs = [-17.4, -14.9, -12.4, -9.9, -7.6].map((x, i) =>
    parts.moving(x, yH, FACE + 0.06, () => {
      for (const [tilt, len] of [
        [0, 1],
        [0.5, 0.75],
        [-0.45, 0.8],
      ] as const) {
        parts.cone(0.09, 1.9 * len, C.sand, 0, 0, 0, {
          rz: tilt + (i % 2 ? 0.1 : -0.1),
          cast: false,
          segments: 4,
        });
      }
    }),
  );

  // A seismic truck sends sound down; sensors on the ground listen for the echoes.
  const tx = -10.5;
  const tz = 21.8;
  parts.group(tx, 0, tz, () => {
    parts.box(3.6, 0.5, 1.6, C.truck, 0, 0.35, 0);
    parts.box(1.2, 1.1, 1.6, C.truck, 1.3, 0.85, 0);
    parts.box(0.5, 0.45, 1.5, C.graphite, 1.62, 1.35, 0);
    parts.box(1.4, 0.9, 1.4, C.machineDark, -0.6, 0.85, 0);
    parts.box(1.2, 0.12, 1.2, C.graphite, -0.6, 0.06, 0);
    for (const [a, b] of [
      [-1.2, -0.8],
      [-1.2, 0.8],
      [1.2, -0.8],
      [1.2, 0.8],
    ] as const) {
      parts.cyl(0.33, 0.33, 0.25, C.graphite, a, 0.2, b, { rx: Math.PI / 2, segments: 10 });
    }
  });
  for (const x of [-16, -13.2, -7.8, -5, -2.4])
    parts.cone(0.13, 0.4, C.machine, x, 0.2, 23.4, { segments: 5 });
  const root = parts.finish();
  // Rings of sound going down from the truck, and echoes coming back up off the cap rock.
  const ringMaterial = (hex: string) =>
    new MeshBasicMaterial({
      color: new Color(hex),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
    });
  const rings = [0, 1, 2].map(() => {
    const m = new Mesh(
      new RingGeometry(0.92, 1, 40, 1, Math.PI, Math.PI),
      ringMaterial(WORLD_COLORS.trim),
    );
    m.position.set(tx - 0.6, -0.15, FACE + 0.1);
    root.add(m);
    return m;
  });
  const echoes = [0, 1].map(() => {
    const m = new Mesh(new RingGeometry(0.9, 1, 32, 1, 0, Math.PI), ringMaterial(C.fossil));
    m.position.set(tx - 0.6, boundary(3, tx), FACE + 0.1);
    root.add(m);
    return m;
  });
  let depth = 0;
  return {
    id: 'drilling',
    root,
    finishes,
    hits: [
      hit(rx, 5.6, rz, 5, 11.6, 4),
      hit(-13.5, -12.6, 24, 16, 2.4, 1.2),
      hit(tx, 1, tz, 4.2, 2.4, 2.4),
    ],
    view: { from: [-12, 6, 67], to: [-15, -2.5, 21] },
    focus: [],
    label: { at: [-21, 12.4, 22] },
    details: [
      { key: 'groundwater', at: [-13.5, -2.05, FACE], swatch: C.aquifer, facing: FRONT },
      { key: 'casing', at: [-21, -4.9, FACE], facing: FRONT },
      { key: 'fractures', at: [-12.4, -14.7, FACE], facing: FRONT },
      { key: 'seismic', at: [tx - 0.6, -9.6, FACE], facing: FRONT },
    ],
    pops: [],
    animate({ time, dt, open }) {
      const on = open > 0.01;
      rings.forEach((m, i) => {
        const p = (time * 0.32 + i / 3) % 1;
        m.visible = on;
        m.scale.setScalar(0.4 + p * 11);
        m.material.opacity = on ? (1 - p) * 0.75 * open : 0;
      });
      echoes.forEach((m, i) => {
        const p = (time * 0.32 + 0.5 + i / 2) % 1;
        m.visible = on;
        m.scale.setScalar(0.3 + p * 7);
        m.material.opacity = on ? (1 - p) * 0.8 * open : 0;
      });
      if (!on) return;
      pipe.rotation.y += dt * 3;
      bit.rotation.x += dt * 8;
      depth = (depth + dt * 0.25) % 1;
      drive.position.y = 7.6 - depth * 3.4;
      // The pipe runs from the floor up to the bottom of the top drive.
      const length = drive.position.y - 0.4 - 2.5;
      pipe.scale.y = Math.max(0.01, length);
      fracs.forEach((g, i) => {
        g.scale.y = 0.75 + 0.35 * (0.5 + 0.5 * Math.sin(time * 2.5 - i * 0.7));
      });
    },
  };
}

export function lifting(): StopModel {
  const { finishes, parts } = start();
  // The pump jack over the oil well.
  const wx = SITE.oilWell.x;
  const wz = SITE.oilWell.z;
  const px = wx - 2.2;
  const py = 3.25;
  pad(parts, 6.6, 2.0, px, 24 - 1.05);
  parts.box(5.2, 0.3, 1.0, C.machineDark, px - 0.2, 0.06, wz);
  parts.rod([px - 0.5, 0.35, wz - 0.45], [px, py, wz], 0.1, C.machineDark, { segments: 5 });
  parts.rod([px - 0.5, 0.35, wz + 0.45], [px, py, wz], 0.1, C.machineDark, { segments: 5 });
  parts.rod([px + 0.6, 0.35, wz], [px, py, wz], 0.1, C.machineDark, { segments: 5 });
  parts.box(1.0, 0.9, 0.8, C.machine, px - 2.2, 0.36, wz); // gearbox
  parts.box(0.8, 0.6, 0.6, C.machineDark, px - 3.1, 0.36, wz - 0.4); // motor
  parts.cyl(0.28, 0.32, 0.9, C.steel, wx, 0, wz, { finish: 'metal' }); // wellhead
  const beam = parts.moving(px, py, wz, () => {
    parts.box(4.4, 0.32, 0.36, C.graphite, 0, -0.16, 0);
    parts.box(0.5, 1.2, 0.5, C.machineDark, 2.1, -0.75, 0); // the horse head
    parts.box(0.3, 0.5, 0.5, C.graphite, -2.05, -0.55, 0);
  });
  const crank = parts.moving(px - 2.2, 1.5, wz, () => {
    parts.box(0.22, 1.5, 0.16, C.machine, 0, -0.75, 0.55);
    parts.box(0.22, 1.5, 0.16, C.machine, 0, -0.75, -0.55);
    parts.box(0.9, 0.6, 0.2, C.machineDark, 0, -1.3, 0.55);
    parts.box(0.9, 0.6, 0.2, C.machineDark, 0, -1.3, -0.55);
  });
  const rodLift = parts.moving(wx, 0.9, wz, () => {
    parts.cyl(0.05, 0.05, 1, C.steel, 0, 0, 0, { finish: 'metal', segments: 5 });
  });

  // The gas wellhead on the crest of the dome: gas flows up on its own.
  const gx = SITE.gasWell.x;
  const gz = SITE.gasWell.z;
  pad(parts, 2, 1.6, gx, gz);
  parts.cyl(0.38, 0.42, 0.45, C.steel, gx, 0, gz, { finish: 'metal' });
  parts.box(0.32, 1.4, 0.32, C.steel, gx, 0.45, gz, { finish: 'metal' });
  parts.rod([gx - 0.6, 1.25, gz], [gx + 0.6, 1.25, gz], 0.1, C.steel, { finish: 'metal' });
  for (const [x, y, z] of [
    [gx, 1.95, gz + 0.3],
    [gx - 0.62, 1.25, gz + 0.26],
    [gx + 0.62, 1.25, gz + 0.26],
  ] as const) {
    parts.torus(0.17, 0.05, C.graphite, x, y, z, { segments: 12 });
  }

  // Both wells on the cut face.
  for (const [x, deep] of [
    [wx, -6.65],
    [gx, -5.5],
  ] as const) {
    faceStrip(parts, x, -0.15, -4.2, 0.6, C.concrete);
    faceStrip(parts, x, -0.15, -4.2, 0.36, C.steel, 0.02);
    faceStrip(parts, x, -0.15, deep, 0.16, C.graphite, 0.04);
  }

  // The separator: a see-through shell with water, oil and gas settled inside, by weight.
  const { x: sx, y: sy, z: sz, len } = SITE.separator;
  const wt = SITE.waterTank;
  pad(parts, 8, 3.6, sx - 0.6, sz - 0.2);
  for (const d of [-1.6, 1.6]) parts.box(0.4, 0.6, 1.4, C.machineDark, sx + d, 0.05, sz);
  parts.ball(0.95, C.steel, sx - len / 2, sy, sz, { finish: 'metal' });
  parts.ball(0.95, C.steel, sx + len / 2, sy, sz, { finish: 'metal' });
  for (const [a, b, hex] of [
    [-0.86, -0.36, C.producedWater],
    [-0.36, 0.08, C.oilZone],
    [0.08, 0.84, C.gasZone],
  ] as const) {
    const r = 0.86;
    const w = (y: number) => Math.sqrt(Math.max(0, r * r - y * y));
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const y = a + ((b - a) * i) / 8;
      pts.push([-w(y), y]);
    }
    for (let i = 8; i >= 0; i--) {
      const y = a + ((b - a) * i) / 8;
      pts.push([w(y), y]);
    }
    parts.group(sx - len / 2, sy, sz, () => {
      parts.extrude(pts, len, hex, 0, { cast: false, ry: Math.PI / 2 });
    });
  }
  // Outlets: gas leaves the top, oil the far end, water the bottom, each down to the ground where
  // its route starts (routes.ts uses the same offsets).
  const gasOut = [sx + 1.6, sz - 1.3] as const;
  const oilOut = [sx + len / 2 + 1.6, sz] as const;
  parts.rod([gasOut[0], sy + 0.9, sz], [gasOut[0], sy + 1.45, sz], 0.12, C.steel, {
    finish: 'metal',
  });
  parts.rod([gasOut[0], sy + 1.45, sz], [gasOut[0], sy + 1.45, gasOut[1]], 0.12, C.steel, {
    finish: 'metal',
  });
  parts.rod([gasOut[0], sy + 1.45, gasOut[1]], [gasOut[0], 0.05, gasOut[1]], 0.12, C.steel, {
    finish: 'metal',
  });
  parts.rod([sx + len / 2 + 0.85, sy, sz], [oilOut[0], sy, sz], 0.12, C.steel, { finish: 'metal' });
  parts.rod([oilOut[0], sy, sz], [oilOut[0], 0.05, sz], 0.12, C.steel, { finish: 'metal' });
  parts.rod([sx - 1.5, sy - 0.85, sz - 0.5], [wt.x + 0.6, 0.5, wt.z + 0.5], 0.1, C.steel, {
    finish: 'metal',
  });
  parts.cyl(1.0, 1.0, 1.9, C.tank, wt.x, 0, wt.z, { segments: 20 });
  parts.cyl(1.02, 1.02, 0.2, C.producedWater, wt.x, 1.3, wt.z, { segments: 20 });
  const root = parts.finish();
  // The shell, open at the ends under its caps, so what's inside shows through it.
  const glass = new Mesh(
    new CylinderGeometry(0.95, 0.95, len, 24, 1, true),
    new MeshStandardMaterial({
      color: new Color(C.shell),
      roughness: 0.2,
      transparent: true,
      opacity: 0.3,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  glass.rotation.z = Math.PI / 2;
  glass.position.set(sx, sy, sz);
  root.add(glass);

  return {
    id: 'lifting',
    root,
    finishes,
    hits: [
      hit(px - 0.2, 2.1, wz, 7, 4.6, 2.4),
      hit(gx, 1, gz, 1.8, 2.4, 1.8),
      hit(sx + 0.2, 1.4, sz - 0.1, 8.8, 3.2, 3.4),
      hit(wt.x, 1, wt.z, 2.4, 2.2, 2.4),
    ],
    view: { from: [-22, 13, 44], to: [-31, -0.5, 17] },
    // The fork: pulled back over the split, so both ways on are in view, the gas plant up the hill
    // and the crude oil train toward the refinery, with room for their labels.
    focus: [
      [-15, 8.6, -11],
      [-15, 5, 15.5],
    ],
    label: { at: [-28, 3.2, 13.5] },
    details: [
      { key: 'pumpJack', at: [px - 0.4, 5.1, wz] },
      { key: 'gasWell', at: [gx, 2.7, gz + 0.2] },
      { key: 'water', at: [wt.x, 2.6, wt.z], swatch: C.producedWater },
      { key: 'separator', at: [sx + 2.4, 2.7, sz + 1.2] },
    ],
    pops: [],
    animate({ dt, open }) {
      // The pump jack nods all the time, faster while its stop is open.
      const speed = 0.45 + 1.25 * open;
      crank.userData.a = Number(crank.userData.a ?? 0) + dt * speed;
      const a = Number(crank.userData.a);
      crank.rotation.z = a;
      const tilt = 0.24 * Math.sin(a);
      beam.rotation.z = tilt;
      const head = py + Math.sin(tilt) * 2.1 - 0.75;
      rodLift.scale.y = Math.max(0.2, head - 0.9);
    },
  };
}
