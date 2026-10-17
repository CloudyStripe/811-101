/**
 * A camera rig that turns all the way round what it looks at, tilts within limits, zooms toward
 * the pointer and pans within bounds: by drag, wheel, pinch and two fingers, settling smoothly,
 * and by buttons and keys through the same moves. It wraps the camera-controls package. LabCamera
 * still centers the free area (its view offset) and fits shots; the rig owns the pose from there.
 */
import CameraControls from 'camera-controls';
import {
  Box3,
  Matrix4,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
  type PerspectiveCamera,
} from 'three';
import { MOTION } from '../design/tokens.ts';
import type { CameraPose, VisibleArea } from './camera.ts';

CameraControls.install({
  THREE: { Box3, Matrix4, Quaternion, Raycaster, Sphere, Spherical, Vector2, Vector3, Vector4 },
});

/** How long moves take to settle, in seconds: a move to a place, and the view following a drag. */
const SETTLE = { move: MOTION.settle.move / 1000, drag: MOTION.settle.drag / 1000 };

export interface OrbitLimits {
  /** How far it tilts, in radians from straight overhead: nearest overhead, then nearest level. */
  polar: readonly [number, number];
  /** How near, and how far, it stands from what it looks at. */
  distance: readonly [number, number];
  /** Where what it looks at may go as it pans. */
  bounds: Box3;
}

/** The limits the camera stands at, so a button can say its move goes no further. */
export interface AtLimits {
  /** Tilted as near level as it goes. */
  tiltUp: boolean;
  /** Tilted as near overhead as it goes. */
  tiltDown: boolean;
  /** As near as it comes. */
  zoomIn: boolean;
  /** As far as it goes. */
  zoomOut: boolean;
}

export interface OrbitHooks {
  /** The view is about to move: frames are wanted until `update` says it has settled. */
  wake(): void;
  /** The reader moved it: by drag, wheel, pinch or touch. */
  moved(): void;
}

/** How near a limit counts as at it, in radians or as a share of the distance. */
const AT = 1e-3;

/**
 * How near its end a move counts as at rest, in radians and scene units: about a pixel at the
 * model's edge. camera-controls would ease on to within a hundred-thousandth, over frames no one
 * sees, so a move at rest lands where it's headed and the loop sleeps.
 */
const REST = 0.002;

export class OrbitRig {
  private readonly controls: CameraControls;
  private readonly camera: PerspectiveCamera;
  private readonly hooks: OrbitHooks;
  private readonly position = new Vector3();
  private readonly target = new Vector3();
  private readonly spherical = new Spherical();
  /** The limits set last: setting the same again leaves the view be. */
  private readonly polar: [number, number] = [0, 0];
  private readonly reach: [number, number] = [0, 0];
  private readonly bounds = new Box3();
  /** Moves are cuts: with motion reduced, and in capture mode. */
  private instant = false;
  /** camera-controls said the move under way is at rest, so it lands. */
  private rested = false;

  constructor(
    camera: PerspectiveCamera,
    element: HTMLElement,
    limits: OrbitLimits,
    hooks: OrbitHooks,
  ) {
    this.hooks = hooks;
    this.camera = camera;
    const c = new CameraControls(camera, element);
    const { ACTION } = CameraControls;
    // A drag turns, a right-drag pans, and the wheel zooms toward the pointer; one finger turns,
    // and two pinch to zoom and move it.
    c.mouseButtons.left = ACTION.ROTATE;
    c.mouseButtons.right = ACTION.TRUCK;
    c.mouseButtons.middle = ACTION.DOLLY;
    c.mouseButtons.wheel = ACTION.DOLLY;
    c.touches.one = ACTION.TOUCH_ROTATE;
    c.touches.two = ACTION.TOUCH_DOLLY_TRUCK;
    c.touches.three = ACTION.TOUCH_TRUCK;
    c.dollyToCursor = true;
    c.smoothTime = SETTLE.move;
    c.draggingSmoothTime = SETTLE.drag;
    c.restThreshold = REST;
    c.addEventListener('rest', () => {
      this.rested = true;
    });
    // A drag starting, and every wheel turn: the reader moving the view.
    const onInput = () => {
      hooks.wake();
      hooks.moved();
    };
    c.addEventListener('controlstart', onInput);
    c.addEventListener('control', onInput);
    this.controls = c;
    this.setLimits(limits);
  }

  /**
   * Limits from now on; a view outside them is brought within. The same limits again change
   * nothing, so the view isn't drawn again for them (camera-controls redraws for any boundary).
   */
  setLimits({ polar, distance, bounds }: OrbitLimits): void {
    const same =
      polar.every((v, i) => v === this.polar[i]) &&
      distance.every((v, i) => v === this.reach[i]) &&
      bounds.equals(this.bounds);
    if (same) return;
    [this.polar[0], this.polar[1]] = polar;
    [this.reach[0], this.reach[1]] = distance;
    this.bounds.copy(bounds);
    const c = this.controls;
    [c.minPolarAngle, c.maxPolarAngle] = polar;
    [c.minDistance, c.maxDistance] = distance;
    c.setBoundary(bounds);
    this.hooks.wake();
  }

  /**
   * The free area of the canvas the view is framed in, in CSS pixels. What's looked at sits at its
   * middle (LabCamera's view offset), so the wheel zooms toward the pointer measured from there.
   */
  setArea(area: VisibleArea, canvas: { width: number; height: number }): void {
    const cx = area.x + area.width / 2;
    const cy = area.y + area.height / 2;
    // A canvas-sized viewport centered on the free area; camera-controls counts y from the bottom.
    this.controls.setViewport(
      cx - canvas.width / 2,
      canvas.height / 2 - cy,
      canvas.width,
      canvas.height,
    );
  }

  /** Moves are cuts while `instant`: with motion reduced, and in capture mode. */
  setInstant(instant: boolean): void {
    this.instant = instant;
    this.settleIn(SETTLE.move);
    this.controls.draggingSmoothTime = instant ? 0 : SETTLE.drag;
  }

  set enabled(on: boolean) {
    this.controls.enabled = on;
  }

  /**
   * Looks from the pose's position at its target: a smooth move, settling over about `settle`
   * seconds, or a cut.
   */
  lookAt(pose: CameraPose, move = true, settle = SETTLE.move): void {
    if (this.isAt(pose, move)) return;
    const { position: p, target: t } = pose;
    this.settleIn(settle);
    void this.controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, move && !this.instant);
    this.hooks.wake();
  }

  /** Turns round what it looks at, by `radians`, to the right for more. */
  turn(radians: number): void {
    this.settleIn(SETTLE.move);
    void this.controls.rotate(radians, 0, !this.instant);
    this.hooks.wake();
  }

  /** Tilts toward level for more `radians`, toward overhead for fewer. */
  tilt(radians: number): void {
    this.settleIn(SETTLE.move);
    void this.controls.rotate(0, radians, !this.instant);
    this.hooks.wake();
  }

  /** Comes nearer by `factor` of the distance (0.2 is a fifth nearer), or goes farther for less than 0. */
  zoom(factor: number): void {
    this.settleIn(SETTLE.move);
    void this.controls.dolly(this.endDistance() * factor, !this.instant);
    this.hooks.wake();
  }

  /** Pans across the view by this share of its distance: right and up for more. */
  pan(across: number, up: number): void {
    const d = this.endDistance();
    this.settleIn(SETTLE.move);
    void this.controls.truck(across * d, -up * d, !this.instant);
    this.hooks.wake();
  }

  /** Looks at a point, keeping the camera's angle and distance; within bounds, as panning is. */
  centerOn(point: Vector3): void {
    this.settleIn(SETTLE.move);
    void this.controls.moveTo(point.x, point.y, point.z, !this.instant);
    this.hooks.wake();
  }

  /** Lands a move under way at once, where it was headed. */
  land(): void {
    this.toEnd();
    this.hooks.wake();
  }

  /** Where the camera is, and what it looks at, now; or where a move under way is headed. */
  pose(fov: number, end = false): CameraPose {
    return {
      position: this.controls.getPosition(new Vector3(), end),
      target: this.controls.getTarget(new Vector3(), end),
      fov,
    };
  }

  /** How far the camera stands from what it looks at, now. */
  get distance(): number {
    return this.controls.distance;
  }

  /**
   * Where the camera stands now: its heading round what it looks at and its tilt from overhead, in
   * radians, its distance, and what it looks at.
   */
  where(): { heading: number; tilt: number; distance: number; target: Vector3 } {
    // camera-controls answers with where a move is headed unless asked for now.
    const s = this.controls.getSpherical(this.spherical, false);
    return {
      heading: s.theta,
      tilt: s.phi,
      distance: s.radius,
      target: this.controls.getTarget(this.target, false),
    };
  }

  /** The limits the view is headed to stand at. */
  atLimits(): AtLimits {
    const c = this.controls;
    const s = c.getSpherical(this.spherical, true);
    return {
      tiltUp: s.phi >= c.maxPolarAngle - AT,
      tiltDown: s.phi <= c.minPolarAngle + AT,
      zoomIn: s.radius <= c.minDistance * (1 + AT),
      zoomOut: s.radius >= c.maxDistance * (1 - AT),
    };
  }

  /**
   * Moves the camera on by `seconds`; whether it moved, so frames are still wanted. Its world
   * matrix follows at once, so what's placed by it this frame (labels) lands where it's drawn.
   */
  update(seconds: number): boolean {
    let moved = this.controls.update(seconds);
    if (this.rested) {
      // At rest within a hair of its end: there at once, so the next frame finds nothing to do.
      this.rested = false;
      this.toEnd();
      moved = this.controls.update(0) || moved;
    }
    if (moved) this.camera.updateMatrixWorld();
    return moved;
  }

  dispose(): void {
    this.controls.dispose();
  }

  /**
   * Whether the view stands at this pose already, or for a move, is already headed there: moving
   * again would only draw the same view again.
   */
  private isAt(pose: CameraPose, move: boolean): boolean {
    const c = this.controls;
    const near = (a: Vector3, b: Vector3) => a.distanceToSquared(b) < 1e-10;
    const headed =
      near(c.getPosition(this.position, true), pose.position) &&
      near(c.getTarget(this.target, true), pose.target);
    if (!headed || move) return headed;
    return (
      near(c.getPosition(this.position, false), pose.position) &&
      near(c.getTarget(this.target, false), pose.target)
    );
  }

  /** Puts the camera where the move under way is headed. */
  private toEnd(): void {
    this.controls.getPosition(this.position, true);
    this.controls.getTarget(this.target, true);
    const { position: p, target: t } = this;
    void this.controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false);
  }

  /** How far the camera stands, or will once a move under way lands. */
  private endDistance(): number {
    return this.controls.getSpherical(this.spherical, true).radius;
  }

  /** How long the next move takes to settle: at once while moves are cuts. */
  private settleIn(seconds: number): void {
    this.controls.smoothTime = this.instant ? 0 : seconds;
  }
}
