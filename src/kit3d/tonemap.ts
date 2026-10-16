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
 * The sky behind a model is authored as what the eye should see; this finds what to draw. It
 * undoes each step of the curve in turn, exactly: the desaturation, then the compression of the
 * brightest channel, then the offset that crushes dark colors toward their darkest channel (so a
 * dark navy needs a lighter source, or it comes out nearly black). A pale sky needs a source
 * well above 1.
 */
export function inversePbrNeutral(target: Linear): Linear {
  const startCompression = 0.8 - 0.04;
  const desaturation = 0.15;
  const d = 1 - startCompression;
  // Tone mapping never quite reaches white, so nor can a target.
  const newPeak = Math.min(Math.max(...target), 0.9999);
  let c: [number, number, number] = [target[0], target[1], target[2]];
  if (newPeak >= startCompression) {
    // The peak before compression, from the curve's formula for the peak after it.
    const peak = (d * d) / (1 - newPeak) - d + startCompression;
    const mix = 1 - 1 / (desaturation * (peak - newPeak) + 1);
    // Undo the pull toward the peak, then the scaling down to it.
    c = c.map((v) => ((v - newPeak * mix) / (1 - mix)) * (peak / newPeak)) as typeof c;
  }
  // Undo the offset, which depends on the darkest channel of the source: a fixed 0.04, or less
  // for dark colors (the source's darkest channel x became 6.25 x squared).
  const low = Math.min(...c);
  const x = low < 0.04 ? Math.sqrt(Math.max(0, low) / 6.25) : low + 0.04;
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  return [c[0] + offset, c[1] + offset, c[2] + offset];
}
