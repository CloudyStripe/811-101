/** What every stop's builder returns, and what it's told each frame. */
import { Box3, Vector3, type Group, type Object3D } from 'three';
import type { StopId } from '../../../../content/utilities/gas-petroleum.ts';
import type { Finishes, Point } from './build.ts';

export interface DetailSpec {
  /** Its text's key in the stop's DETAILS. */
  key: string;
  at: Point;
  /** A sample of what the label names: a layer, or what fills it. */
  swatch?: string;
  /** Shown only while the camera is on this side of it: for labels on a face of the block. */
  facing?: Point;
  /** Follows a moving part: `at` is in its space. */
  follow?: Object3D;
}

export interface StopMotion {
  /** Seconds of motion so far. It stands still while motion is paused or reduced. */
  time: number;
  /** Seconds since the last frame, or 0 while nothing moves. */
  dt: number;
  /** How open the stop is, easing from 0 to 1: its exhibits grow in and its machines speed up. */
  open: number;
}

export interface StopModel {
  id: StopId;
  root: Group;
  finishes: Finishes;
  /** Clicking or tapping inside any of these opens the stop. */
  hits: Box3[];
  /** Hit volumes on moving parts, in their own space. */
  followHits?: { box: Box3; follow: Object3D }[];
  /** The camera's direction at this stop: from where, at what. The fit sets the distance. */
  view: { from: Point; to: Point };
  /** What must be in view at this stop, beyond its hit volumes and details. */
  focus: Point[];
  label: { at: Point; facing?: Point };
  details: DetailSpec[];
  /** Exhibits that grow in while the stop is open. */
  pops: Object3D[];
  /** Moves the stop's machines. */
  animate?(motion: StopMotion): void;
  /** Lit windows and lamps: 0 by day, 1 at night. Shown from the next frame. */
  setLamps?(level: number): void;
}

/** A hit volume centered on (x, y, z), w by h by d. */
export function hit(x: number, y: number, z: number, w: number, h: number, d: number): Box3 {
  return new Box3().setFromCenterAndSize(new Vector3(x, y, z), new Vector3(w, h, d));
}

/** Everything the camera must show at a stop: its hit volumes' corners, details and label. */
export function focusPoints(stop: StopModel): Point[] {
  const points: Point[] = [...stop.focus];
  for (const box of stop.hits) {
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) points.push([x, y, z]);
  }
  for (const d of stop.details) if (!d.follow) points.push(d.at);
  const [x, y, z] = stop.label.at;
  // Room above the label's anchor for the label itself.
  points.push([x, y + 1.6, z]);
  return points;
}
