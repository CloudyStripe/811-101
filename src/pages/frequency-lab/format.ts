/** Number formatting for the lab's readouts, chart and table. */

/** Rounds up to a tidy axis maximum: 510 becomes 600, 96 becomes 100. */
export function niceCeil(value: number): number {
  const p = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * p >= value) ?? 10;
  return step * p;
}

/** Milliamps: whole numbers when large, two significant digits when small. */
export function formatMa(ma: number): string {
  if (ma >= 10) return String(Math.round(ma));
  if (ma >= 0.01) return ma.toPrecision(2);
  return 'under 0.01';
}

export function percent(share: number): string {
  return `${String(Math.round(share * 100))}%`;
}
