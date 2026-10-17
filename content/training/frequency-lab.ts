/**
 * Everything the Frequency Lab says, kept apart from code. Every factual sentence is a claim with
 * a stable ID, so locators can sign it off in docs/CONTENT_REVIEW.md. Mark terms with [[term]] or
 * [[shown words|term key]]; each one needs a definition in TERMS.
 *
 * Keep it conceptual: plain sentences, one idea each, and no numbers beyond the frequencies.
 */
import type { Frequency } from '../../config/equipment.ts';
import { claim, type Claim } from '../../src/content-kit/claims.ts';
import type { LabelId } from '../../src/pages/frequency-lab/scene/labels.ts';
import type { SetupId } from '../../src/signal/model.ts';

type PerSetup<T> = Readonly<Record<SetupId, T>>;

/** The rule, as the lab's tagline. The static page shell repeats it (a test keeps them in step). */
export const TAGLINE = claim(
  'fl.tagline',
  'Use the lowest frequency that works: it travels farther and spreads less to other lines.',
);

/** Definitions for every marked term, keyed as `termKey()` normalizes them. */
export const TERMS: Readonly<Record<string, Claim>> = {
  transmitter: claim('fl.term.transmitter', 'A device that puts a signal on a buried line.'),
  receiver: claim(
    'fl.term.receiver',
    'A handheld device that picks up the signal from above ground, so the locator can follow the line.',
  ),
  frequency: claim(
    'fl.term.frequency',
    'How many times a second the signal repeats, in hertz (Hz). 8 kHz is 8,000 times a second.',
  ),
  'tracer wire': claim(
    'fl.term.tracer-wire',
    'A wire buried along a plastic pipe so the pipe can be found.',
  ),
  'bleed-over': claim(
    'fl.term.bleed-over',
    'Signal that spreads from your line onto other lines nearby. It can lead a locator to the wrong line.',
  ),
};

export const INTRO = {
  heading: 'How it works',
  claims: [
    claim(
      'fl.intro.find',
      'To find a buried line, a locator puts a signal on it with a [[transmitter]], then follows the signal from above with a [[receiver]].',
    ),
    claim(
      'fl.intro.frequency',
      "The signal's [[frequency]] matters: it changes how far the signal travels and how much of it spreads to other lines.",
    ),
  ],
  /** How to use the lab: an instruction, not a claim. */
  howTo: 'Pick a setup and a frequency, then watch the glowing signal.',
} as const;

export const SETUP_TEXT: PerSetup<{
  name: string;
  /** The line carrying the signal, as named in the key. */
  carrier: string;
  note: Claim;
  /** What carries the signal, where it isn't the line itself: said first in the summary. */
  carries?: Claim;
}> = {
  steel: {
    name: 'Steel main',
    carrier: 'Steel gas main',
    note: claim(
      'fl.setup.steel',
      'A steel gas main carries the signal itself, so the transmitter connects right to it.',
    ),
  },
  plastic: {
    name: 'Plastic main',
    carrier: 'Tracer wire',
    note: claim(
      'fl.setup.plastic',
      "Plastic can't carry a signal, so a [[tracer wire]] is buried along the pipe, and the transmitter connects to that.",
    ),
    carries: claim('fl.setup.plastic.carries', 'The [[tracer wire]] carries the signal.'),
  },
};

/**
 * What each frequency does, the same in both setups. Tests check these against the model: the
 * lower three reach the end of the block, and 83 kHz fades out before it.
 */
export const FREQUENCY_NOTES: Readonly<Record<Frequency, Claim>> = {
  512: claim(
    'fl.freq.512',
    'The signal reaches the end of the block, and almost none of it [[bleeds|bleed-over]] onto the telecom cable.',
  ),
  8000: claim(
    'fl.freq.8k',
    'The signal still reaches the end of the block, and a little of it [[bleeds|bleed-over]] onto the telecom cable.',
  ),
  33000: claim(
    'fl.freq.33k',
    'The signal is weaker by the end of the block, and more of it [[bleeds|bleed-over]] onto the telecom cable.',
  ),
  83000: claim(
    'fl.freq.83k',
    'The signal fades out before the end of the block, and much more of it [[bleeds|bleed-over]] onto the telecom cable.',
  ),
};

export const TRY_THIS: PerSetup<readonly Claim[]> = {
  steel: [
    claim(
      'fl.try.steel',
      'Step from 512 Hz up to 83 kHz. Watch the glow on the gas main end sooner, and more of the orange telecom cable light up.',
    ),
  ],
  plastic: [
    claim(
      'fl.try.plastic.wire',
      'Find the [[tracer wire]] on top of the plastic pipe: it carries the signal.',
    ),
    claim(
      'fl.try.plastic.reach',
      'Step up to 83 kHz and watch the signal fade out before the end of the block.',
    ),
  ],
};

export const RULE = {
  heading: 'The rule',
  claims: [
    claim('fl.rule.lowest', 'Use the lowest frequency that works.'),
    claim(
      'fl.rule.why',
      'Lower frequencies travel farther, and more of the signal stays on your line instead of spreading to others.',
    ),
    claim(
      'fl.rule.higher',
      "Higher frequencies are for when a lower one can't get enough signal onto the line.",
    ),
  ],
} as const;

export const KEY = {
  heading: 'Key',
  colors: claim(
    'fl.key.colors',
    "Lines are colored like the paint marks locators use: yellow for gas, orange for communications, blue for drinking water. Real pipes aren't always those colors.",
  ),
  /** Symbol explanations: they describe the lab's drawing, not the world. */
  signal:
    'Glowing bands: the signal. Brighter is stronger, and closer bands mean a higher frequency.',
  soil: 'Faint dashes in the soil: the signal returning to the ground stake.',
} as const;

export const ABOUT = {
  heading: 'About this model',
  claims: [
    claim(
      'fl.about.model',
      'What you see comes from a simplified teaching model, not from measurements.',
    ),
    claim(
      'fl.about.distances',
      'Distances are shortened so the frequencies are easy to compare. Real signals travel much farther, in the same order: lower frequencies farthest.',
    ),
    claim('fl.about.slowed', 'The signal is slowed way down so you can see it.'),
    claim(
      'fl.about.water',
      'Here the water main gets no signal. In the field, a line crossing yours can pick some up.',
    ),
  ],
  /** Scope, not a claim. */
  leftOut:
    'Not covered here: using the receiver, measuring depth, and other ways to put a signal on a line.',
} as const;

/** One-line definitions shown with each 3D label. */
export const LABEL_DEFINITIONS: Readonly<Record<LabelId, Claim | PerSetup<Claim>>> = {
  transmitter: claim('fl.label.transmitter', 'Puts the signal on the line.'),
  stake: claim(
    'fl.label.stake',
    'A metal rod in the soil. The signal returns to it, completing the loop.',
  ),
  access: {
    steel: claim('fl.label.test-station', 'Where the transmitter connects to the steel main.'),
    plastic: claim('fl.label.tracer-box', 'Where the transmitter connects to the tracer wire.'),
  },
  target: {
    steel: claim(
      'fl.label.steel-main',
      'A steel pipe carrying natural gas. The metal carries the signal.',
    ),
    plastic: claim(
      'fl.label.plastic-main',
      "A plastic pipe carrying natural gas. Plastic can't carry the signal.",
    ),
  },
  tracer: claim(
    'fl.label.tracer',
    'A wire buried with the plastic pipe. It carries the signal so the pipe can be found.',
  ),
  telecom: claim('fl.label.telecom', 'A phone or internet cable. Signal can bleed onto it.'),
  water: claim('fl.label.water', 'A drinking water main crossing under the street.'),
};

export function labelDefinition(id: LabelId, setup: SetupId): Claim {
  const d = LABEL_DEFINITIONS[id];
  return 'kind' in d ? d : d[setup];
}

/** The lab's content, as one module for the review doc. */
export const FREQUENCY_LAB = {
  TAGLINE,
  INTRO,
  SETUP_TEXT,
  FREQUENCY_NOTES,
  TRY_THIS,
  RULE,
  KEY,
  ABOUT,
  LABEL_DEFINITIONS,
  TERMS,
};
