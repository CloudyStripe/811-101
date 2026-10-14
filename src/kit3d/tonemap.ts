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

/**
 * The color to render so that, after tone mapping, the screen shows `target` (both linear).
 * Backdrops that must match the page, such as the sky, fog and paper, are authored as what the
 * eye should see; this finds what to draw. The curve crushes dark colors toward their darkest
 * channel, so a dark graphite needs a lighter source, or it comes out navy.
 */
export function inversePbrNeutral(target: Linear): Linear {
  let input: [number, number, number] = [target[0], target[1], target[2]];
  for (let i = 0; i < 40; i++) {
    const out = pbrNeutral(input);
    input = [
      Math.max(0, input[0] + target[0] - out[0]),
      Math.max(0, input[1] + target[1] - out[1]),
      Math.max(0, input[2] + target[2] - out[2]),
    ];
  }
  return input;
}
