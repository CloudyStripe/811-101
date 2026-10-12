/**
 * Camera framing: a fixed view of the scene, fitted to the part of the canvas the panel or sheet
 * leaves free (ported from the diorama's visibleArea/fitted logic). The view doesn't move with
 * the pointer; it's framed so the lesson needs no turning or zooming.
 */
import { MathUtils, type PerspectiveCamera } from 'three';
import { fitShot, type Point3 } from './fit.ts';

export interface View {
  /** Where the camera looks from and at. With `mustSee`, only the direction between them counts. */
  position: Point3;
  target: Point3;
  /** Width over height of the free area the view is framed for. Narrower areas back off. */
  aspect: number;
  /**
   * Points that must be in view. When given, the camera is fitted so they all sit inside the free
   * area, centered, at any size (see fit.ts), instead of backing off by a rule of thumb.
   */
  mustSee?: readonly Point3[];
  /** Room left around the must-see points, as a share of the free area (default 0.08). */
  margin?: number;
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

export class LabCamera {
  private readonly camera: PerspectiveCamera;
  private visible: VisibleArea | null = null;
  private canvasSize = { width: 1, height: 1 };

  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
  }

  /** Places the camera for a view, backing off when less of the canvas is free (phones, panel). */
  frame(view: View): void {
    const v = this.visible;
    if (view.mustSee && v) {
      const pose = fitShot(
        { from: view.position, to: view.target, mustSee: view.mustSee },
        this.camera.fov,
        { width: v.width, height: v.height, canvasHeight: this.canvasSize.height },
        view.margin,
      );
      this.camera.position.copy(pose.position);
      this.camera.lookAt(pose.target);
      this.camera.updateMatrixWorld();
      return;
    }
    const [px, py, pz] = view.position;
    const [tx, ty, tz] = view.target;
    const k = this.backOff(view);
    this.camera.position.set(tx + (px - tx) * k, ty + (py - ty) * k, tz + (pz - tz) * k);
    this.camera.lookAt(tx, ty, tz);
    this.camera.updateMatrixWorld();
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
  private backOff(view: View): number {
    const v = this.visible;
    if (!v) return 1;
    const h = this.canvasSize.height;
    const f = Math.max((view.aspect * h) / Math.max(1, v.width), h / Math.max(1, v.height), 1);
    return MathUtils.clamp(f ** 0.55, 1, 2);
  }
}
