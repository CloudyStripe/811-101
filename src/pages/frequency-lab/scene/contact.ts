/**
 * Soft contact shadows where things stand on the ground. The quality tier without ambient
 * occlusion shows these instead, so objects still sit in the grass rather than float on it.
 */
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { LabLayout } from './layout.ts';

/** Just above the grass, which tops out at 0.12 ft. */
const GROUND_Y = 0.13;

/** A round, soft-edged shadow: dark in the middle, fading to nothing at the edge. */
function blobTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0, 0, 0, 1)');
    g.addColorStop(0.45, 'rgba(0, 0, 0, 0.55)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

/** Footprints in feet: center, size along x and z, and turn about the vertical. */
function footprints({ hookup, hydrant }: LabLayout) {
  return [
    { x: hookup.transmitter.x, z: hookup.transmitter.z, w: 2.5, d: 1.9, turn: -0.55 },
    { x: hookup.pedestal.x, z: hookup.pedestal.z, w: 2.0, d: 1.7, turn: 0 },
    { x: hydrant.x, z: hydrant.z, w: 1.5, d: 1.5, turn: 0 },
    { x: hookup.access.x, z: hookup.access.z, w: 1.0, d: 1.0, turn: 0 },
  ];
}

export function buildContactShadows(layout: LabLayout): Group {
  const group = new Group();
  group.name = 'contact-shadows';
  const material = new MeshBasicMaterial({
    color: 0x000000,
    map: blobTexture(),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    // Drawn over the grass it lies on, without fighting it for depth.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (const f of footprints(layout)) {
    const geometry = new PlaneGeometry(f.w, f.d).rotateX(-Math.PI / 2).rotateY(f.turn);
    const blob = new Mesh(geometry, material);
    blob.position.set(f.x, GROUND_Y, f.z);
    blob.renderOrder = 1;
    group.add(blob);
  }
  return group;
}
