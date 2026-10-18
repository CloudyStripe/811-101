/**
 * How deep the lab's ground is drawn for a free area: as deep as it takes for the block, framed in
 * the area by the page's own camera, to fill the area's height as well as its width, within the
 * view's bounds. Deep where the room is tall for its width, shallow in a strip, as above a drawer
 * open on a desktop, where the block fills the width instead. Chosen in half steps, and kept while a
 * new area asks for nearly the same, so a window resized a little doesn't build the block again.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { LabCamera, type VisibleArea } from '../../../kit3d/camera.ts';
import { VIEW_GROUND, layoutFor, viewOf, type ViewKind } from './layout.ts';

/** The step the depth is chosen in, in times true. */
const STEP = 0.5;
/** How far the ideal depth may stray from the one built before it's built anew. */
const KEEP = 0.6;

export function depthFor(
  kind: ViewKind,
  area: VisibleArea,
  canvas: { width: number; height: number },
  now?: number,
): number {
  const { least, most } = VIEW_GROUND[kind];
  if (area.width < 1 || area.height < 1 || canvas.width < 1 || canvas.height < 1) {
    return now ?? least;
  }
  const camera = new PerspectiveCamera(34, canvas.width / canvas.height, 0.5, 2400);
  const lab = new LabCamera(camera);
  lab.setLayout(canvas.width, canvas.height, area);
  const v = new Vector3();
  /** Whether the block, drawn this deep and framed in the area, is held by the area's height. */
  const heldByHeight = (depth: number) => {
    const view = viewOf(layoutFor(kind, depth), kind);
    lab.frame(view);
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const p of view.mustSee) {
      v.set(...p).project(camera);
      [x0, x1, y0, y1] = [
        Math.min(x0, v.x),
        Math.max(x1, v.x),
        Math.min(y0, v.y),
        Math.max(y1, v.y),
      ];
    }
    // How much of the room the fit leaves it each way the block takes.
    const margin = view.margin ?? 0.08;
    const roomX = Math.max((margin * area.width) / 2, view.labelRoom ?? 0);
    const roomY = (margin * area.height) / 2;
    const across = (((x1 - x0) / 2) * canvas.width) / Math.max(1, area.width - 2 * roomX);
    const down = (((y1 - y0) / 2) * canvas.height) / Math.max(1, area.height - 2 * roomY);
    return down >= across;
  };
  let ideal: number;
  if (heldByHeight(least)) ideal = least;
  else if (!heldByHeight(most)) ideal = most;
  else {
    let [lo, hi] = [least, most];
    while (hi - lo > STEP / 8) {
      const mid = (lo + hi) / 2;
      if (heldByHeight(mid)) hi = mid;
      else lo = mid;
    }
    ideal = (lo + hi) / 2;
  }
  if (now !== undefined && Math.abs(ideal - now) < KEEP) return now;
  return Math.min(most, Math.max(least, Math.round(ideal / STEP) * STEP));
}
