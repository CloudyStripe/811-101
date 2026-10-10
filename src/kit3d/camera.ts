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
}

/** The part of the canvas left free by the panel or sheet, in CSS pixels. */
export interface VisibleArea {
  x: number;
  y: number;
  width: number;
  height: number;
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
    this.controls = c;
  }

  /** Frames a view, backing off when less of the canvas is visible (phones, open panel). */
  goTo(view: View, transition = true): Promise<void> {
    this.view = view;
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

  /** Re-frames the current view, e.g. after the layout changes. */
  reframe(): Promise<void> | undefined {
    return this.view ? this.goTo(this.view, false) : undefined;
  }

  rotateBy(azimuth: number, polar: number): void {
    void this.controls.rotate(azimuth, polar, !this.reducedMotion);
  }

  dollyBy(distance: number): void {
    void this.controls.dolly(distance, !this.reducedMotion);
  }

  truckBy(x: number, y: number): void {
    void this.controls.truck(x, y, !this.reducedMotion);
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
   * Views are authored for a wide desktop canvas; narrower visible areas pull the camera back,
   * gently, since a long street block can run off the sides of a portrait screen.
   */
  private backOff(): number {
    const v = this.visible;
    if (!v) return 1;
    const h = this.canvasSize.height;
    const f = Math.max((1.6 * h) / Math.max(1, v.width), h / Math.max(1, v.height), 1);
    return MathUtils.clamp(f ** 0.55, 1, 2);
  }

  update(deltaSeconds: number): boolean {
    return this.controls.update(deltaSeconds);
  }

  dispose(): void {
    this.controls.dispose();
  }
}
