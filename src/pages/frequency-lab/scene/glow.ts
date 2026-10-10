/**
 * How brightly a line's signal glows: by how far its current is above "enough to trace", on a
 * log scale. The glow fades out exactly where the signal gets too weak to trace, which is where
 * the chart marks its reach, and peaks at the setup's strongest current. The line shader in
 * signal.ts computes the same thing on the GPU.
 */

/** Above 1, so a middling signal looks middling once tone mapping compresses the bright end. */
export const GLOW_POWER = 1.5;

export function traceGlow(ma: number, strongest: number, threshold: number): number {
  if (ma <= threshold || strongest <= threshold) return 0;
  const t = Math.log(ma / threshold) / Math.log(strongest / threshold);
  return Math.min(1, t) ** GLOW_POWER;
}
