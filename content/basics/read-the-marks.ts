/**
 * Everything "Read the Marks" says, kept apart from code. Every line is a claim with a stable ID
 * and its source (content/sources.ts): the color code word for word from the APWA card, which CGA
 * Best Practices 22.0, Appendix B, adopts; lines that describe the yard, or how the game works, say
 * so. Mark terms with [[term]]; each one needs a definition in TERMS.
 *
 * Placeholders in braces ({Color}, {meaning}, {n}) are filled in by the game.
 */
import { claim, type Claim } from '../../src/content-kit/claims.ts';
import type { ApwaCode } from '../../src/design/apwa.ts';
import type { MarkId } from '../../src/pages/read-the-marks/game.ts';

const apwa = { source: ['apwa-card', 'cga-best-practices-b'] } as const;
const scene = { source: ['scene'] } as const;
const game = { source: ['game'] } as const;

export interface ColorText {
  /** The color's name, as said in a question and in the key. */
  name: string;
  /** What the color means, word for word from the code (in sentence case). */
  meaning: Claim;
  /** The same, short, on an answer button. */
  answer: Claim;
}

/** The color code: the key's rows, each answer button, and each answer's line. */
export const CODE: Readonly<Record<ApwaCode, ColorText>> = {
  white: {
    name: 'White',
    meaning: claim('rm.code.white', '[[Proposed excavation]]', apwa),
    answer: claim('rm.answer.white', 'Where you plan to dig', apwa),
  },
  pink: {
    name: 'Pink',
    meaning: claim('rm.code.pink', 'Temporary [[survey markings]]', apwa),
    answer: claim('rm.answer.pink', 'Temporary survey marks', apwa),
  },
  red: {
    name: 'Red',
    meaning: claim(
      'rm.code.red',
      'Electric power lines, cables, [[conduit]] and lighting cables',
      apwa,
    ),
    answer: claim('rm.answer.red', 'Electric power', apwa),
  },
  yellow: {
    name: 'Yellow',
    meaning: claim('rm.code.yellow', 'Gas, oil, steam, petroleum or gaseous materials', apwa),
    answer: claim('rm.answer.yellow', 'Gas, oil or steam', apwa),
  },
  orange: {
    name: 'Orange',
    meaning: claim(
      'rm.code.orange',
      'Communication, alarm or signal lines, cables or [[conduit]]',
      apwa,
    ),
    answer: claim('rm.answer.orange', 'Communication lines', apwa),
  },
  blue: {
    name: 'Blue',
    meaning: claim('rm.code.blue', '[[Potable]] water', apwa),
    answer: claim('rm.answer.blue', 'Drinking water', apwa),
  },
  purple: {
    name: 'Purple',
    meaning: claim('rm.code.purple', '[[Reclaimed water]], irrigation and [[slurry]] lines', apwa),
    answer: claim('rm.answer.purple', 'Reclaimed water or irrigation', apwa),
  },
  green: {
    name: 'Green',
    meaning: claim('rm.code.green', 'Sewers and drain lines', apwa),
    answer: claim('rm.answer.green', 'Sewers and drains', apwa),
  },
};

export interface MarkText {
  /** The question: the mark's color in words, then what it means. */
  ask: Claim;
  /** After the answer: what's under these marks. */
  reveal: Claim;
  /** The revealed line's name in the view; none where nothing's buried. */
  label: Claim | null;
  /** For screen readers, while the mark is asked about. */
  lit: Claim;
}

export const MARKS: Readonly<Record<MarkId, MarkText>> = {
  dig: {
    ask: claim('rm.mark.dig.ask', 'These marks are white. What do they mean?', game),
    reveal: claim(
      'rm.mark.dig.reveal',
      "You'll dig inside the white outline. The other marks show what's buried near it.",
      { source: ['apwa-card', 'scene'] },
    ),
    label: null,
    lit: claim('rm.mark.dig.lit', 'The white outline in the lawn is lit.', game),
  },
  gas: {
    ask: claim(
      'rm.mark.gas.ask',
      'These flags and paint marks are yellow. What do they mean?',
      game,
    ),
    reveal: claim(
      'rm.mark.gas.reveal',
      "Under the yellow marks: the gas line from the street to the house's meter.",
      scene,
    ),
    label: claim('rm.mark.gas.label', 'Gas line', scene),
    lit: claim('rm.mark.gas.lit', 'The yellow flags and paint marks are lit.', game),
  },
  electric: {
    ask: claim(
      'rm.mark.electric.ask',
      'These flags and paint marks are red. What do they mean?',
      game,
    ),
    reveal: claim(
      'rm.mark.electric.reveal',
      'Under the red marks: the electric line from the transformer box to the house.',
      scene,
    ),
    label: claim('rm.mark.electric.label', 'Electric line', scene),
    lit: claim('rm.mark.electric.lit', 'The red flags and paint marks are lit.', game),
  },
  communication: {
    ask: claim('rm.mark.communication.ask', 'These flags are orange. What do they mean?', game),
    reveal: claim(
      'rm.mark.communication.reveal',
      'Under the orange flags: a communication cable from the pedestal to the house.',
      scene,
    ),
    label: claim('rm.mark.communication.label', 'Communication cable', scene),
    lit: claim('rm.mark.communication.lit', 'The orange flags are lit.', game),
  },
  water: {
    ask: claim('rm.mark.water.ask', 'These flags are blue. What do they mean?', game),
    reveal: claim(
      'rm.mark.water.reveal',
      'Under the blue flags: the water line from the street to the meter box.',
      scene,
    ),
    label: claim('rm.mark.water.label', 'Water line', scene),
    lit: claim('rm.mark.water.lit', 'The blue flags are lit.', game),
  },
  sewer: {
    ask: claim('rm.mark.sewer.ask', 'These flags are green. What do they mean?', game),
    reveal: claim(
      'rm.mark.sewer.reveal',
      'Under the green flags: the sewer line out to the main under the street.',
      scene,
    ),
    label: claim('rm.mark.sewer.label', 'Sewer line', scene),
    lit: claim('rm.mark.sewer.lit', 'The green flags are lit.', game),
  },
  reclaimed: {
    ask: claim('rm.mark.reclaimed.ask', 'These flags are purple. What do they mean?', game),
    reveal: claim(
      'rm.mark.reclaimed.reveal',
      'Under the purple flags: a reclaimed water line from the street to its own meter box.',
      scene,
    ),
    label: claim('rm.mark.reclaimed.label', 'Reclaimed water line', scene),
    lit: claim('rm.mark.reclaimed.lit', 'The purple flags are lit.', game),
  },
  survey: {
    ask: claim('rm.mark.survey.ask', 'These flags are pink. What do they mean?', game),
    reveal: claim(
      'rm.mark.survey.reveal',
      "Nothing's buried under these: a surveyor set pink flags along the property line.",
      { source: ['apwa-card', 'scene'] },
    ),
    label: null,
    lit: claim('rm.mark.survey.lit', 'The pink flags along the property line are lit.', game),
  },
};

export const INTRO = {
  scene: claim(
    'rm.intro.scene',
    "You're about to dig in this yard. You've outlined the spot in white and called 811, and [[locators]] have marked what's buried nearby.",
    {
      source: ['apwa-card', 'cga-best-practices-b', 'scene'],
      note: 'The APWA card: white marks show proposed excavation; the one-call center is contacted before digging; colored paint and flags show buried lines.',
    },
  ),
  how: claim('rm.intro.how', 'One mark lights up at a time. Pick what its color means.', game),
} as const;

/** After an answer, one line: "Not quite. Yellow means gas, oil, steam, petroleum or gaseous materials." */
export const FEEDBACK = {
  right: claim('rm.right', 'Right. {Color} means {meaning}.', {
    ...game,
    note: 'Composed with the color’s name and its meaning (rm.code.*).',
  }),
  wrong: claim('rm.wrong', 'Not quite. {Color} means {meaning}.', {
    ...game,
    note: 'Composed with the color’s name and its meaning (rm.code.*).',
  }),
} as const;

export const UI = {
  progress: claim('rm.ui.progress', 'Mark {n} of 8', game),
  answers: claim('rm.ui.answers', 'Answers', game),
  yours: claim('rm.ui.yours', 'Your answer', game),
  rightAnswer: claim('rm.ui.right-answer', 'Right answer', game),
  next: claim('rm.ui.next', 'Next mark', game),
  finish: claim('rm.ui.finish', 'See everything', game),
  key: claim('rm.ui.key', 'Key', game),
  close: claim('rm.ui.close', 'Close the key', game),
  again: claim('rm.ui.again', 'Play again', game),
  labels: claim('rm.ui.labels', 'Labels', game),
  more: claim('rm.ui.more', 'More of the question', game),
  noWebgl: claim(
    'rm.ui.no-webgl',
    'This game draws its yard in 3D with WebGL, which this browser or device has turned off. The questions still work.',
    game,
  ),
  failed: claim(
    'rm.ui.failed',
    "The 3D view couldn't load. Reload the page to try again. The questions still work.",
    game,
  ),
  lost: claim(
    'rm.ui.lost',
    "The 3D view paused because the graphics context was lost. It usually comes back on its own; if it doesn't, reload the page.",
    game,
  ),
} as const;

export const KEY = {
  heading: claim('rm.key.heading', 'The color code', game),
  lede: claim(
    'rm.key.lede',
    'What each color of paint or flag means, from the American Public Works Association (APWA) uniform color code.',
    apwa,
  ),
  /** Under the code, in the Key and at the end: what's drawn as it isn't in the field. */
  scale: claim(
    'rm.key.scale',
    'Not to scale: the flags, paint and lines are drawn larger than life.',
    scene,
  ),
  colors: claim(
    'rm.key.colors',
    "Each buried line is drawn in its marks' color. Real pipes and cables aren't always those colors.",
    {
      source: ['scene'],
      note: "The second sentence says what the Frequency Lab's key says (fl.key.colors); it has no source of its own yet, for a locator to confirm.",
    },
  ),
} as const;

export const END = {
  score: claim('rm.end.score', 'You read {n} of 8 marks right.', game),
  all: claim('rm.end.all', 'Here is everything under the marks, all at once.', game),
  safety: claim('rm.end.safety', 'Near a mark, dig by hand until you can see the line.', {
    source: ['apwa-card'],
    note: "The APWA card's tolerance zone: hand tools until the marked facility is exposed. Its width is set by state law, so this line names none.",
  }),
} as const;

export const VIEW = {
  /** The 3D view's name, for screen readers. */
  name: claim(
    'rm.view.name',
    "A yard in 3D, with flags and paint marking what's buried in it.",
    scene,
  ),
  summary: claim(
    'rm.view.yard',
    'A yard with a house, a lawn, a sidewalk and a street, marked with flags and paint.',
    scene,
  ),
  end: claim(
    'rm.view.end',
    "The ground is open along every buried line's marks, showing all the lines.",
    game,
  ),
} as const;

/** Definitions for every marked term, keyed as `termKey()` normalizes them. */
export const TERMS: Readonly<Record<string, Claim>> = {
  'proposed excavation': claim('rm.term.proposed-excavation', 'Where someone plans to dig.', {
    source: ['apwa-card'],
  }),
  'survey markings': claim(
    'rm.term.survey-markings',
    'Marks a surveyor sets, for example to show where a property line runs or where something will be built.',
    { source: ['bls-surveyors'] },
  ),
  conduit: claim(
    'rm.term.conduit',
    'A pipe or tube that protects the wires or cables run through it.',
    {
      source: ['fcc-conduit', 'mw-conduit'],
    },
  ),
  potable: claim('rm.term.potable', 'Safe to drink.', { source: ['usgs-glossary'] }),
  'reclaimed water': claim(
    'rm.term.reclaimed-water',
    "Used water that's been treated so it can be used again, for things like watering or industry.",
    {
      source: ['usgs-glossary'],
      note: 'Some places treat it further, into drinking water; this line says only what it’s often used for.',
    },
  ),
  slurry: claim(
    'rm.term.slurry',
    'Water with solid bits mixed in, such as mud or ground coal, that can flow through a pipe.',
    {
      source: ['mw-slurry', 'usgs-coal-slurry'],
      note: 'No source says what the code’s slurry lines carry, so this names no contents.',
    },
  ),
  locators: claim(
    'rm.term.locators',
    'People who find buried lines and mark about where they run, usually with colored paint, flags or stakes.',
    { source: ['phmsa-safe-digging', 'cga-best-practices-glossary', 'apwa-card'] },
  ),
};

/** Every claim, for the content review and the tests. */
export const READ_THE_MARKS = { CODE, MARKS, INTRO, FEEDBACK, UI, KEY, END, VIEW, TERMS } as const;
