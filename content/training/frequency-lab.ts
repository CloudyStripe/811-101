/**
 * Everything the Frequency Lab says, kept apart from code. Every factual sentence is a claim with
 * a stable ID, so locators can sign it off in docs/CONTENT_REVIEW.md. Mark terms with [[term]] or
 * [[shown words|term key]]; each one needs a definition in TERMS.
 */
import type { Frequency } from '../../config/equipment.ts';
import { claim, type Claim } from '../../src/content-kit/claims.ts';
import type { LabelId } from '../../src/pages/frequency-lab/scene/labels.ts';
import { WORKS_THRESHOLD_MA } from '../../src/signal/constants.ts';
import type { SetupId } from '../../src/signal/model.ts';

type PerSetup<T> = Readonly<Record<SetupId, T>>;

/** The rule, as the lab's tagline. The static page shell repeats it (a test keeps them in step). */
export const TAGLINE = claim(
  'fl.tagline',
  'Use the lowest frequency that works: it travels farther and bleeds less onto other lines.',
);

/**
 * The live summary of what the 3D view shows, filled in from the model. {setup}, {frequency},
 * {left}, {short}, {share} and {target} are replaced; {short} is SUMMARY_TOO_WEAK or nothing.
 */
export const SUMMARY = claim(
  'fl.summary',
  '{setup} at {frequency}: {left} of the signal is left at the far end of the block{short}. The telecom cable carries {share} as much as the {target}, flowing back toward the stake.',
  { note: 'describes the state of the lab model' },
);
export const SUMMARY_TOO_WEAK = ', too little to trace';

/** Definitions for every marked term, keyed as `termKey()` normalizes them. */
export const TERMS: Readonly<Record<string, Claim>> = {
  transmitter: claim(
    'fl.term.transmitter',
    'The unit that puts a signal current on a buried line, so a receiver can find the line from above.',
  ),
  receiver: claim(
    'fl.term.receiver',
    'The handheld unit a locator carries. It senses the magnetic field around a line that carries the signal.',
  ),
  frequency: claim(
    'fl.term.frequency',
    'How many times a second the signal current cycles back and forth, measured in hertz (Hz). 8 kHz is 8,000 cycles a second.',
  ),
  current: claim(
    'fl.term.current',
    'The flow of electricity along a line, shown here in milliamps (mA). More current makes a stronger signal.',
  ),
  resistance: claim(
    'fl.term.resistance',
    'How much a circuit holds back current, in ohms (Ω). The higher it is, the less current flows.',
  ),
  circuit: claim(
    'fl.term.circuit',
    'The complete loop the signal travels: from the transmitter out along the line, through the soil, and back through the ground stake.',
  ),
  'ground stake': claim(
    'fl.term.ground-stake',
    'A metal rod pushed into the soil and wired to the transmitter. Current returns to it through the earth, completing the circuit.',
  ),
  'test station': claim(
    'fl.term.test-station',
    'A post with test wires attached to a steel pipe, used to check its corrosion protection. Locators can connect a transmitter to it.',
  ),
  'tracer wire': claim(
    'fl.term.tracer-wire',
    "An insulated metal wire buried along a plastic pipe. Plastic can't carry a locate signal, so the wire carries it instead.",
  ),
  'tracer test box': claim(
    'fl.term.tracer-test-box',
    'A small box at ground level where the tracer wire comes up, so a locator can connect to it.',
  ),
  'bleed-over': claim(
    'fl.term.bleed-over',
    "Signal that spreads from the line you're tracing onto nearby metal lines. A receiver picks it up there too, so it can be mistaken for your line.",
  ),
  'apwa color code': claim(
    'fl.term.apwa',
    'The uniform colors used to mark buried lines, such as yellow for gas, orange for communications and blue for drinking water.',
  ),
};

export const INTRO = {
  heading: 'Start here',
  claims: [
    claim(
      'fl.intro.transmitter',
      'A locator uses a [[transmitter]] to put a signal [[current]] on a buried metal line, then follows the line from above with a [[receiver]].',
    ),
    claim(
      'fl.intro.loop',
      'The current flows out along the line, leaks into the soil, and returns through the earth to the [[ground stake]]. Together they make one complete [[circuit]].',
    ),
    claim(
      'fl.intro.frequency',
      "The [[frequency]] you choose changes how the signal behaves. Lower frequencies stay on your line better and travel farther. Higher frequencies leak off sooner, don't travel as far, and [[bleed over|bleed-over]] onto nearby lines more.",
    ),
  ],
  /** How to use the lab: instructions, not claims. */
  howTo:
    'Switch between the two setups and step the transmitter through its four frequencies. Brighter means a stronger signal, and the glow on your line fades out where the signal gets too weak to trace. Closer bands mean a higher frequency, slowed way down so you can see it. Drag to turn the view, or use the view buttons.',
} as const;

export const SETUP_TEXT: PerSetup<{
  name: string;
  /** The line carrying the signal, as named in the chart and key. */
  carrier: string;
  /** The same, mid-sentence. */
  target: string;
  note: Claim;
}> = {
  steel: {
    name: 'Steel main',
    carrier: 'Steel gas main',
    target: 'main',
    note: claim(
      'fl.setup.steel',
      'The transmitter is connected to the steel gas main at a [[test station]]. A long metal main has many paths to the earth, so it makes a good circuit and plenty of current flows.',
    ),
  },
  plastic: {
    name: 'Plastic main',
    carrier: 'Tracer wire',
    target: 'tracer wire',
    note: claim(
      'fl.setup.plastic',
      "Plastic can't carry the signal, so the transmitter is connected to the [[tracer wire]] at a [[tracer test box]]. The insulated wire connects to the earth directly only where it's grounded, so its circuit has more resistance and less current flows.",
    ),
  },
};

export const FREQUENCY_NOTES: Readonly<Record<Frequency, Claim>> = {
  512: claim(
    'fl.freq.512',
    'At 512 Hz, the lowest frequency here, the signal leaks into the soil most slowly. It travels farthest along the line, and the least of it bleeds onto the telecom cable.',
  ),
  8000: claim(
    'fl.freq.8k',
    'At 8 kHz, noticeably more of the signal leaks off along the way, and more of it bleeds onto the telecom cable.',
  ),
  33000: claim(
    'fl.freq.33k',
    'At 33 kHz, the signal leaks off much sooner and fades along the block, and still more of it bleeds onto the telecom cable.',
  ),
  83000: claim(
    'fl.freq.83k',
    "At 83 kHz, the highest frequency here, the signal leaks off soonest. It doesn't travel far, and more of it bleeds onto the telecom cable than at any other frequency.",
  ),
};

export const BLEED_DIRECTION = claim(
  'fl.bleed.direction',
  'Bleed-over current usually flows back toward the stake, the opposite way to the current on your line. Receivers with a signal direction feature use that difference to help tell your line from others.',
);

export const TRY_THIS: PerSetup<readonly Claim[]> = {
  steel: [
    claim(
      'fl.try.steel.reach',
      'Step from 512 Hz up to 83 kHz and watch the glow along the main: it dims sooner at each step, and at 83 kHz it fades out before the far end.',
    ),
    claim(
      'fl.try.steel.bleed',
      'Watch the orange telecom cable as you go higher: more and more of the signal bleeds onto it.',
    ),
    claim(
      'fl.try.steel.chart',
      'In the chart, find where 33 kHz and 83 kHz become too weak to trace. The lower frequencies stay strong past the end of the chart.',
    ),
  ],
  plastic: [
    claim(
      'fl.try.plastic.wire',
      'Find the [[tracer wire]], the thin line riding just above the plastic main. It carries the signal.',
    ),
    claim(
      'fl.try.plastic.current',
      "Compare the transmitter's current with the steel main's: the tracer wire's circuit carries much less.",
    ),
    claim(
      'fl.try.plastic.reach',
      'Step up to 83 kHz: on the tracer wire, the signal gets too weak to trace before the far end of the block.',
    ),
  ],
};

export const RULE = {
  heading: 'The rule',
  claims: [
    claim('fl.rule.lowest', 'Use the lowest frequency that works.'),
    claim(
      'fl.rule.why',
      'It travels farthest along your line and bleeds least onto others, so more of the signal you follow is on your line.',
    ),
    claim(
      'fl.rule.step-up',
      "If a low frequency can't put enough signal on the line, check your connection and ground first, then step up one frequency at a time.",
    ),
    claim(
      'fl.rule.higher',
      "Higher frequencies get onto a poor circuit more easily, such as a poorly grounded tracer wire or a line with insulated joints. That's when stepping up helps.",
    ),
  ],
} as const;

export const KEY = {
  heading: 'Key',
  colorCode: claim(
    'fl.key.color-code',
    'Locators mark buried lines with the [[APWA color code]]: yellow for gas, orange for communications, blue for drinking water.',
  ),
  tints: claim(
    'fl.key.tints',
    "A buried line's own color isn't a reliable guide, so the colors on the lines here are a teaching aid.",
  ),
  /** Symbol explanations: they describe the lab's drawing, not the world. */
  signal:
    'Locate signal. Brighter means stronger, and on your line the glow fades out where the signal gets too weak to trace. Closer bands mean a higher frequency.',
  arrows: 'Which way current flows: out along your line, back along bleed-over.',
  soil: 'Current returning through the soil to the ground stake.',
  scale: 'Lines are drawn thicker than real so they show at this scale.',
} as const;

export const ABOUT = {
  heading: 'About this model',
  claims: [
    claim(
      'fl.about.illustrative',
      'Readings are illustrative. The current, resistance and signal on every line come from a small teaching model, not measurements.',
    ),
    claim(
      'fl.about.compressed',
      'Distances are compressed. The signal fades within one block here so the frequencies are easy to compare. On a real, continuous line, signals usually travel much farther, in the same order, with lower frequencies farthest.',
    ),
    claim(
      'fl.about.slowed',
      'The signal is slowed way down. A real one cycles hundreds to tens of thousands of times a second; here, the spacing of the bands stands in for frequency.',
    ),
    claim(
      'fl.about.brightness',
      'Brightness is scaled within each setup, since the tracer wire carries far less current than the steel main. On your line, the glow fades out where the signal gets too weak to trace.',
    ),
    claim(
      'fl.about.water',
      'The water main gets no signal in this model. In the field, a line that crosses yours can pick up some, more so at higher frequencies, and a receiver can follow it by mistake.',
    ),
    claim(
      'fl.about.stake',
      'In the field, set the ground stake well away from the line, roughly at a right angle to it, and never over another buried line. Here it stands where the cutaway can show it.',
    ),
    claim(
      'fl.about.threshold',
      `"Enough to trace" is set at ${String(WORKS_THRESHOLD_MA.value)} mA for this lab. What a receiver needs in the field depends on depth, interference from other lines and noise, and the receiver itself.`,
    ),
  ],
  /** Scope, not a claim. */
  leftOut:
    'Not covered here: the receiver, depth, other ways to connect (clamps and induction), and breaks in a tracer wire.',
} as const;

/** One-line definitions shown with each 3D label. */
export const LABEL_DEFINITIONS: Readonly<Record<LabelId, Claim | PerSetup<Claim>>> = {
  transmitter: claim(
    'fl.label.transmitter',
    'Puts the signal on the line at the frequency you pick.',
  ),
  stake: claim('fl.label.stake', 'Metal rod in the soil. Current returns to it through the earth.'),
  access: {
    steel: claim(
      'fl.label.test-station',
      'Post with a test wire attached to the steel main. The transmitter connects here.',
    ),
    plastic: claim(
      'fl.label.tracer-box',
      'Where the tracer wire comes up to ground level. The transmitter connects here.',
    ),
  },
  target: {
    steel: claim(
      'fl.label.steel-main',
      'Coated steel pipe carrying natural gas. The metal pipe carries the signal.',
    ),
    plastic: claim(
      'fl.label.plastic-main',
      "Plastic pipe carrying natural gas. The plastic can't carry the signal; its tracer wire does.",
    ),
  },
  tracer: claim(
    'fl.label.tracer',
    'Insulated wire buried with the plastic main so the main can be found.',
  ),
  telecom: claim(
    'fl.label.telecom',
    'Phone or internet cable with a metal shield. Signal can bleed onto it.',
  ),
  water: claim(
    'fl.label.water',
    'Drinking water main crossing under the gas main. This lab gives it no signal, but in the field a crossing line can pick some up.',
  ),
};

export function labelDefinition(id: LabelId, setup: SetupId): Claim {
  const d = LABEL_DEFINITIONS[id];
  return 'kind' in d ? d : d[setup];
}

/** The lab's content, as one module for the review doc. */
export const FREQUENCY_LAB = {
  TAGLINE,
  SUMMARY,
  INTRO,
  SETUP_TEXT,
  FREQUENCY_NOTES,
  BLEED_DIRECTION,
  TRY_THIS,
  RULE,
  KEY,
  ABOUT,
  LABEL_DEFINITIONS,
  TERMS,
};
