/**
 * A camera rig that turns all the way round what it looks at, tilts within limits, zooms toward
 * the pointer and pans within bounds: by drag, wheel, pinch and two fingers, settling smoothly,
 * and by buttons and keys through the same moves. It wraps the camera-controls package. LabCamera
 * still centers the free area (its view offset, slid where a shot asks) and fits shots; the rig
 * owns the pose from there.
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
import { CENTERED, type Shift } from './fit.ts';
import { TAP_SLOP } from './input.ts';

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
  /**
   * The nearest it may stand to what it looks at, by how high that is, where that's further than
   * `distance` allows: looking at something low, it stands further back to stay above the ground.
   */
  nearestAt?: (height: number) => number;
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

/** How far inside its nearest the camera may stand before it steps back, in scene units. */
const NEAR_SLACK = 1e-6;

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
  /** For `remaining`: where the camera stands and what it looks at, now and where headed. */
  private readonly left = [new Vector3(), new Vector3(), new Vector3(), new Vector3()] as const;
  /** The limits set last: setting the same again leaves the view be. */
  private readonly polar: [number, number] = [0, 0];
  private readonly reach: [number, number] = [0, 0];
  private readonly bounds = new Box3();
  private nearestAt: ((height: number) => number) | null = null;
  /** Moves are cuts: with motion reduced, and in capture mode. */
  private instant = false;
  /** camera-controls said the move under way is at rest, so it lands. */
  private rested = false;
  /** The listeners the rig adds of its own, removed on dispose. */
  private readonly unlisten: (() => void)[] = [];

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
    // The lens never zooms: a zoom is the camera coming nearer, within its limits.
    c.minZoom = 1;
    c.maxZoom = 1;
    c.addEventListener('rest', () => {
      this.rested = true;
    });
    // Any press or wheel turn may move the view: frames are wanted.
    const wake = () => {
      hooks.wake();
    };
    c.addEventListener('controlstart', wake);
    c.addEventListener('control', wake);
    this.controls = c;
    this.listen(element);
    this.setLimits(limits);
  }

  /**
   * The rig's own input: a trackpad's pinch, which comes as the wheel with Ctrl held (camera-controls
   * would zoom the lens with it, without limits), zooms as the wheel does; and the reader has moved
   * the view once a wheel turns or a press wanders past `TAP_SLOP`, so a tap that opens a stop isn't
   * a move.
   */
  private listen(element: HTMLElement): void {
    const doc = element.ownerDocument;
    const pressed = new Map<number, { x: number; y: number }>();
    let movedThisPress = false;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) {
        this.hooks.moved();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      element.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: event.clientX,
          clientY: event.clientY,
          screenX: event.screenX,
          screenY: event.screenY,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaZ: event.deltaZ,
          deltaMode: event.deltaMode,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
        }),
      );
    };
    const onDown = (event: PointerEvent) => {
      if (pressed.size === 0) movedThisPress = false;
      pressed.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };
    const onMove = (event: PointerEvent) => {
      const from = pressed.get(event.pointerId);
      if (!from || movedThisPress) return;
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) < TAP_SLOP) return;
      movedThisPress = true;
      this.hooks.moved();
    };
    const onUp = (event: PointerEvent) => {
      pressed.delete(event.pointerId);
    };
    element.addEventListener('wheel', onWheel, { capture: true, passive: false });
    element.addEventListener('pointerdown', onDown);
    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onUp);
    doc.addEventListener('pointercancel', onUp);
    this.unlisten.push(() => {
      element.removeEventListener('wheel', onWheel, { capture: true });
      element.removeEventListener('pointerdown', onDown);
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onUp);
      doc.removeEventListener('pointercancel', onUp);
    });
  }

  /**
   * Limits from now on; a view headed outside them is brought within: what it looks at, how far it
   * stands and how far it tilts. The same limits again change nothing, so the view isn't drawn
   * again for them (camera-controls redraws for any boundary).
   */
  setLimits({ polar, distance, bounds, nearestAt }: OrbitLimits): void {
    const same =
      polar.every((v, i) => v === this.polar[i]) &&
      distance.every((v, i) => v === this.reach[i]) &&
      bounds.equals(this.bounds) &&
      (nearestAt ?? null) === this.nearestAt;
    if (same) return;
    [this.polar[0], this.polar[1]] = polar;
    [this.reach[0], this.reach[1]] = distance;
    this.bounds.copy(bounds);
    this.nearestAt = nearestAt ?? null;
    const c = this.controls;
    [c.minPolarAngle, c.maxPolarAngle] = polar;
    [c.minDistance, c.maxDistance] = distance;
    c.setBoundary(bounds);
    this.keepNear();
    const end = c.getSpherical(this.spherical, true);
    if (end.radius < c.minDistance || end.radius > c.maxDistance) {
      void c.dollyTo(end.radius, !this.instant);
    }
    if (end.phi < c.minPolarAngle || end.phi > c.maxPolarAngle) {
      void c.rotatePolarTo(end.phi, !this.instant);
    }
    this.hooks.wake();
  }

  /**
   * The free area of the canvas the view is framed in, in CSS pixels, and how far the picture
   * slides off its middle. What's looked at sits there (LabCamera's view offset), so the wheel
   * zooms toward the pointer measured from there.
   */
  setArea(
    area: VisibleArea,
    canvas: { width: number; height: number },
    shift: Shift = CENTERED,
  ): void {
    const cx = area.x + (area.width / 2) * (1 + shift.x);
    const cy = area.y + (area.height / 2) * (1 - shift.y);
    // A canvas-sized viewport centered there; camera-controls counts y from the bottom.
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
   * How much of the move under way is left: the farther the camera or what it looks at has still
   * to go, as a share of how far it stands from what it looks at. None at rest.
   */
  remaining(): number {
    const c = this.controls;
    const [position, positionEnd, target, targetEnd] = this.left;
    c.getPosition(position, false);
    c.getPosition(positionEnd, true);
    c.getTarget(target, false);
    c.getTarget(targetEnd, true);
    const left = Math.max(position.distanceTo(positionEnd), target.distanceTo(targetEnd));
    return left / Math.max(c.distance, 1e-6);
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
    // A drag, the wheel or a pinch may have moved what it looks at, and so how near it may come.
    this.keepNear();
    let moved = this.controls.update(seconds);
    if (this.rested) {
      // At rest within a hair of its end: there at once, so the next frame finds nothing to do.
      this.rested = false;
      this.toEnd();
      moved = this.controls.update(0) || moved;
    }
    if (this.holdNear()) moved = this.controls.update(0) || moved;
    if (moved) this.camera.updateMatrixWorld();
    return moved;
  }

  dispose(): void {
    for (const off of this.unlisten) off();
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

  /** The nearest the camera may stand to what it looks at, that high. */
  private nearestFor(height: number): number {
    return Math.max(this.reach[0], this.nearestAt?.(height) ?? 0);
  }

  /**
   * Holds a move no nearer than what it's headed to look at allows (`nearestAt`): one headed
   * nearer, as a shot fitted close or a zoom, steps back.
   */
  private keepNear(): void {
    const c = this.controls;
    const near = this.nearestFor(c.getTarget(this.target, true).y);
    c.minDistance = near;
    if (c.getSpherical(this.spherical, true).radius < near - NEAR_SLACK) {
      void c.dollyTo(near, !this.instant);
      this.hooks.wake();
    }
  }

  /**
   * Holds the camera, now, no nearer than what it looks at now allows: a quick pan lowers what it
   * looks at faster than the distance eases out, and for those frames it would dip under the
   * ground. Whether it stepped back.
   */
  private holdNear(): boolean {
    const c = this.controls;
    const near = this.nearestFor(c.getTarget(this.target, false).y);
    if (c.distance >= near - NEAR_SLACK) return false;
    const headed = c.getSpherical(this.spherical, true).radius;
    c.distance = near;
    if (headed > near) void c.dollyTo(headed, !this.instant);
    return true;
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
