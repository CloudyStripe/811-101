/**
 * What's labeled in the 3D view. Plain data with no three.js import, so the UI can render the
 * label buttons without pulling the 3D bundle into the first load.
 */
import type { SetupId } from '../../../signal/model.ts';
import type { LabLayout } from './layout.ts';

export type LabelId =
  'transmitter' | 'stake' | 'access' | 'target' | 'tracer' | 'telecom' | 'water';

export type Point3 = readonly [number, number, number];

export interface LabelSpec {
  id: LabelId;
  /** Text per setup; null hides the label in that setup. */
  text: Record<SetupId, string | null>;
  icon: 'transmitter' | 'stake' | 'access' | 'gas' | 'wire' | 'telecom' | 'water';
  /** APWA color code for line labels; equipment labels stay neutral. */
  color?: 'yellow' | 'orange' | 'blue';
  priority: number;
  /** Labels on the cut face only show from in front of it. */
  onFace: boolean;
  /** Hangs below its point, clear of the line above it. */
  below?: boolean;
}

/** Where a label sits: its anchor, and where its leader points on the thing itself, per setup. */
export interface LabelPlace {
  anchor: Record<SetupId, Point3>;
  point?: Record<SetupId, Point3>;
}

const same = (p: Point3): Record<SetupId, Point3> => ({ steel: p, plastic: p });

/** The label to read first: what carries the signal, the steel main or the plastic main's tracer wire. */
export const CARRIER: Record<SetupId, LabelId> = { steel: 'target', plastic: 'tracer' };

export const LABEL_SPECS: readonly LabelSpec[] = [
  {
    id: 'transmitter',
    text: { steel: 'Transmitter', plastic: 'Transmitter' },
    icon: 'transmitter',
    priority: 5,
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
    priority: 6,
    onFace: true,
    below: true,
  },
  {
    id: 'tracer',
    text: { steel: null, plastic: 'Tracer wire' },
    icon: 'wire',
    color: 'yellow',
    priority: 7,
    onFace: true,
    below: true,
  },
  {
    id: 'telecom',
    text: { steel: 'Telecom cable', plastic: 'Telecom cable' },
    icon: 'telecom',
    color: 'orange',
    priority: 6,
    onFace: true,
  },
  {
    id: 'water',
    text: { steel: 'Water main', plastic: 'Water main' },
    icon: 'water',
    color: 'blue',
    priority: 3,
    onFace: true,
    below: true,
  },
];

/**
 * Where each label sits in the block's layout. Labels on the equipment sit over it, at the size
 * it's drawn; labels on the lines hang under or over them, just in front of the cut face.
 */
export function labelPlaces(layout: LabLayout): Record<LabelId, LabelPlace> {
  const { hookup, lines, equipment: k } = layout;
  const { transmitter: tx, stake, access } = hookup;
  // The transmitter's case top, and its handle's, standing on the grass.
  const caseTop = 0.12 + 0.92 * k;
  const handleTop = 0.12 + 1.39 * k;
  return {
    transmitter: {
      anchor: same([tx.x, handleTop + 0.05 * k, tx.z]),
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
        steel: [30, lines.steel.y - lines.steel.radius, lines.steel.radius],
        plastic: [30, lines.plastic.y - lines.plastic.radius, lines.plastic.radius],
      },
    },
    tracer: {
      anchor: same([58, lines.tracer.y - lines.tracer.radius, lines.plastic.radius]),
    },
    telecom: {
      anchor: same([44, lines.telecom.y + lines.telecom.radius, lines.telecom.radius]),
    },
    water: {
      anchor: same([lines.water.x, lines.water.y - lines.water.radius, lines.water.z1]),
    },
  };
}
