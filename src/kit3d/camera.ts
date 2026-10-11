/**
 * Camera: damped orbit with eased, purposeful transitions (camera-controls), keyboard and button
 * alternatives to dragging, and framing that keeps the subject centered in the part of the view
 * the panel or sheet leaves free (ported from the diorama's visibleArea/fitted logic).
 */
import CameraControls from 'camera-controls';
import {
  Box3,
  MathUtils,
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

CameraControls.install({
  THREE: {
    Box3,
    MathUtils,
    Matrix4,
    Quaternion,
    Raycaster,
    Sphere,
    Spherical,
    Vector2,
    Vector3,
    Vector4,
  },
});

export interface View {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  /** Width over height of the free area the view is framed for. Narrower areas back off. */
  aspect: number;
}

/** The part of the canvas left free by the panel or sheet, in CSS pixels. */
export interface VisibleArea {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Frame a portrait view here. Left out, it follows the area's shape. */
  portrait?: boolean;
}

export interface CameraOptions {
  minDistance: number;
  maxDistance: number;
  /** Radians from straight up; keeps the camera above ground. */
  maxPolarAngle: number;
  minPolarAngle: number;
  /** Azimuth limits (radians), so the cut face stays in view. */
  minAzimuth: number;
  maxAzimuth: number;
  /** Box the orbit target must stay inside. */
  targetBounds: Box3;
}

export class LabCamera {
  readonly controls: CameraControls;
  private readonly camera: PerspectiveCamera;
  private visible: VisibleArea | null = null;
  private canvasSize = { width: 1, height: 1 };
  private view: View | null = null;
  /** Set once the learner turns or zooms the camera, so a resize doesn't undo it. */
  private moved = false;
  reducedMotion = false;

  constructor(camera: PerspectiveCamera, element: HTMLElement, options: CameraOptions) {
    this.camera = camera;
    const c = new CameraControls(camera, element);
    c.smoothTime = 0.42;
    c.draggingSmoothTime = 0.12;
    c.minDistance = options.minDistance;
    c.maxDistance = options.maxDistance;
    c.minPolarAngle = options.minPolarAngle;
    c.maxPolarAngle = options.maxPolarAngle;
    c.minAzimuthAngle = options.minAzimuth;
    c.maxAzimuthAngle = options.maxAzimuth;
    c.dollyToCursor = true;
    c.setBoundary(options.targetBounds);
    c.boundaryFriction = 0.15;
    // 'control' covers dragging, touch and the mouse wheel ('controlstart' misses the wheel).
    c.addEventListener('control', () => {
      this.moved = true;
    });
    this.controls = c;
  }

  /** Frames a view, backing off when less of the canvas is visible (phones, open panel). */
  goTo(view: View, transition = true): Promise<void> {
    this.view = view;
    this.moved = false;
    const [px, py, pz] = view.position;
    const [tx, ty, tz] = view.target;
    const k = this.backOff();
    return this.controls.setLookAt(
      tx + (px - tx) * k,
      ty + (py - ty) * k,
      tz + (pz - tz) * k,
      tx,
      ty,
      tz,
      transition && !this.reducedMotion,
    );
  }

  /** Frames `view` again after the layout changes, unless the learner has moved the camera. */
  refit(view: View): void {
    if (!this.moved) void this.goTo(view, false);
  }

  rotateBy(azimuth: number, polar: number): void {
    this.moved = true;
    void this.controls.rotate(azimuth, polar, !this.reducedMotion);
  }

  dollyBy(distance: number): void {
    this.moved = true;
    void this.controls.dolly(distance, !this.reducedMotion);
  }

  /** Updates the visible area and shifts the projection so the target sits at its center. */
  setLayout(canvasWidth: number, canvasHeight: number, visible: VisibleArea): void {
    this.canvasSize = { width: canvasWidth, height: canvasHeight };
    this.visible = visible;
    const offsetX = canvasWidth / 2 - (visible.x + visible.width / 2);
    const offsetY = canvasHeight / 2 - (visible.y + visible.height / 2);
    if (Math.abs(offsetX) < 0.5 && Math.abs(offsetY) < 0.5) this.camera.clearViewOffset();
    else
      this.camera.setViewOffset(
        canvasWidth,
        canvasHeight,
        offsetX,
        offsetY,
        canvasWidth,
        canvasHeight,
      );
    this.camera.aspect = canvasWidth / canvasHeight;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Each view is framed for a free area of its own aspect; a narrower or shorter free area pulls
   * the camera back, gently.
   */
  private backOff(): number {
    const v = this.visible;
    const aspect = this.view?.aspect ?? 1.6;
    if (!v) return 1;
    const h = this.canvasSize.height;
    const f = Math.max((aspect * h) / Math.max(1, v.width), h / Math.max(1, v.height), 1);
    return MathUtils.clamp(f ** 0.55, 1, 2);
  }

  update(deltaSeconds: number): boolean {
    return this.controls.update(deltaSeconds);
  }

  dispose(): void {
    this.controls.dispose();
  }
}
