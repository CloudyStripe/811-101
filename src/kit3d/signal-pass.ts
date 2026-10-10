/**
 * Draws the signal effects after ambient occlusion, so AO never darkens them, and before bloom,
 * so they glow. The effects render additively into the current image; their shaders test against
 * the scene's depth texture (provided by the composer) so they stay hidden behind solid geometry.
 */
import { Pass } from 'postprocessing';
import {
  Vector2,
  type Camera,
  type Scene,
  type Texture,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';

export interface DepthUniforms {
  /** The scene's depth texture. */
  uSceneDepth: { value: Texture | null };
  /** Size of the render target in pixels. */
  uResolution: { value: Vector2 };
}

/** GLSL for the effect shaders: discards fragments behind the scene. */
export const DEPTH_TEST_GLSL = /* glsl */ `
uniform sampler2D uSceneDepth;
uniform vec2 uResolution;
bool behindScene() {
  float sceneDepth = texture2D(uSceneDepth, gl_FragCoord.xy / uResolution).x;
  return gl_FragCoord.z > sceneDepth + 0.00002;
}
`;

export function createDepthUniforms(): DepthUniforms {
  return { uSceneDepth: { value: null }, uResolution: { value: new Vector2(1, 1) } };
}

export class SignalPass extends Pass {
  /** Shared with the effect materials, and kept across post-chain rebuilds. */
  readonly uniforms: DepthUniforms;

  constructor(scene: Scene, camera: Camera, uniforms: DepthUniforms) {
    super('SignalPass', scene, camera);
    this.uniforms = uniforms;
    this.needsSwap = false;
    this.needsDepthTexture = true;
  }

  override setDepthTexture(depthTexture: Texture): void {
    this.uniforms.uSceneDepth.value = depthTexture;
  }

  override setSize(width: number, height: number): void {
    this.uniforms.uResolution.value.set(width, height);
  }

  override render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget | null): void {
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : inputBuffer);
    renderer.render(this.scene, this.camera);
    renderer.autoClear = autoClear;
  }
}
