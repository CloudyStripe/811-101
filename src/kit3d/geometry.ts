/** Geometry helpers: soft edges and curves with enough segments to read as curves. */
import { BufferGeometry, CylinderGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** A box with rounded edges, centered on (x, y, z). */
export function roundedBox(
  w: number,
  h: number,
  d: number,
  radius: number,
  at: [number, number, number] = [0, 0, 0],
  segments = 3,
): BufferGeometry {
  const r = Math.min(radius, w / 2, h / 2, d / 2);
  return new RoundedBoxGeometry(w, h, d, segments, r).translate(...at);
}

/** A round pipe or cable running along X from x0 to x1. */
export function pipeAlongX(
  x0: number,
  x1: number,
  y: number,
  z: number,
  radius: number,
  radialSegments = 32,
): BufferGeometry {
  return new CylinderGeometry(radius, radius, x1 - x0, radialSegments, 1, false)
    .rotateZ(Math.PI / 2)
    .translate((x0 + x1) / 2, y, z);
}

/** A vertical post or rod from y0 up to y1. */
export function post(
  x: number,
  z: number,
  y0: number,
  y1: number,
  radius: number,
  radialSegments = 24,
): BufferGeometry {
  return new CylinderGeometry(radius, radius, y1 - y0, radialSegments).translate(
    x,
    (y0 + y1) / 2,
    z,
  );
}

/** A ring around a pipe along X (a coupling or band). */
export function ringAlongX(
  x: number,
  y: number,
  z: number,
  radius: number,
  tube: number,
): BufferGeometry {
  return new TorusGeometry(radius, tube, 12, 40).rotateY(Math.PI / 2).translate(x, y, z);
}

export function merge(geometries: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  return merged;
}
