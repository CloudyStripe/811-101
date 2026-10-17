/**
 * Camera framing: a view of the scene, fitted to the part of the canvas the panel or sheet leaves
 * free. Each view names the points that must be in it, and the fit (fit.ts) places the camera so
 * they all sit inside the free area, centered, at any size, and out from under any controls that
 * sit over it. The lab's view holds still, framed so the lesson needs no turning or zooming; the
 * diorama's camera rig (orbit.ts) starts from a framed view and moves on from there.
 */
import { MathUtils, Vector3, type PerspectiveCamera } from 'three';
import { CENTERED, fitShot, type FitRect, type Point3, type Shift } from './fit.ts';

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
  /**
   * The picture may slide off center to clear controls over the free area, where that lets the
   * camera stand nearer than pulling back would (`CameraPose.shift`).
   */
  slide?: boolean;
  /** The lowest the camera may look at: fitted lower, it looks along the same line, higher up. */
  floor?: number;
  /** The nearest the camera may stand to what it looks at, by how high that is. */
  nearestAt?: (height: number) => number;
  /**
   * The vertical field of view across the whole canvas, in degrees, if not the camera's own. A
   * wider one brings the camera in closer, so the near field looms larger against the far.
   */
  fov?: number;
}

/** A rectangle in the canvas, in CSS pixels. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The part of the canvas left free by the panel or sheet, in CSS pixels. */
export interface VisibleArea extends Box {
  /** Frame a portrait view here. Left out, it follows the area's shape. */
  portrait?: boolean;
  /** Controls over the area, such as a corner card: what the lesson needs stays out from under them. */
  keepOut?: readonly Box[];
}

/** Where the camera is, what it looks at, and its vertical field of view in degrees. */
export interface CameraPose {
  position: Vector3;
  target: Vector3;
  fov: number;
  /**
   * How far the picture slides off the free area's middle, for a view that may slide: the free
   * area's layout applies it (`setLayout`). Left out, none.
   */
  shift?: Shift;
}

/** A pose part way from one to another. */
export function lerpPose(a: CameraPose, b: CameraPose, t: number): CameraPose {
  return {
    position: a.position.clone().lerp(b.position, t),
    target: a.target.clone().lerp(b.target, t),
    fov: MathUtils.lerp(a.fov, b.fov, t),
  };
}

/**
 * A free area part way from one to another. Eased along with the pose, it glides the view to new
 * room instead of jumping there.
 */
export function areaBetween(a: VisibleArea, b: VisibleArea, t: number): VisibleArea {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    x: mix(a.x, b.x),
    y: mix(a.y, b.y),
    width: mix(a.width, b.width),
    height: mix(a.height, b.height),
    ...(b.portrait === undefined ? {} : { portrait: b.portrait }),
    ...(b.keepOut === undefined ? {} : { keepOut: b.keepOut }),
  };
}

export class LabCamera {
  private readonly camera: PerspectiveCamera;
  private readonly baseFov: number;
  private readonly target = new Vector3();
  private visible: VisibleArea | null = null;
  private canvasSize = { width: 1, height: 1 };

  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
    this.baseFov = camera.fov;
  }

  /** Places the camera so the view's must-see points fit the free area. */
  frame(view: View): void {
    this.setPose(this.poseFor(view));
  }

  /** The pose that frames the view in the free area set last, without moving the camera. */
  poseFor(view: View): CameraPose {
    const v = this.visible ?? {
      x: 0,
      y: 0,
      width: this.canvasSize.width,
      height: this.canvasSize.height,
    };
    const fov = view.fov ?? this.baseFov;
    const pose = fitShot(
      {
        from: view.position,
        to: view.target,
        mustSee: view.mustSee,
        minDistance: view.minDistance,
        labelRoom: view.labelRoom,
        keepOut: (v.keepOut ?? []).map((box) => toFitRect(box, v)),
        slide: view.slide,
        floor: view.floor,
        nearestAt: view.nearestAt,
      },
      fov,
      { width: v.width, height: v.height, canvasHeight: this.canvasSize.height },
      view.margin,
    );
    return { ...pose, fov };
  }

  /** The camera's pose now. */
  pose(): CameraPose {
    return {
      position: this.camera.position.clone(),
      target: this.target.clone(),
      fov: this.camera.fov,
    };
  }

  setPose(pose: CameraPose): void {
    if (this.camera.fov !== pose.fov) {
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
    }
    this.target.copy(pose.target);
    this.camera.position.copy(pose.position);
    this.camera.lookAt(pose.target);
    this.camera.updateMatrixWorld();
  }

  /**
   * Updates the visible area and shifts the projection so the target sits at its center, or slid
   * from it by `shift` (in the area's -1 to 1 units, y up).
   */
  setLayout(
    canvasWidth: number,
    canvasHeight: number,
    visible: VisibleArea,
    shift: Shift = CENTERED,
  ): void {
    this.canvasSize = { width: canvasWidth, height: canvasHeight };
    this.visible = visible;
    const offsetX = canvasWidth / 2 - (visible.x + (visible.width / 2) * (1 + shift.x));
    const offsetY = canvasHeight / 2 - (visible.y + (visible.height / 2) * (1 - shift.y));
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

/** A box in the canvas, in the free area's own -1 to 1 units, as the fit measures. */
function toFitRect(box: Box, area: Box): FitRect {
  const x = (px: number) => ((px - area.x) / Math.max(1, area.width)) * 2 - 1;
  const y = (py: number) => 1 - ((py - area.y) / Math.max(1, area.height)) * 2;
  return { x0: x(box.x), x1: x(box.x + box.width), y0: y(box.y + box.height), y1: y(box.y) };
}
