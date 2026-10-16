/** The generic transmitter's frequencies, one button each. A typical spread from low to high. */
export const FREQUENCIES = [512, 8_000, 33_000, 83_000] as const;

export type Frequency = (typeof FREQUENCIES)[number];

export function frequencyLabel(f: Frequency): string {
  return f < 1000 ? `${f} Hz` : `${f / 1000} kHz`;
}

/** Spoken form for screen readers, e.g. "33 kilohertz". */
export function frequencySpoken(f: Frequency): string {
  return f < 1000 ? `${f} hertz` : `${f / 1000} kilohertz`;
}
