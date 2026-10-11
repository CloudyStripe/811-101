/**
 * Every value the Frequency Lab's signal model uses, in one place, each with its units and the
 * reason it has that value. `docs/SIGNAL_MODEL.md` is generated from this file.
 *
 * These are teaching calibrations, not measurements: they are chosen so the lab shows the
 * behavior experienced locators expect, and they are pending locator review.
 */
import { FREQUENCIES, type Frequency } from '../../config/equipment.ts';

export type PerFrequency = Readonly<Record<Frequency, number>>;

export interface Constant<T> {
  /** Short name used in the generated docs. */
  readonly name: string;
  /** What the value stands for, in plain words. */
  readonly meaning: string;
  readonly unit: string;
  readonly value: T;
  /** Why it has this value. */
  readonly why: string;
}

function perFrequency(values: readonly [number, number, number, number]): PerFrequency {
  return Object.fromEntries(FREQUENCIES.map((f, i) => [f, values[i]])) as PerFrequency;
}

export const GEOMETRY = {
  blockLengthFt: {
    name: 'Block length',
    meaning:
      'Distance along the target line from the hookup to the far end of the block shown in 3D.',
    unit: 'ft',
    value: 140,
    why: 'Long enough to see the signal fade in the 3D view, short enough to show street detail.',
  },
  chartLengthFt: {
    name: 'Chart length',
    meaning: 'How far the inset chart follows each line past the hookup.',
    unit: 'ft',
    value: 500,
    why: 'Reach differences between frequencies show clearly over a few hundred feet.',
  },
  waterCrossingAtFt: {
    name: 'Water main crossing',
    meaning: 'Where the unconnected water main crosses the target line, measured from the hookup.',
    unit: 'ft',
    value: 100,
    why: 'Inside the block and well away from the hookup, so it reads as a separate feature.',
  },
} as const satisfies Record<string, Constant<number>>;

export const FADE_PER_100FT = {
  steel: {
    name: 'Fade on the coated steel main',
    meaning:
      'Share of the current still on the steel main after another 100 ft. The rest leaks into the soil.',
    unit: 'share left per 100 ft',
    value: perFrequency([0.93, 0.72, 0.2, 0.04]),
    why: "Higher frequencies leak through the pipe coating into the soil more easily, so they fade sooner and don't travel as far. Compressed so the difference shows within one block: real lines fade far more gradually, in the same order.",
  },
  tracer: {
    name: 'Fade on the tracer wire',
    meaning:
      'Share of the current still on the tracer wire after another 100 ft. The rest leaks into the soil.',
    unit: 'share left per 100 ft',
    value: perFrequency([0.95, 0.8, 0.5, 0.19]),
    why: 'The same trend as the steel main, compressed the same way. A thin insulated wire leaks less than the big coated main at every frequency.',
  },
} as const satisfies Record<string, Constant<PerFrequency>>;

export const TELECOM_SHARE = {
  name: 'Bleed-over onto the telecom cable',
  meaning:
    'Current on the parallel telecom cable as a share of the target current at the same spot. It flows back toward the stake.',
  unit: 'share of target current',
  value: perFrequency([0.02, 0.06, 0.15, 0.32]),
  why: 'Coupling onto a metal line running alongside grows with frequency, so higher frequencies bleed over more.',
} as const satisfies Constant<PerFrequency>;

export const CIRCUIT_RESISTANCE_OHMS = {
  steel: {
    name: 'Circuit resistance, steel main',
    meaning: 'Resistance the transmitter sees when hooked up to the steel main.',
    unit: 'Ω',
    value: perFrequency([60, 56, 52, 48]),
    why: 'A long metal main has many paths to the earth, so it is a good circuit at every frequency. Higher frequencies find a little more path through the soil.',
  },
  plastic: {
    name: 'Circuit resistance, tracer wire',
    meaning:
      'Resistance the transmitter sees when hooked up to the tracer wire on the plastic main.',
    unit: 'Ω',
    value: perFrequency([500, 490, 480, 470]),
    why: 'An insulated tracer wire connects to the earth directly only where it is grounded, so its circuit has more resistance than a steel main and less current flows. Higher frequencies leak a little through the insulation, so the resistance falls slightly as frequency rises.',
  },
} as const satisfies Record<string, Constant<PerFrequency>>;

export const TRANSMITTER = {
  openCircuitVolts: {
    name: 'Transmitter output',
    meaning: 'Voltage the generic transmitter drives into the circuit.',
    unit: 'V',
    value: 50,
    why: 'An illustrative output that gives readings in a familiar range.',
  },
  internalOhms: {
    name: 'Transmitter internal resistance',
    meaning: 'Resistance inside the transmitter, in series with the circuit.',
    unit: 'Ω',
    value: 50,
    why: 'Keeps the current on a good circuit in the hundreds of milliamps rather than unlimited.',
  },
} as const satisfies Record<string, Constant<number>>;

export const WORKS_THRESHOLD_MA = {
  name: 'Enough signal to trace',
  meaning:
    'The target current the lab treats as enough to trace at the far end of the block. A frequency "works" when it meets this.',
  unit: 'mA',
  value: 20,
  why: 'An illustrative threshold. Real needs depend on depth, interference from other lines and noise, and the receiver.',
} as const satisfies Constant<number>;

/** All constants, for the docs generator and the validation test. */
export const ALL_CONSTANTS: readonly Constant<number | PerFrequency>[] = [
  ...Object.values(GEOMETRY),
  ...Object.values(FADE_PER_100FT),
  TELECOM_SHARE,
  ...Object.values(CIRCUIT_RESISTANCE_OHMS),
  ...Object.values(TRANSMITTER),
  WORKS_THRESHOLD_MA,
];
