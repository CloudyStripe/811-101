/**
 * The Frequency Lab's signal model: a small, pure function of setup and frequency, covering
 * exactly the eight states the lab shows. It is a teaching model, not a circuit solver; every
 * value it uses lives in `constants.ts`.
 */
import { FREQUENCIES, type Frequency } from '../../config/equipment.ts';
import {
  CIRCUIT_RESISTANCE_OHMS,
  FADE_PER_100FT,
  GEOMETRY,
  TELECOM_SHARE,
  TRANSMITTER,
  WORKS_THRESHOLD_MA,
} from './constants.ts';

/** Steel main, or plastic main whose tracer wire carries the signal. */
export const SETUPS = ['steel', 'plastic'] as const;
export type SetupId = (typeof SETUPS)[number];

/** Which conductor carries the signal in each setup. Plastic pipe can't; its tracer wire does. */
export const CONDUCTOR: Record<SetupId, keyof typeof FADE_PER_100FT> = {
  steel: 'steel',
  plastic: 'tracer',
};

/** Signal current at a distance along a line, measured from the hookup. */
export interface LinePoint {
  readonly x: number;
  readonly ma: number;
}

export interface LabState {
  readonly setup: SetupId;
  readonly frequency: Frequency;
  readonly transmitter: { readonly ma: number; readonly ohms: number };
  /** +1: current flows out along the target, away from the hookup. */
  readonly target: { readonly direction: 1; readonly points: readonly LinePoint[] };
  /** -1: bleed-over on the telecom cable flows back toward the stake. */
  readonly telecom: {
    readonly direction: -1;
    readonly share: number;
    readonly points: readonly LinePoint[];
  };
  /** The water main isn't connected to anything and carries no signal. */
  readonly water: { readonly ma: 0; readonly crossingAt: number };
  readonly earth: {
    /** Current leaking from the target into the soil, per sample interval (x is its midpoint). */
    readonly leakage: readonly LinePoint[];
    /** Current still on the target at the end of the chart; it returns through the earth too. */
    readonly pastChart: number;
    /** Return current carried back toward the stake by the telecom cable. */
    readonly viaTelecom: number;
    /** Return current that travels through the soil directly. */
    readonly viaSoil: number;
    /** Current arriving at the ground stake: all of it. */
    readonly stake: number;
  };
  /** Target current at the far end of the block. */
  readonly farEndMa: number;
  /** Whether that's enough to trace (see WORKS_THRESHOLD_MA). */
  readonly works: boolean;
}

const SAMPLE_STEP_FT = 5;

/** Decay per foot for a "share left per 100 ft" value. */
export function decayPerFt(setup: SetupId, frequency: Frequency): number {
  return -Math.log(FADE_PER_100FT[CONDUCTOR[setup]].value[frequency]) / 100;
}

export function transmitterReading(
  setup: SetupId,
  frequency: Frequency,
): { ma: number; ohms: number } {
  const ohms = CIRCUIT_RESISTANCE_OHMS[setup].value[frequency];
  const amps = TRANSMITTER.openCircuitVolts.value / (ohms + TRANSMITTER.internalOhms.value);
  return { ma: amps * 1000, ohms };
}

/** Target current (mA) at `x` ft from the hookup. */
export function targetCurrentAt(setup: SetupId, frequency: Frequency, x: number): number {
  return transmitterReading(setup, frequency).ma * Math.exp(-decayPerFt(setup, frequency) * x);
}

export function labState(setup: SetupId, frequency: Frequency): LabState {
  const transmitter = transmitterReading(setup, frequency);

  const points: LinePoint[] = [];
  for (let x = 0; x <= GEOMETRY.chartLengthFt.value; x += SAMPLE_STEP_FT) {
    points.push({ x, ma: targetCurrentAt(setup, frequency, x) });
  }

  const leakage: LinePoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) leakage.push({ x: (a.x + b.x) / 2, ma: a.ma - b.ma });
  }

  const share = TELECOM_SHARE.value[frequency];
  const viaTelecom = share * transmitter.ma;
  const farEndMa = targetCurrentAt(setup, frequency, GEOMETRY.blockLengthFt.value);

  return {
    setup,
    frequency,
    transmitter,
    target: { direction: 1, points },
    telecom: { direction: -1, share, points: points.map((p) => ({ x: p.x, ma: p.ma * share })) },
    water: { ma: 0, crossingAt: GEOMETRY.waterCrossingAtFt.value },
    earth: {
      leakage,
      pastChart: points.at(-1)?.ma ?? 0,
      viaTelecom,
      viaSoil: transmitter.ma - viaTelecom,
      stake: transmitter.ma,
    },
    farEndMa,
    works: farEndMa >= WORKS_THRESHOLD_MA.value,
  };
}

/** The lesson's rule, computed: the lowest frequency that gets enough signal to the far end. */
export function lowestWorkingFrequency(setup: SetupId): Frequency | null {
  return FREQUENCIES.find((f) => labState(setup, f).works) ?? null;
}
