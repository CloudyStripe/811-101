/**
 * The diorama's camera, run through its rig with its own limits, as the page drives it: however
 * the reader moves it (to a stop fitted low and close, back to it with Home, panning down fast,
 * zooming with the wheel toward something low, or with Shift and ↓), it stands above the grass in
 * every frame, and no nearer than what it looks at allows. A drag and the wheel go through
 * camera-controls' own handlers (3.1.2, pinned), as a pointer would.
 */
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { CameraPose } from '../../../kit3d/camera.ts';
import { OrbitRig } from '../../../kit3d/orbit.ts';
import { CLEARANCE, ORBIT, nearestAt, orbitBounds } from './shots.ts';

// camera-controls measures its element with a DOMRect, which Node lacks.
class Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
  get left() {
    return this.x;
  }
  get top() {
    return this.y;
  }
  get right() {
    return this.x + this.width;
  }
  get bottom() {
    return this.y + this.height;
  }
}
Object.assign(globalThis, { DOMRect: Rect });

/** An element the size of a desktop view, taking no events: the test moves the camera itself. */
function element(): HTMLElement {
  const none = () => undefined;
  const box = { left: 0, top: 0, x: 0, y: 0, width: 1440, height: 900, right: 1440, bottom: 900 };
  return {
    style: {},
    setAttribute: none,
    removeAttribute: none,
    addEventListener: none,
    removeEventListener: none,
    getBoundingClientRect: () => box,
    ownerDocument: { addEventListener: none, removeEventListener: none },
  } as unknown as HTMLElement;
}

/** camera-controls' own handlers for a drag and the wheel, which the test calls as they would. */
interface Handlers {
  _truckInternal(dx: number, dy: number, dragToOffset: boolean, screenSpacePanning: boolean): void;
  _dollyInternal(delta: number, x: number, y: number): void;
  _isUserControllingTruck: boolean;
  _isUserControllingDolly: boolean;
}

function rigged(instant = false) {
  const camera = new PerspectiveCamera(34, 1440 / 900, 0.5, 3000);
  const rig = new OrbitRig(
    camera,
    element(),
    { polar: ORBIT.polar, distance: [ORBIT.near, 400], bounds: orbitBounds(), nearestAt },
    { wake: () => undefined, moved: () => undefined },
  );
  rig.setInstant(instant);
  const controls = (rig as unknown as { controls: Handlers }).controls;
  return { rig, camera, controls };
}

/** A pose looking at `target` from `r` away, `tilt` degrees from overhead, `heading` round. */
function pose(target: Vector3, r: number, tilt: number, heading: number): CameraPose {
  const from = new Vector3().setFromSphericalCoords(
    r,
    MathUtils.degToRad(tilt),
    MathUtils.degToRad(heading),
  );
  return { position: target.clone().add(from), target: target.clone(), fov: 34 };
}

/** Runs frames at 60 a second, doing `each` before each, and the lowest the camera stood. */
function lowest(
  rig: OrbitRig,
  camera: PerspectiveCamera,
  frames: number,
  each: (frame: number) => void = () => undefined,
): number {
  let low = Infinity;
  for (let f = 0; f < frames; f++) {
    each(f);
    rig.update(1 / 60);
    low = Math.min(low, camera.position.y);
  }
  return low;
}

const FLAT = MathUtils.radToDeg(ORBIT.polar[1]);

describe("the diorama's camera", () => {
  it('stands back from a shot fitted nearer than what it looks at allows, and from it again by Home', () => {
    const { rig, camera } = rigged(true);
    // A stop low on the cut face, framed too near for that depth, then framed again the same.
    const low = pose(new Vector3(-28, ORBIT.floor, 25), 32, 72, 2);
    for (let again = 0; again < 2; again++) {
      rig.lookAt(low, false);
      lowest(rig, camera, 3);
      expect(rig.distance).toBeGreaterThanOrEqual(nearestAt(ORBIT.floor) - 1e-6);
    }
    // Tilted as flat as it goes and turned right round, it still stands above the grass.
    rig.tilt(1);
    rig.turn(Math.PI);
    expect(lowest(rig, camera, 3)).toBeGreaterThanOrEqual(CLEARANCE - 1e-6);
  });

  for (const pixels of [20, 40, 60]) {
    it(`stays above the grass while a quick drag pans down, ${String(pixels)} px a frame`, () => {
      const { rig, camera, controls } = rigged();
      rig.lookAt(pose(new Vector3(17, -2, -9), nearestAt(-2), FLAT, 0), false);
      lowest(rig, camera, 3);
      // As camera-controls' own pointer handler does: move, then mark the move as the reader's.
      const low = lowest(rig, camera, 90, (f) => {
        if (f < 20) controls._truckInternal(0, pixels, false, false);
        controls._isUserControllingTruck = f < 20;
      });
      expect(low).toBeGreaterThanOrEqual(CLEARANCE - 1e-6);
    });
  }

  it('stays above the grass as the wheel zooms toward something low', () => {
    const { rig, camera, controls } = rigged();
    rig.lookAt(pose(new Vector3(17, 0, -9), 40, FLAT, 0), false);
    lowest(rig, camera, 3);
    const low = lowest(rig, camera, 120, (f) => {
      if (f < 8) controls._dollyInternal(-10 / 3, 0, -0.8);
      controls._isUserControllingDolly = f < 8;
    });
    expect(low).toBeGreaterThanOrEqual(CLEARANCE - 1e-6);
  });

  it('stays above the grass as Shift and ↓ pan down', () => {
    const { rig, camera } = rigged();
    rig.lookAt(pose(new Vector3(17, -2, -9), nearestAt(-2), FLAT, 0), false);
    lowest(rig, camera, 3);
    const low = lowest(rig, camera, 120, (f) => {
      if (f < 40 && f % 2 === 0) rig.pan(0, -1);
    });
    expect(low).toBeGreaterThanOrEqual(CLEARANCE - 1e-6);
  });
});
