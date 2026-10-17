/**
 * A 3D page's runtime: the renderer and its frame loop, the quality tier (guessed and governed, or
 * pinned), the post chain and its rebuilds, compiling shaders before the first frame, capture mode
 * for screenshots, the scene-ready signal, the perf HUD and a lost graphics context. A page brings
 * its scene, its post chain and what moves in it; the runtime draws it.
 */
import { HalfFloatType, WebGLRenderTarget, type PerspectiveCamera, type Scene } from 'three';
import { PerfHud } from './perf.ts';
import type { Post } from './post.ts';
import {
  Governor,
  TIER_SETTINGS,
  guessTier,
  pixelRatioFor,
  type Tier,
  type TierSettings,
} from './quality.ts';
import { Stage } from './stage.ts';

export interface RuntimeOptions {
  canvas: HTMLCanvasElement;
  /** `auto` guesses from the GPU and lets a frame-time governor adjust; a tier pins it. */
  tier: Tier | 'auto';
  /** Deterministic frames for screenshots: a fixed tier, no governor, one frame and then still. */
  capture: boolean;
  perf: boolean;
  camera: PerspectiveCamera;
  /** Builds the page's post chain for a tier's settings. */
  post: (settings: TierSettings) => Promise<Post>;
}

export interface RuntimeHooks {
  /** Each frame, before drawing: move what moves. True while anything still does. */
  frame(deltaSeconds: number): boolean;
  /** After the canvas changes size, in CSS pixels. */
  resize(width: number, height: number): void;
  /** A new tier is in, its post chain built: apply its other settings (shadows, detail). */
  tierChanged(settings: TierSettings): void;
  contextLost?(): void;
  contextRestored?(): void;
}

export class SceneRuntime {
  readonly stage: Stage;
  private currentTier: Tier;
  private governor: Governor | null = null;
  private post: Post | null = null;
  private rebuilding = false;
  /** The tier asked for most recently, which a rebuild in progress picks up when it's done. */
  private wantedTier: Tier | null = null;
  private disposed = false;
  private readonly hud: PerfHud | null;
  private readonly options: RuntimeOptions;
  private readonly hooks: RuntimeHooks;

  /** Throws when WebGL is unavailable; the page shows a text fallback. */
  constructor(options: RuntimeOptions, hooks: RuntimeHooks) {
    this.options = options;
    this.hooks = hooks;
    this.currentTier = options.tier === 'auto' ? 'medium' : options.tier;
    this.stage = new Stage(
      options.canvas,
      {
        frame: (dt) => {
          const post = this.post;
          if (!post) return false;
          const moving = hooks.frame(dt);
          post.render(dt);
          const now = performance.now();
          this.hud?.frame(
            dt * 1000,
            now,
            this.stage.renderer,
            this.currentTier,
            this.stage.pixelRatio,
          );
          const next = this.governor?.sample(dt * 1000, now);
          if (next) void this.changeTier(next);
          return moving;
        },
        resize: (width, height) => {
          this.post?.setSize(width, height);
          hooks.resize(width, height);
        },
        contextLost: () => hooks.contextLost?.(),
        contextRestored: () => {
          // The post chain's render targets went with the lost context. It's built afresh for the
          // tier, and the old one let go without disposing: its GPU objects belong to no context
          // now, and deleting them, as resizing them would, only warns. Nothing draws until then.
          this.post = null;
          void this.buildPost(this.currentTier).then((post) => {
            if (this.disposed) {
              post.dispose();
              return;
            }
            this.post = post;
            this.stage.requestFrame();
          }, console.error);
          hooks.contextRestored?.();
        },
      },
      (w, h) => pixelRatioFor(this.currentTier, w, h, window.devicePixelRatio || 1),
    );
    if (options.tier === 'auto') {
      const guessed = this.guess();
      this.currentTier = options.capture ? 'medium' : guessed;
      if (!options.capture) this.governor = new Governor(this.currentTier, guessed);
    }
    this.hud = options.perf ? new PerfHud(document.body) : null;
  }

  get renderer() {
    return this.stage.renderer;
  }

  get tier(): Tier {
    return this.currentTier;
  }

  get settings(): TierSettings {
    return TIER_SETTINGS[this.currentTier];
  }

  /** Builds the first post chain. Everything is built before the loop starts. */
  async init(): Promise<void> {
    this.stage.resize();
    this.swapPost(await this.buildPost(this.currentTier));
  }

  /**
   * Compiles every program the scenes need, so the first frame (and anything shown later) never
   * stalls. three keys programs on the render target, so this compiles against an offscreen target
   * like the post chain's. Async needs KHR_parallel_shader_compile.
   */
  async compile(scenes: readonly Scene[]): Promise<void> {
    const { renderer } = this.stage;
    const { camera } = this.options;
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
    renderer.setRenderTarget(target);
    // compileAsync starts compiling before it returns, so the target only needs binding until then.
    let ready: Promise<unknown> | null = null;
    if (renderer.extensions.has('KHR_parallel_shader_compile')) {
      ready = Promise.all(scenes.map((s) => renderer.compileAsync(s, camera)));
    } else {
      for (const s of scenes) renderer.compile(s, camera);
    }
    renderer.setRenderTarget(null);
    target.dispose();
    await ready;
  }

  /**
   * Starts the loop and says the scene is ready. In capture mode it draws one settled frame
   * (after `beforeCapture`, e.g. placing labels) and then holds still.
   */
  start(beforeCapture?: () => void): void {
    this.stage.start();
    if (this.options.capture) {
      beforeCapture?.();
      this.renderOnce();
      this.stage.stop();
    }
    document.documentElement.dataset.sceneReady = 'true';
    window.dispatchEvent(new Event('scene:ready'));
  }

  /** Draws one frame now, outside the loop: for capture mode, where the loop has stopped. */
  renderOnce(): void {
    this.post?.render(1 / 60);
  }

  requestFrame(): void {
    this.stage.requestFrame();
  }

  /** A moment the frame rate isn't the scene's fault (a setup switch), so the governor waits. */
  settle(): void {
    this.governor?.settle(performance.now());
  }

  async setTier(next: Tier | 'auto'): Promise<void> {
    if (next === 'auto') {
      const guessed = this.guess();
      this.governor = new Governor(guessed, guessed);
      await this.changeTier(guessed);
    } else {
      this.governor = null;
      await this.changeTier(next);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stage.dispose();
    this.post?.dispose();
    this.hud?.dispose();
  }

  private guess(): Tier {
    const gl = this.stage.renderer.getContext();
    return guessTier(String(gl.getParameter(gl.RENDERER)), matchMedia('(pointer: coarse)').matches);
  }

  private async buildPost(tier: Tier): Promise<Post> {
    const post = await this.options.post(TIER_SETTINGS[tier]);
    post.setSize(this.stage.width, this.stage.height);
    return post;
  }

  private swapPost(next: Post) {
    const old = this.post;
    this.post = next;
    old?.dispose();
  }

  /** Rebuilds for a new tier. A tier asked for during a rebuild is applied right after it. */
  private async changeTier(next: Tier) {
    this.wantedTier = next;
    if (this.rebuilding) return;
    this.rebuilding = true;
    // Read through functions: other calls can change these during the await below.
    const wanted = (): Tier | null => this.wantedTier;
    const gone = () => this.disposed;
    try {
      for (
        let want = wanted();
        want !== null && want !== this.currentTier && !gone();
        want = wanted()
      ) {
        // The tier changes only once its post chain is built, so a failed build changes nothing.
        const post = await this.buildPost(want);
        if (gone()) {
          post.dispose();
          break;
        }
        this.swapPost(post);
        this.currentTier = want;
        this.hooks.tierChanged(TIER_SETTINGS[want]);
        this.stage.resize();
        this.governor?.settle(performance.now());
        this.stage.requestFrame();
      }
    } catch (error) {
      // E.g. the ambient-occlusion chunk failed to load; the current tier keeps working.
      console.error(error);
    } finally {
      this.rebuilding = false;
      this.wantedTier = null;
    }
  }
}
