/**
 * Camera framing: a fixed view of the scene, fitted to the part of the canvas the panel or sheet
 * leaves free. The view doesn't move with the pointer; it's framed so the lesson needs no turning
 * or zooming. Each view names the points that must be in it, and the fit (fit.ts) places the
 * camera so they all sit inside the free area, centered, at any size.
 */
import type { PerspectiveCamera } from 'three';
import { fitShot, type Point3 } from './fit.ts';

export interface View {
  /** Where the camera looks from and at; only the direction between them counts. */
  position: Point3;
  target: Point3;
  /** Points that must be in view, labels' room included. */
  mustSee: readonly Point3[];
  /** Room left around them, as a share of the free area (default 0.08). */
  margin?: number;
  /** How close the camera may come to its target, however much room the free area has. */
  minDistance?: number;
  /** CSS pixels kept clear at the free area's sides for labels on points near them. */
  labelRoom?: number;
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

  /** Places the camera so the view's must-see points fit the free area. */
  frame(view: View): void {
    const v = this.visible ?? {
      x: 0,
      y: 0,
      width: this.canvasSize.width,
      height: this.canvasSize.height,
    };
    const pose = fitShot(
      {
        from: view.position,
        to: view.target,
        mustSee: view.mustSee,
        minDistance: view.minDistance,
        labelRoom: view.labelRoom,
      },
      this.camera.fov,
      { width: v.width, height: v.height, canvasHeight: this.canvasSize.height },
      view.margin,
    );
    this.camera.position.copy(pose.position);
    this.camera.lookAt(pose.target);
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
}
