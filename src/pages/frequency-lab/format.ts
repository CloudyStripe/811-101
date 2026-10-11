/** Number formatting for the lab's readouts, chart and table. */

/** Milliamps: whole numbers when large, two significant digits when small. */
export function formatMa(ma: number): string {
  if (ma >= 10) return String(Math.round(ma));
  if (ma >= 0.01) return ma.toPrecision(2);
  return 'under 0.01';
}

/** A distance in feet, with meters in parentheses: "170 ft (52 m)". */
export function feetAndMeters(ft: number): string {
  return `${String(ft)} ft (${String(Math.round(ft * 0.3048))} m)`;
}

export function percent(share: number): string {
  return `${String(Math.round(share * 100))}%`;
}
