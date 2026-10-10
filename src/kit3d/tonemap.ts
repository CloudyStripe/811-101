/**
 * Reference implementation of the Khronos PBR Neutral tone mapping curve, the one the post chain
 * uses (postprocessing's ToneMappingMode.NEUTRAL). Tests use it to prove the curve keeps APWA
 * hues true; the renderer itself runs the shader version.
 */
export type Linear = readonly [number, number, number];

export function pbrNeutral([r0, g0, b0]: Linear): Linear {
  const startCompression = 0.8 - 0.04;
  const desaturation = 0.15;
  const x = Math.min(r0, g0, b0);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  let r = r0 - offset;
  let g = g0 - offset;
  let b = b0 - offset;
  const peak = Math.max(r, g, b);
  if (peak < startCompression) return [r, g, b];
  const d = 1 - startCompression;
  const newPeak = 1 - (d * d) / (peak + d - startCompression);
  const scale = newPeak / peak;
  r *= scale;
  g *= scale;
  b *= scale;
  const mix = 1 - 1 / (desaturation * (peak - newPeak) + 1);
  return [r + (newPeak - r) * mix, g + (newPeak - g) * mix, b + (newPeak - b) * mix];
}
