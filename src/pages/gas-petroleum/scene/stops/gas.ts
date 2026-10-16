/**
 * The natural gas path: the processing plant, the long-distance pipeline and its compressor
 * station, storage for winter and the LNG terminal, the city gate, and the homes, plant and
 * factory that use the gas. Machines are neutral; where a gas line or its marker shows above
 * ground, it carries natural gas's APWA yellow.
 */
import {
  BoxGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Shape,
  ShapeGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { APWA } from '../../../../design/apwa.ts';
import { DIORAMA_COLORS as C, WORLD_COLORS } from '../../../../design/tokens.ts';
import { tint } from '../../../../kit3d/materials.ts';
import { WINDOW_GLOW } from '../../../../kit3d/world.ts';
import { Parts, createFinishes } from '../build.ts';
import { Puffs, flame, glowing, pad } from '../kit.ts';
import { BACK, HARBOR, SITE } from '../layout.ts';
import { hit, type StopModel } from '../stop.ts';

const BEHIND = [0, 0, -1] as const;
/** A gas line or marker above ground: natural gas's yellow, as a teaching tint. */
const GAS_LINE = tint(C.steel, APWA.yellow.fill, 0.7);

function start() {
  const finishes = createFinishes();
  return { finishes, parts: new Parts(finishes) };
}

/** A roof with its ridge along z, `w` across and `h` high, over (x, y, z), `l` long: matte, as roofs are. */
function roof(
  parts: Parts,
  w: number,
  h: number,
  l: number,
  hex: string,
  x: number,
  y: number,
  z: number,
  ridgeAlongX = false,
) {
  const tri: [number, number][] = [
    [-w / 2, 0],
    [w / 2, 0],
    [0, h],
  ];
  if (ridgeAlongX) {
    parts.group(x - l / 2, y, z, () => {
      parts.extrude(tri, l, hex, 0, { ry: Math.PI / 2, finish: 'matte' });
    });
  } else {
    parts.group(x, y, z, () => {
      parts.extrude(tri, l, hex, -l / 2, { finish: 'matte' });
    });
  }
}

/** Fan blades turning over a cooler or compressor. */
function fans(parts: Parts, at: readonly (readonly [number, number, number])[], blades: number) {
  return at.map(([x, y, z]) =>
    parts.moving(x, y, z, () => {
      for (let i = 0; i < blades; i++) {
        parts.group(
          0,
          0,
          0,
          () => {
            parts.box(0.95, 0.04, 0.2, C.graphite, 0, 0, 0);
          },
          (i * Math.PI * 2) / blades / 2,
        );
      }
    }),
  );
}

export function gasPlant(): StopModel {
  const { finishes, parts } = start();
  pad(parts, 11.2, 8.6, -13, -9);
  // Towers that dry the gas and take out its impurities.
  parts.cyl(0.72, 0.72, 6.2, C.tank, -15.6, 0, -11.7, { segments: 18 });
  parts.ball(0.72, C.tank, -15.6, 6.2, -11.7, { segments: 18 });
  parts.cyl(0.58, 0.58, 4.6, C.tank, -13.4, 0, -11.7, { segments: 18 });
  parts.ball(0.58, C.tank, -13.4, 4.6, -11.7, { segments: 18 });
  // Tanks for the propane and butane taken out of it.
  parts.bullet(3.2, 0.55, C.tank, -9.9, 0.85, -11.2);
  parts.bullet(3.2, 0.55, C.tank, -9.9, 0.85, -12.6);
  for (const x of [-11.2, -8.6]) parts.box(0.3, 0.4, 2.2, C.machineDark, x, 0, -11.9);
  // The pipe rack.
  for (const x of [-17, -14.5, -12, -9.5]) parts.box(0.18, 1.7, 0.18, C.steel, x, 0, -10.1);
  parts.rod([-17.2, 1.7, -10.1], [-8.6, 1.7, -10.1], 0.12, C.steel, { finish: 'metal' });
  parts.rod([-17.2, 1.45, -10.1], [-8.6, 1.45, -10.1], 0.1, GAS_LINE);
  // The control building and the cooler.
  parts.box(3, 1.8, 2.2, C.wall, -15.3, 0, -6.4);
  parts.box(3.2, 0.2, 2.4, C.roof, -15.3, 1.8, -6.4, { finish: 'matte' });
  parts.box(2.6, 1.2, 1.8, C.machine, -11.2, 0, -6.4);
  const blades = fans(
    parts,
    [
      [-11.85, 1.25, -6.4],
      [-10.55, 1.25, -6.4],
    ],
    2,
  );
  // The flare stack, which burns off gas safely.
  parts.cyl(0.18, 0.26, 8, C.steel, -19.6, 0, -12.6, { finish: 'metal', segments: 8 });
  const root = parts.finish();
  const fire = flame(root, finishes, [-19.6, 8, -12.6]);
  return {
    id: 'gas-plant',
    root,
    finishes,
    hits: [hit(-13, 3.1, -9.2, 10.6, 6.6, 8.4), hit(-19.6, 4.6, -12.6, 1.4, 9.6, 1.4)],
    view: { from: [-1, 17, 13], to: [-14, 1.5, -9.5] },
    focus: [],
    label: { at: [-15, 7, -11] },
    details: [
      { key: 'propane', at: [-9.9, 2.3, -11.9] },
      { key: 'flare', at: [-19.6, 10.1, -12.6] },
      { key: 'clean', at: [-6.4, 1.1, -8.4] },
    ],
    pops: [],
    animate({ time, dt, open }) {
      // The flare always burns; it flares up while its stop is open.
      const lift =
        (0.85 + Math.sin(time * 5) * 0.05) * (1 - open) +
        (1.15 + Math.sin(time * 13) * 0.18 + Math.sin(time * 7.3) * 0.1) * open;
      fire.scale.set(1 + Math.sin(time * 9) * 0.06, lift, 1);
      for (const f of blades) f.rotation.y += dt * 9 * (0.3 + 0.7 * open);
    },
  };
}

export function pipeline(): StopModel {
  const { finishes, parts } = start();
  const cx = 2;
  const cz = -12.6;
  pad(parts, 6.6, 5.4, cx, -11.9);
  // The compressor station.
  parts.box(4.4, 2.4, 3, C.wall, cx, 0, cz);
  parts.box(4.6, 0.25, 3.2, C.roof, cx, 2.4, cz, { finish: 'matte' });
  for (const x of [cx - 1.1, cx + 1.1])
    parts.cyl(0.55, 0.55, 0.2, C.steel, x, 2.65, cz, { finish: 'metal', segments: 16 });
  const blades = fans(
    parts,
    [
      [cx - 1.1, 2.9, cz],
      [cx + 1.1, 2.9, cz],
    ],
    3,
  );
  parts.cyl(0.2, 0.2, 2.2, C.steel, cx + 1.9, 2.4, cz - 1.1, { finish: 'metal', segments: 8 });
  // The station's piping rises out of the buried line and into the compressors.
  const lz = SITE.gasMain.z - 0.2;
  const mz = SITE.gasMain.z + 0.85;
  for (const x of [cx - 1.4, cx + 1.4]) {
    parts.rod([x, 0, lz], [x, 1.1, lz], 0.16, GAS_LINE);
    parts.rod([x, 1.1, lz], [x, 1.1, cz + 1.5], 0.16, GAS_LINE);
    parts.ball(0.17, GAS_LINE, x, 1.1, lz, { segments: 8 });
  }
  parts.rod([cx - 2.6, 0.45, lz], [cx + 2.6, 0.45, lz], 0.34, GAS_LINE, { segments: 16 });
  for (const x of [cx - 2.1, cx + 2.1]) parts.box(0.3, 0.3, 0.8, C.machineDark, x, 0, lz);
  // Marker posts along the buried pipeline: in the field, they're yellow for gas.
  for (const x of [-4.5, 8.2]) {
    parts.cyl(0.07, 0.07, 1.0, APWA.yellow.fill, x, 0, mz, { segments: 6 });
    parts.cyl(0.14, 0.14, 0.22, C.graphite, x, 0.95, mz, { segments: 6 });
  }
  const root = parts.finish();
  return {
    id: 'pipeline',
    root,
    finishes,
    hits: [hit(cx, 1.6, -11.8, 6, 3.6, 5.6)],
    view: { from: [11, 12, 4], to: [1.5, 1, -11.5] },
    focus: [],
    label: { at: [2, 4.6, -12.5] },
    details: [
      { key: 'compressors', at: [cx, 3.6, cz + 1.4] },
      { key: 'markers', at: [-4.5, 1.6, mz] },
    ],
    pops: [],
    animate({ dt, open }) {
      for (const f of blades) f.rotation.y += dt * 10 * (0.25 + 0.75 * open);
    },
  };
}

export function storageLng(): StopModel {
  const { finishes, parts } = start();
  // Underground storage: a well down into porous rock near the back of the block.
  const { x: wx, z: wz } = SITE.storage;
  pad(parts, 3.2, 2.6, wx, wz);
  parts.cyl(0.3, 0.34, 0.5, C.steel, wx, 0, wz, { finish: 'metal' });
  parts.box(0.28, 1.1, 0.28, C.steel, wx, 0.5, wz, { finish: 'metal' });
  parts.torus(0.16, 0.05, C.graphite, wx, 1.35, wz + 0.25, { segments: 12 });
  parts.box(1.8, 1.2, 1.4, C.wall, wx + 1.6, 0, wz + 0.2);
  parts.box(1.9, 0.14, 1.5, C.roof, wx + 1.6, 1.2, wz + 0.2, { finish: 'matte' });
  // The well on the back face, and the gas held in the rock, which swells and shrinks with the
  // seasons.
  parts.box(0.55, 7.6, 0.06, C.concrete, wx, -7.75, BACK, { cast: false });
  parts.box(0.16, 7.6, 0.06, C.graphite, wx, -7.75, BACK - 0.02, { cast: false });

  // The LNG terminal, where gas is chilled into a liquid.
  pad(parts, 10.8, 6, 19.4, -19.8);
  for (const x of [17.4, 21.6]) {
    parts.cyl(1.8, 1.8, 3.2, C.tank, x, 0, -19.6, { segments: 24 });
    parts.dome(1.8, 0.4, C.tank, x, 3.2, -19.6, { segments: 24 });
  }
  parts.box(2.2, 1.6, 1.8, C.machine, 14, 0, -20.8);
  parts.cyl(0.3, 0.3, 3.4, C.machine, 13.3, 0, -22.0, { segments: 10 });
  parts.cyl(0.3, 0.3, 2.8, C.machine, 14.7, 0, -22.0, { segments: 10 });
  parts.rod([15.2, 1.2, -20.8], [16.2, 1.2, -19.9], 0.12, GAS_LINE);
  // The jetty out to the ship.
  parts.box(1.1, 0.18, 6.6, C.brick, 25.2, -0.05, -26.0);
  for (const z of [-23.6, -25.8, -28.0])
    parts.cyl(0.12, 0.12, 3.2, C.machineDark, 25.2, -3.2, z, { segments: 6 });
  parts.rod([25.2, 0.2, -28.6], [25.8, 1.6, -29.4], 0.07, C.steel, { finish: 'metal' });
  parts.rod([25.8, 1.6, -29.4], [26.2, 0.6, -30.6], 0.07, C.steel, { finish: 'metal' });
  // The LNG ship, riding gently at the jetty.
  const ship = parts.moving(27.6, HARBOR.water, -32.6, () => {
    parts.box(11.5, 1.45, 2.8, C.graphite, 0, -0.85, 0);
    parts.box(11.55, 0.38, 2.84, C.machineDark, 0, -0.85, 0);
    parts.cyl(1.62, 1.62, 1.45, C.graphite, 6.56, -0.85, 0, { ry: Math.PI / 2, segments: 3 });
    for (const x of [-2.0, 0.2, 2.4, 4.5]) {
      parts.cyl(0.98, 0.98, 0.3, C.machine, x, 0.6, 0, { segments: 16 });
      parts.dome(1.0, 1, C.tank, x, 0.9, 0, { segments: 16 });
    }
    parts.box(1.5, 1.7, 2.4, C.tank, -4.7, 0.6, 0);
    parts.cyl(0.28, 0.32, 0.9, C.machineDark, -5.1, 2.3, 0, { segments: 8 });
  });
  const root = parts.finish();
  const bubbleShape = new Shape();
  bubbleShape.absellipse(0, 0, 3.4, 0.72, 0, Math.PI * 2, false, 0);
  const bubble = new Mesh(
    new ShapeGeometry(bubbleShape, 24),
    finishes.track(new MeshBasicMaterial({ color: new Color(C.gasZone), side: DoubleSide })),
  );
  bubble.position.set(wx, -8.35, BACK - 0.03);
  bubble.rotation.y = Math.PI;
  root.add(bubble);
  return {
    id: 'storage-lng',
    root,
    finishes,
    hits: [
      hit(wx, 1, wz, 3.8, 2.4, 3.2),
      hit(wx, -8.3, -24, 8, 2.4, 1.2),
      hit(19.4, 2.1, -19.8, 10.6, 4.6, 5.6),
      hit(27.6, -0.2, -32.6, 13.6, 3.6, 3.4),
      hit(25.2, 0, -26, 1.8, 1.2, 7),
    ],
    view: { from: [-6, 12, -60], to: [14, -3, -23] },
    focus: [],
    label: { at: [19.5, 5.4, -19.5] },
    details: [
      { key: 'rock', at: [wx, -10.1, BACK], facing: BEHIND },
      { key: 'chilled', at: [14, 3.8, -21.0] },
      { key: 'ship', at: [27.6, 2.6, -32.6] },
      { key: 'well', at: [wx, 2.3, wz] },
    ],
    pops: [],
    animate({ time, open }) {
      ship.position.y = HARBOR.water + Math.sin(time * 1.1) * 0.06;
      ship.rotation.x = Math.sin(time * 0.9) * 0.015;
      const s = 1 - 0.15 * open + open * 0.25 * (0.5 + 0.5 * Math.sin(time * 1.2));
      bubble.scale.set(s, s, 1);
    },
  };
}

export function cityGate(): StopModel {
  const { finishes, parts } = start();
  const { x: cx, z: cz } = SITE.cityGate;
  pad(parts, 4.6, 4.6, cx, cz, C.pad);
  const corners = [
    [-2.2, -2.2],
    [2.2, -2.2],
    [2.2, 2.2],
    [-2.2, 2.2],
  ] as const;
  corners.forEach(([a, b], i) => {
    parts.box(0.1, 1.2, 0.1, C.steel, cx + a, 0, cz + b);
    const [c, d] = corners[(i + 1) % 4] ?? [a, b];
    for (const y of [0.55, 1.1])
      parts.rod([cx + a, y, cz + b], [cx + c, y, cz + d], 0.03, C.steel, { segments: 4 });
  });
  // The gas comes up out of the pipeline, through the regulator that lowers its pressure.
  parts.rod([cx - 1.5, 0, cz], [cx - 1.5, 1.0, cz], 0.2, GAS_LINE);
  parts.rod([cx - 1.5, 1.0, cz], [cx - 0.2, 1.0, cz], 0.2, GAS_LINE);
  parts.box(0.55, 0.6, 0.55, C.machineDark, cx - 0.2, 0.7, cz);
  parts.ball(0.22, C.machineDark, cx - 0.2, 1.42, cz, { segments: 8 });
  parts.rod([cx + 0.1, 1.0, cz], [cx + 1.4, 1.0, cz], 0.13, GAS_LINE);
  parts.rod([cx + 1.4, 1.0, cz], [cx + 1.4, 0, cz], 0.13, GAS_LINE);
  // The odorant tank, and the small line that adds the smell.
  parts.bullet(1.1, 0.34, C.tank, cx + 0.2, 0.6, cz + 1.5);
  parts.rod([cx + 0.6, 0.6, cz + 1.3], [cx + 0.6, 1.0, cz + 0.15], 0.04, C.steel, {
    finish: 'metal',
    segments: 5,
  });
  parts.box(1.2, 1.2, 1.1, C.wall, cx + 0.9, 0, cz - 1.5);
  parts.box(1.3, 0.12, 1.2, C.roof, cx + 0.9, 1.2, cz - 1.5, { finish: 'matte' });
  const root = parts.finish();
  const smell = new Puffs(root, finishes, 7, C.fossil, [cx + 0.6, 1.1, cz + 0.2], {
    rise: 2.2,
    spread: 0.5,
    cycle: 2.2,
  });
  return {
    id: 'city-gate',
    root,
    finishes,
    hits: [hit(cx, 1.2, cz, 4.8, 2.6, 4.8)],
    view: { from: [27, 10, 3], to: [17.5, 1, -8.5] },
    focus: [],
    label: { at: [17, 3.4, -9] },
    details: [
      { key: 'pressure', at: [cx - 0.6, 2.1, cz - 0.3] },
      { key: 'odorant', at: [cx + 0.6, 1.5, cz + 2.2] },
    ],
    pops: [],
    animate({ time, open }) {
      smell.update(time, open > 0.05);
    },
  };
}

export function gasUses(): StopModel {
  const { finishes, parts } = start();
  const houses = [
    [26, -4.4, 1],
    [30, -4.4, 1],
    [34, -4.4, 1],
    [38, -4.4, 1],
    [28, 2.4, -1],
    [32, 2.4, -1],
    [36, 2.4, -1],
    [40, 2.4, -1],
  ] as const;
  const windows: [number, number, number][] = [];
  houses.forEach(([x, z, f], i) => {
    parts.box(2.4, 1.7, 2.2, WORLD_COLORS.walls[i % WORLD_COLORS.walls.length] ?? C.wall, x, 0, z);
    roof(
      parts,
      2.7,
      1.0,
      2.9,
      WORLD_COLORS.roofs[i % WORLD_COLORS.roofs.length] ?? C.roof,
      x,
      1.7,
      z,
      true,
    );
    parts.box(0.32, 0.8, 0.32, C.brick, x + 0.7, 1.8, z - 0.3 * f);
    parts.box(0.5, 0.95, 0.06, WORLD_COLORS.trunk, x - 0.5, 0, z + 1.11 * f);
    windows.push([x + 0.45, 0.95, z + 1.11 * f]);
    // The gas meter, and the service line from the street.
    parts.box(0.22, 0.3, 0.16, C.steel, x + 1.25, 0.1, z + 0.5 * f);
    parts.rod([x + 1.25, 0.12, z + 0.5 * f], [x + 1.25, 0.12, SITE.street.z], 0.04, GAS_LINE, {
      cast: false,
      segments: 4,
    });
  });
  // The power plant.
  parts.box(5, 3, 4, C.wall, 35.6, 0, -16.8);
  parts.box(5.1, 0.3, 4.1, C.roof, 35.6, 3, -16.8, { finish: 'matte' });
  parts.box(1.6, 3.8, 2.4, C.machine, 38.8, 0, -16.6);
  parts.cyl(0.45, 0.55, 8.6, C.tank, 39.4, 0, -18.4, { segments: 12 });
  for (const [x, z] of [
    [33.2, -19.4],
    [34.4, -19.4],
  ] as const) {
    parts.box(0.9, 1.0, 0.8, C.machineDark, x, 0, z);
  }
  // Power lines from the plant to town.
  for (const [x, z] of [
    [33.6, -12.3],
    [31.4, -7.3],
  ] as const) {
    parts.cyl(0.06, 0.32, 4.6, C.machineDark, x, 0, z, { segments: 4 });
    parts.box(1.6, 0.1, 0.12, C.machineDark, x, 4.3, z);
  }
  for (const o of [-0.7, 0.7]) {
    parts.rod([35.6 + o, 3.3, -14.8], [33.6 + o, 4.38, -12.3], 0.025, C.graphite, {
      cast: false,
      segments: 3,
    });
    parts.rod([33.6 + o, 4.38, -12.3], [31.4 + o, 4.38, -7.3], 0.025, C.graphite, {
      cast: false,
      segments: 3,
    });
    parts.rod([31.4 + o, 4.38, -7.3], [30 + o, 1.7, -5.4], 0.025, C.graphite, {
      cast: false,
      segments: 3,
    });
  }
  // The factory, making fertilizer and plastics.
  parts.box(6, 2.2, 4, C.wall, 27.8, 0, -16.3);
  for (const d of [-2, 0, 2]) roof(parts, 2.0, 0.9, 4.0, C.roof, 27.8 + d, 2.2, -16.3);
  parts.cyl(0.3, 0.38, 4.6, C.machine, 25.4, 0, -17.6, { segments: 10 });
  for (const [x, z] of [
    [30.6, -14.6],
    [31.9, -14.6],
  ] as const) {
    parts.cyl(0.6, 0.6, 3.2, C.tank, x, 0, z, { segments: 16 });
    parts.cone(0.6, 0.6, C.machine, x, 3.5, z, { segments: 16 });
  }
  const root = parts.finish();
  // Windows that light up warmly at night, and while the homes are open to see.
  const glow = finishes.track(glowing(WORLD_COLORS.windowLit, 0));
  let night = 0;
  const panes = new Mesh(
    mergeGeometries(
      windows.map(([x, y, z]) => new BoxGeometry(0.55, 0.45, 0.06).translate(x, y, z)),
    ),
    glow,
  );
  root.add(panes);
  const steam = new Puffs(root, finishes, 6, WORLD_COLORS.trim, [39.4, 8.8, -18.4], {
    rise: 4,
    spread: 0.8,
    cycle: 3,
  });
  const smoke = new Puffs(root, finishes, 5, C.machine, [25.4, 4.8, -17.6], {
    rise: 3,
    spread: 0.6,
    cycle: 3.2,
  });
  return {
    id: 'gas-uses',
    root,
    finishes,
    hits: [
      ...houses.map(([x, z]) => hit(x, 1.3, z, 2.8, 2.9, 2.6)),
      hit(36.4, 2.4, -16.9, 7.4, 5, 5),
      hit(39.4, 4.6, -18.4, 1.6, 9.2, 1.6),
      hit(28.6, 1.7, -16.2, 7.6, 3.6, 4.6),
    ],
    view: { from: [35, 30, 22], to: [31, 1, -8] },
    focus: [],
    label: { at: [37.5, 9.4, -17] },
    details: [
      { key: 'power', at: [35.6, 4.2, -16.8] },
      { key: 'factory', at: [27.8, 4.4, -16.3] },
      { key: 'homes', at: [32, 3.6, -4.4] },
    ],
    pops: [],
    animate({ time, open }) {
      const on = open > 0.05;
      steam.update(time, on);
      smoke.update(time + 1, on);
      const lit = Math.max(open, night);
      glow.emissiveIntensity = WINDOW_GLOW * lit * (0.8 + 0.2 * Math.sin(time * 2.2));
    },
    setLamps(level) {
      night = level;
    },
  };
}
