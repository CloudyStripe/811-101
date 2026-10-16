/**
 * The backdrop behind a model: the sky as a gradient down the screen, deep blue at the top of the
 * view, through a pale horizon behind the model, to a paler band under it. It's the same whichever
 * way the camera looks, so the model floats in the sky like a toy on a blue card, and no ground or
 * haze has to run out to a horizon.
 */
import {
  Color,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  RGBAFormat,
  SRGBColorSpace,
} from 'three';
import { hexToRgb } from '../design/color.ts';
import type { SceneTokens } from '../design/tokens.ts';
import { inversePbrNeutral } from './tonemap.ts';

/** Where each of the sky's colors sits, from the top of the view (0) to the bottom (1). */
export const BACKDROP_STOPS = { zenith: 0, horizon: 0.62, below: 1 } as const;

const ROWS = 256;

/** The sky's color `t` of the way down the view, as sRGB channels, mixed like a CSS gradient. */
export function backdropAt(tokens: SceneTokens, t: number): [number, number, number] {
  const { zenith, horizon, below } = BACKDROP_STOPS;
  const [from, to, k] =
    t <= horizon
      ? [tokens.skyZenith, tokens.skyHorizon, (t - zenith) / (horizon - zenith)]
      : [tokens.skyHorizon, tokens.skyBelow, (t - horizon) / (below - horizon)];
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const u = Math.min(1, Math.max(0, k));
  return [a.r + (b.r - a.r) * u, a.g + (b.g - a.g) * u, a.b + (b.b - a.b) * u];
}

/**
 * The gradient as a texture for `scene.background`, which three stretches over the screen. Each
 * row is drawn through the inverse of the tone mapping, so the screen shows the sky as authored.
 * Pale sky needs values above 1 for that, so the rows are half floats.
 */
export function backdropTexture(tokens: SceneTokens): DataTexture {
  const data = new Uint16Array(ROWS * 4);
  const c = new Color();
  for (let row = 0; row < ROWS; row++) {
    // Row 0 is the bottom of the screen.
    const [r, g, b] = backdropAt(tokens, 1 - row / (ROWS - 1));
    c.setRGB(r, g, b, SRGBColorSpace);
    const linear = inversePbrNeutral([c.r, c.g, c.b]);
    linear.forEach((v, i) => {
      data[row * 4 + i] = DataUtils.toHalfFloat(v);
    });
    data[row * 4 + 3] = DataUtils.toHalfFloat(1);
  }
  const texture = new DataTexture(data, 1, ROWS, RGBAFormat, HalfFloatType);
  texture.colorSpace = LinearSRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
