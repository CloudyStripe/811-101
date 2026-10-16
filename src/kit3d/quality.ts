/**
 * Quality tiers. `auto` starts from a guess about the GPU and a frame-time governor adjusts it;
 * the learner can pin a tier in Settings or with `?tier=`.
 */

export const TIERS = ['low', 'medium', 'high'] as const;
export type Tier = (typeof TIERS)[number];

export interface TierSettings {
  /** Cap on rendered pixels, in megapixels. */
  renderCapMp: number;
  msaa: number;
  smaa: boolean;
  ao: boolean;
  shadowMapSize: number;
  shadowRadius: number;
  /** Bloom resolution as a share of the screen. */
  bloomScale: number;
  /** Share of the grass tufts drawn. */
  detail: number;
}

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  high: {
    renderCapMp: 2.1,
    msaa: 4,
    // MSAA resolves before tone mapping, where the pale sky is far brighter than 1, so an edge
    // against it shows almost all sky; SMAA after tone mapping smooths what that leaves.
    smaa: true,
    ao: true,
    shadowMapSize: 2048,
    shadowRadius: 4,
    bloomScale: 1,
    detail: 1,
  },
  medium: {
    renderCapMp: 1.3,
    msaa: 0,
    smaa: true,
    ao: true,
    shadowMapSize: 1024,
    shadowRadius: 3,
    bloomScale: 0.5,
    detail: 0.7,
  },
  low: {
    renderCapMp: 0.8,
    msaa: 0,
    smaa: true,
    ao: false,
    shadowMapSize: 1024,
    shadowRadius: 2,
    bloomScale: 0.25,
    detail: 0.4,
  },
};

/** Device pixel ratio that keeps the rendered size under the tier's cap. */
export function pixelRatioFor(
  tier: Tier,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): number {
  const pixels = Math.max(1, cssWidth * cssHeight);
  const capped = Math.sqrt((TIER_SETTINGS[tier].renderCapMp * 1e6) / pixels);
  return Math.max(0.5, Math.min(dpr, capped));
}

/**
 * A first guess from the GPU's name. Discrete GPUs start high; integrated GPUs and phones start
 * at medium; software renderers start low. The governor corrects a wrong guess.
 */
export function guessTier(gpu: string, coarsePointer: boolean): Tier {
  const g = gpu.toLowerCase();
  if (/swiftshader|llvmpipe|software|basic render/.test(g)) return 'low';
  if (coarsePointer) return 'medium';
  if (/nvidia|geforce|rtx|quadro|radeon rx|radeon pro|arc a\d|apple m\d (pro|max|ultra)/.test(g)) {
    return 'high';
  }
  return 'medium';
}

export function parseTier(value: string | null | undefined): Tier | null {
  return TIERS.find((t) => t === value) ?? null;
}

const STEP_DOWN_P95_MS = 20;
const STEP_UP_P95_MS = 12;
const WINDOW_MS = 3000;
const STEP_UP_AFTER_MS = 10_000;
/** Shader compilation makes the first seconds slow on every GPU; don't judge them. */
const WARMUP_MS = 4000;
const SETTLE_MS = 2500;

/**
 * Watches frame times. Steps down when the 95th-percentile frame time over the last window
 * exceeds 20 ms; steps back up only after 10 s of frames under 12 ms, and never above `ceiling`.
 */
export class Governor {
  tier: Tier;
  private readonly ceiling: Tier;
  private samples: number[] = [];
  private windowStart = 0;
  private goodSince: number | null = null;
  /** Frames before this time are ignored: start-up and post-switch hitches aren't real load. */
  private ignoreUntil: number | null = null;

  constructor(tier: Tier, ceiling: Tier) {
    this.tier = tier;
    this.ceiling = ceiling;
  }

  /** Ignores frames for a while, e.g. after a setup switch or a tier change. */
  settle(now: number, ms = SETTLE_MS): void {
    this.ignoreUntil = now + ms;
    this.samples = [];
    this.goodSince = null;
  }

  /** Records one frame. Returns the new tier when it changes, otherwise null. */
  sample(frameMs: number, now: number): Tier | null {
    this.ignoreUntil ??= now + WARMUP_MS;
    if (now < this.ignoreUntil) {
      this.samples = [];
      return null;
    }
    if (this.samples.length === 0) this.windowStart = now;
    this.samples.push(frameMs);
    if (now - this.windowStart < WINDOW_MS) return null;

    const sorted = [...this.samples].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    this.samples = [];
    const index = TIERS.indexOf(this.tier);

    if (p95 > STEP_DOWN_P95_MS && index > 0) {
      this.goodSince = null;
      return this.set(TIERS[index - 1]);
    }
    if (p95 < STEP_UP_P95_MS && index < TIERS.indexOf(this.ceiling)) {
      this.goodSince ??= now;
      if (now - this.goodSince >= STEP_UP_AFTER_MS) {
        this.goodSince = null;
        return this.set(TIERS[index + 1]);
      }
    } else {
      this.goodSince = null;
    }
    return null;
  }

  private set(tier: Tier | undefined): Tier | null {
    if (!tier) return null;
    this.tier = tier;
    return tier;
  }
}
