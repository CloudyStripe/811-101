/**
 * What's labeled in the 3D view. Plain data with no three.js import, so the UI can render the
 * label buttons without pulling the 3D bundle into the first load.
 */
import type { SetupId } from '../../../signal/model.ts';
import { HOOKUP, LINES } from './layout.ts';

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
  anchor: Record<SetupId, Point3>;
  priority: number;
  /** Labels on the cut face only show from in front of it. */
  onFace: boolean;
}

const same = (p: Point3): Record<SetupId, Point3> => ({ steel: p, plastic: p });

export const LABEL_SPECS: readonly LabelSpec[] = [
  {
    id: 'transmitter',
    text: { steel: 'Transmitter', plastic: 'Transmitter' },
    icon: 'transmitter',
    anchor: same([HOOKUP.transmitter.x, 1.5, HOOKUP.transmitter.z]),
    priority: 5,
    onFace: false,
  },
  {
    id: 'stake',
    text: { steel: 'Ground stake', plastic: 'Ground stake' },
    icon: 'stake',
    anchor: same([HOOKUP.stake.x, HOOKUP.stake.top + 0.4, HOOKUP.stake.z]),
    priority: 5,
    onFace: false,
  },
  {
    id: 'access',
    text: { steel: 'Test station', plastic: 'Tracer test box' },
    icon: 'access',
    anchor: {
      steel: [HOOKUP.access.x, 3.5, HOOKUP.access.z],
      plastic: [HOOKUP.access.x, 0.6, HOOKUP.access.z],
    },
    priority: 4,
    onFace: false,
  },
  {
    id: 'target',
    text: { steel: 'Steel gas main', plastic: 'Plastic gas main' },
    icon: 'gas',
    color: 'yellow',
    anchor: same([30, LINES.steel.y - 0.25, 0.5]),
    priority: 6,
    onFace: true,
  },
  {
    id: 'tracer',
    text: { steel: null, plastic: 'Tracer wire' },
    icon: 'wire',
    color: 'yellow',
    anchor: same([58, LINES.tracer.y + 0.2, 0.25]),
    priority: 7,
    onFace: true,
  },
  {
    id: 'telecom',
    text: { steel: 'Telecom cable', plastic: 'Telecom cable' },
    icon: 'telecom',
    color: 'orange',
    anchor: same([44, LINES.telecom.y + 0.35, 0.3]),
    priority: 6,
    onFace: true,
  },
  {
    id: 'water',
    text: { steel: 'Water main', plastic: 'Water main' },
    icon: 'water',
    color: 'blue',
    anchor: same([LINES.water.x, LINES.water.y - 0.2, 0.6]),
    priority: 3,
    onFace: true,
  },
];
