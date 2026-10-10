/**
 * The post chain: scene → ambient occlusion → signal effects → bloom → Neutral tone mapping →
 * SMAA. Bloom's threshold sits above anything a lit surface reaches, so only emitters glow.
 */
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import { HalfFloatType, type Camera, type Scene, type WebGLRenderer } from 'three';
import type { TierSettings } from './quality.ts';
import { SignalPass, type DepthUniforms } from './signal-pass.ts';

export interface Post {
  setSize(width: number, height: number): void;
  render(deltaSeconds: number): void;
  dispose(): void;
}

export const BLOOM_THRESHOLD = 2.5;

/** Starts fetching the ambient-occlusion chunk early, when the tier uses it. */
export function preloadPost(tier: TierSettings): void {
  if (tier.ao) void import('n8ao');
}

export async function createPost(
  renderer: WebGLRenderer,
  scene: Scene,
  fxScene: Scene,
  camera: Camera,
  tier: TierSettings,
  depthUniforms: DepthUniforms,
): Promise<Post> {
  const composer = new EffectComposer(renderer, {
    frameBufferType: HalfFloatType,
    multisampling: tier.msaa,
  });
  composer.addPass(new RenderPass(scene, camera));

  if (tier.ao) {
    const { N8AOPostPass } = await import('n8ao');
    const ao = new N8AOPostPass(scene, camera, 1, 1);
    Object.assign(ao.configuration, {
      aoRadius: 2.2,
      distanceFalloff: 1.4,
      intensity: 2.2,
      halfRes: true,
      depthAwareUpsampling: true,
      gammaCorrection: false,
      screenSpaceRadius: false,
    });
    ao.setQualityMode('Medium');
    composer.addPass(ao);
  }

  const signalPass = new SignalPass(fxScene, camera, depthUniforms);
  composer.addPass(signalPass);

  const bloom = new BloomEffect({
    mipmapBlur: true,
    luminanceThreshold: BLOOM_THRESHOLD,
    luminanceSmoothing: 0.4,
    intensity: 1.15,
    radius: 0.72,
    resolutionScale: tier.bloomScale,
  });
  composer.addPass(
    new EffectPass(camera, bloom, new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL })),
  );
  if (tier.smaa) {
    composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
  }

  return {
    setSize: (w, h) => {
      composer.setSize(w, h, false);
    },
    render: (dt) => {
      composer.render(dt);
    },
    dispose: () => {
      composer.dispose();
    },
  };
}
