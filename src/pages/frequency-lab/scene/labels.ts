/**
 * What's labeled in the 3D view. Plain data with no three.js import, so the UI can render the
 * label buttons without pulling the 3D bundle into the first load.
 */
import type { SetupId } from '../../../signal/model.ts';
import type { LabLayout, ViewKind } from './layout.ts';

export type LabelId = 'transmitter' | 'stake' | 'access' | 'target' | 'tracer' | 'telecom';

export type Point3 = readonly [number, number, number];

export interface LabelSpec {
  id: LabelId;
  /** Text per setup; null hides the label in that setup. */
  text: Record<SetupId, string | null>;
  icon: 'transmitter' | 'stake' | 'access' | 'gas' | 'wire' | 'telecom';
  /** APWA color code for line labels; equipment labels stay neutral. */
  color?: 'yellow' | 'orange';
  priority: number;
  /** Labels on the cut face only show from in front of it. */
  onFace: boolean;
  /** Hangs below its point, clear of the line above it. */
  below?: boolean;
}

/**
 * Where a label sits: its anchor, and where its leader points on the thing itself, per setup. A
 * label on a line may sit further along it instead, where there's no room by its anchor.
 */
export interface LabelPlace {
  anchor: Record<SetupId, Point3>;
  point?: Record<SetupId, Point3>;
  along?: Record<SetupId, Point3[]>;
}

const same = (p: Point3): Record<SetupId, Point3> => ({ steel: p, plastic: p });

/** The label to read first: what carries the signal, the steel main or the plastic main's tracer wire. */
export const CARRIER: Record<SetupId, LabelId> = { steel: 'target', plastic: 'tracer' };

export const LABEL_SPECS: readonly LabelSpec[] = [
  {
    id: 'transmitter',
    text: { steel: 'Transmitter', plastic: 'Transmitter' },
    icon: 'transmitter',
    // Where the signal starts: placed before the stake beside it, so it sits right over it.
    priority: 6,
    onFace: false,
  },
  {
    id: 'stake',
    text: { steel: 'Ground stake', plastic: 'Ground stake' },
    icon: 'stake',
    priority: 5,
    onFace: false,
  },
  {
    id: 'access',
    text: { steel: 'Test station', plastic: 'Tracer test box' },
    icon: 'access',
    priority: 4,
    onFace: false,
  },
  {
    id: 'target',
    text: { steel: 'Steel gas main', plastic: 'Plastic gas main' },
    icon: 'gas',
    color: 'yellow',
    priority: 7,
    onFace: true,
    below: true,
  },
  {
    id: 'tracer',
    text: { steel: null, plastic: 'Tracer wire' },
    icon: 'wire',
    color: 'yellow',
    priority: 8,
    onFace: true,
    below: true,
  },
  {
    id: 'telecom',
    text: { steel: 'Telecom cable', plastic: 'Telecom cable' },
    icon: 'telecom',
    color: 'orange',
    priority: 7,
    onFace: true,
  },
];

/**
 * How far along the block each line's label sits, in feet, first choice first: near the hookup,
 * seen from in front. From the hookup end its own labels fill the near end, so the cable's
 * and the tracer wire's sit further along.
 */
const ALONG: Readonly<
  Record<ViewKind, Record<'target' | 'tracer' | 'telecom', readonly [number, ...number[]]>>
> = {
  wide: { target: [30, 70, 110], tracer: [58, 98, 128], telecom: [44, 84, 124] },
  tall: { target: [30, 60, 90], tracer: [90, 60, 120], telecom: [90, 60, 120] },
};

/**
 * Where each label sits in the block's layout, for the view it's seen in. Labels on the equipment
 * sit over it, at the size it's drawn; labels on the lines hang under or over them, just in front
 * of the cut face.
 */
export function labelPlaces(layout: LabLayout, kind: ViewKind): Record<LabelId, LabelPlace> {
  const { hookup, lines, equipment: k } = layout;
  const along = ALONG[kind];
  /** A line's label, at its first place along it and with the rest to fall back on. */
  const onLine = (xs: readonly [number, ...number[]], at: (x: number) => Point3): LabelPlace => {
    const [first, ...rest] = xs;
    const others = rest.map(at);
    return { anchor: same(at(first)), along: { steel: others, plastic: others } };
  };
  const { transmitter: tx, stake, access } = hookup;
  // The transmitter's case top, and its handle's, standing on the grass.
  const caseTop = 0.12 + 0.92 * k;
  const handleTop = 0.12 + 1.39 * k;
  return {
    // As high as the test station's, over its post, so the two stand side by side over the hookup
    // rather than one covering the other's point and pushing the stake's into the corner.
    transmitter: {
      anchor: same([tx.x, Math.max(handleTop + 0.05 * k, 3 * k + 0.5), tx.z]),
      point: same([tx.x, caseTop, tx.z]),
    },
    stake: {
      anchor: same([stake.x, stake.top + 0.3 + 0.1 * k, stake.z]),
      point: same([stake.x, stake.top, stake.z]),
    },
    access: {
      anchor: {
        steel: [access.x, 3 * k + 0.5, access.z],
        plastic: [access.x, 0.225 * k + 0.375, access.z],
      },
      point: { steel: [access.x, 3 * k, access.z], plastic: [access.x, 0.225 * k, access.z] },
    },
    target: {
      anchor: {
        steel: [along.target[0], lines.steel.y - lines.steel.radius, lines.steel.radius],
        plastic: [along.target[0], lines.plastic.y - lines.plastic.radius, lines.plastic.radius],
      },
      along: {
        steel: along.target
          .slice(1)
          .map((x) => [x, lines.steel.y - lines.steel.radius, lines.steel.radius]),
        plastic: along.target
          .slice(1)
          .map((x) => [x, lines.plastic.y - lines.plastic.radius, lines.plastic.radius]),
      },
    },
    tracer: onLine(along.tracer, (x) => [
      x,
      lines.tracer.y - lines.tracer.radius,
      lines.plastic.radius,
    ]),
    telecom: onLine(along.telecom, (x) => [
      x,
      lines.telecom.y + lines.telecom.radius,
      lines.telecom.radius,
    ]),
  };
}
