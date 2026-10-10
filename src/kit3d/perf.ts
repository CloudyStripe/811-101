/** `?perf`: a small overlay with frame rate, frame time, draw calls, triangles and tier. */
import type { WebGLRenderer } from 'three';

export class PerfHud {
  private readonly el: HTMLElement;
  private frames: number[] = [];
  private lastUpdate = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'perf-hud';
    this.el.setAttribute('aria-hidden', 'true');
    parent.append(this.el);
  }

  frame(
    frameMs: number,
    now: number,
    renderer: WebGLRenderer,
    tier: string,
    pixelRatio: number,
  ): void {
    this.frames.push(frameMs);
    if (now - this.lastUpdate < 500) return;
    this.lastUpdate = now;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    this.frames = [];
    const { calls, triangles } = renderer.info.render;
    this.el.textContent = [
      `${(1000 / Math.max(1, avg)).toFixed(0)} fps`,
      `p95 ${p95.toFixed(1)} ms`,
      `${calls} draws`,
      `${(triangles / 1000).toFixed(0)}k tris`,
      `${tier} @ ${pixelRatio.toFixed(2)}x`,
    ].join(' · ');
  }

  dispose(): void {
    this.el.remove();
  }
}
