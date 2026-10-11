/**
 * The renderer and its frame loop. The loop sleeps when nothing moves, pauses when the tab is
 * hidden or the canvas is offscreen, and survives a lost WebGL context.
 */
import { PCFShadowMap, Timer, WebGLRenderer } from 'three';

export interface StageHooks {
  /** Called every frame. Return true while something still moves, to keep the loop running. */
  frame(deltaSeconds: number, elapsedSeconds: number): boolean;
  resize(width: number, height: number, pixelRatio: number): void;
  contextLost(): void;
  contextRestored(): void;
}

export class Stage {
  readonly renderer: WebGLRenderer;
  width = 1;
  height = 1;
  pixelRatio = 1;
  private readonly canvas: HTMLCanvasElement;
  private readonly hooks: StageHooks;
  private readonly pixelRatioFor: (width: number, height: number) => number;
  private readonly timer = new Timer();
  private raf = 0;
  private running = false;
  private pageVisible = !document.hidden;
  private onScreen = true;
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;

  /** Throws when WebGL is unavailable; the caller shows a text fallback. */
  constructor(
    canvas: HTMLCanvasElement,
    hooks: StageHooks,
    pixelRatioFor: (width: number, height: number) => number,
  ) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.pixelRatioFor = pixelRatioFor;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      stencil: false,
      depth: false,
      powerPreference: 'high-performance',
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    // Shader checks stay on in development. In production they cost sync GPU calls and echo
    // harmless driver compiler notes (e.g. D3D's X4122) into the console.
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    // Count every pass of the post chain, not just the last.
    this.renderer.info.autoReset = false;
    this.timer.connect(document);

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver((entries) => {
      this.onScreen = entries.some((e) => e.isIntersecting);
      this.requestFrame();
    });
    this.intersectionObserver.observe(canvas);
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  /** Recomputes size and pixel ratio, e.g. after the quality tier changes. */
  resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const pixelRatio = this.pixelRatioFor(width, height);
    if (width === this.width && height === this.height && pixelRatio === this.pixelRatio) return;
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.hooks.resize(width, height, pixelRatio);
    this.requestFrame();
  }

  start(): void {
    this.running = true;
    this.resize();
    this.requestFrame();
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Wakes the loop for at least one frame. */
  requestFrame(): void {
    if (this.running && !this.raf && this.pageVisible && this.onScreen) {
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  private readonly tick = (time: number) => {
    this.raf = 0;
    if (!this.running) return;
    this.timer.update(time);
    // The first rAF timestamp can predate the timer's start, so clamp at zero as well as at 0.1 s.
    const dt = Math.max(0, Math.min(0.1, this.timer.getDelta()));
    this.renderer.info.reset();
    if (this.hooks.frame(dt, this.timer.getElapsed())) this.requestFrame();
  };

  private readonly onVisibility = () => {
    this.pageVisible = !document.hidden;
    this.requestFrame();
  };

  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    this.stop();
    this.hooks.contextLost();
  };

  private readonly onContextRestored = () => {
    this.hooks.contextRestored();
    this.renderer.shadowMap.needsUpdate = true;
    this.start();
  };

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.timer.dispose();
    this.renderer.dispose();
  }
}
