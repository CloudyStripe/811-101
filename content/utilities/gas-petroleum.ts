/**
 * Everything the Gas & Petroleum diorama says, kept apart from code. Every factual sentence is a
 * claim with a stable ID, so reviewers can sign it off in docs/CONTENT_REVIEW.md. Mark terms with
 * [[term]] or [[shown words|term key]]; each one needs a definition in TERMS.
 *
 * Keep it to a few plain sentences per stop, with no figures (the time-lapse's clock aside) and
 * no side trips.
 */
import { claim, type Claim } from '../../src/content-kit/claims.ts';
import type { PathId } from '../../src/design/paths.ts';

export type { PathId };

export type StopId =
  | 'formation'
  | 'reservoir'
  | 'drilling'
  | 'lifting'
  | 'gas-plant'
  | 'pipeline'
  | 'storage-lng'
  | 'city-gate'
  | 'gas-uses'
  | 'crude-transport'
  | 'distillation'
  | 'delivery'
  | 'pump';

export interface Stop {
  readonly id: StopId;
  readonly path: PathId;
  /** Its place along its path, counting the shared start. */
  readonly step: number;
  /** Its short name, on its 3D label and in the route map. */
  readonly label: string;
  readonly title: Claim;
  /** Two or three short, plain sentences, one claim each. */
  readonly text: readonly Claim[];
  readonly note?: Claim;
  /** A safety tip, shown apart from the text. */
  readonly safety?: Claim;
}

export const STOPS: readonly Stop[] = [
  // The shared start.
  {
    id: 'formation',
    path: 'shared',
    step: 1,
    label: 'Ancient sea life',
    title: claim('gp.formation.title', 'It starts with tiny sea life'),
    text: [
      claim(
        'gp.formation.sank',
        'Long ago, tiny sea life called [[plankton]] died and sank into the mud on the seafloor.',
      ),
      claim(
        'gp.formation.cooked',
        'Over millions of years, layers of mud and sand buried it deeper, and heat and pressure slowly "cooked" it into oil and gas.',
      ),
    ],
  },
  {
    id: 'reservoir',
    path: 'shared',
    step: 2,
    label: 'Trapped in rock',
    title: claim('gp.reservoir.title', 'Hiding in rock, like water in a sponge'),
    text: [
      claim(
        'gp.reservoir.cap',
        'Oil and gas slowly creep upward through the rock until a tight layer of [[cap rock]] stops them, like a lid.',
      ),
      claim(
        'gp.reservoir.sponge',
        'Below it, they fill the tiny holes in [[reservoir rock]], like water in a sponge.',
      ),
      claim(
        'gp.reservoir.weight',
        'Everything settles by weight: gas on top, then oil, then salty water.',
      ),
    ],
  },
  {
    id: 'drilling',
    path: 'shared',
    step: 3,
    label: 'Find & drill',
    title: claim('gp.drilling.title', 'Finding it, then drilling down'),
    text: [
      claim(
        'gp.drilling.survey',
        'Crews map the rock layers with a [[seismic survey]], which uses sound waves.',
      ),
      claim(
        'gp.drilling.casing',
        'Then a rig drills down and lines the hole with steel and cement to seal it off from [[groundwater]].',
      ),
      claim(
        'gp.drilling.fracking',
        'In tight rock, [[fracking]] cracks the rock open so oil and gas can flow out.',
      ),
    ],
  },
  {
    id: 'lifting',
    path: 'shared',
    step: 4,
    label: 'Up & split',
    title: claim('gp.lifting.title', 'Up the well, then sorted three ways'),
    text: [
      claim(
        'gp.lifting.pump',
        'Gas usually rushes up the well on its own, but oil often needs a [[pump jack]] to lift it.',
      ),
      claim(
        'gp.lifting.separator',
        'What comes up is a mix of gas, oil and salty water, and a [[separator]] lets it settle into layers.',
      ),
    ],
    note: claim(
      'gp.lifting.fork',
      'This is the fork: gas heads off along the natural gas path, oil along the gasoline one.',
    ),
  },

  // The natural gas path.
  {
    id: 'gas-plant',
    path: 'gas',
    step: 5,
    label: 'Gas plant',
    title: claim('gp.gas-plant.title', 'Cleaning up the gas'),
    text: [
      claim('gp.gas-plant.raw', "Raw gas from the well isn't ready to use."),
      claim(
        'gp.gas-plant.clean',
        'A [[processing plant]] dries it, removes impurities, and pulls out heavier gases like propane to sell separately.',
      ),
      claim('gp.gas-plant.left', "What's left is the natural gas that heads into the pipelines."),
    ],
  },
  {
    id: 'pipeline',
    path: 'gas',
    step: 6,
    label: 'Pipeline',
    title: claim('gp.pipeline.title', 'Pushed along long pipelines'),
    text: [
      claim(
        'gp.pipeline.travel',
        'Clean gas travels long distances through big, buried steel [[pipelines]].',
      ),
      claim(
        'gp.pipeline.compress',
        'It slowly loses pressure along the way, so [[compressor stations|compressor station]] squeeze it back up to keep it moving.',
      ),
    ],
  },
  {
    id: 'storage-lng',
    path: 'gas',
    step: 7,
    label: 'Storage & shipping',
    title: claim('gp.storage-lng.title', 'Saved for winter, or shipped overseas'),
    text: [
      claim(
        'gp.storage-lng.winter',
        "People use far more gas in winter, so extra gas is pumped into [[underground storage]] in warmer months and pulled back out when it's cold.",
      ),
      claim(
        'gp.storage-lng.lng',
        'Some gas is chilled until it turns into a liquid, called [[LNG]], so ships can carry it overseas.',
      ),
    ],
  },
  {
    id: 'city-gate',
    path: 'gas',
    step: 8,
    label: 'City gate',
    title: claim('gp.city-gate.title', 'Into town: lower pressure, added smell'),
    text: [
      claim(
        'gp.city-gate.local',
        'At the [[city gate]], gas leaves the big pipeline for the local network.',
      ),
      claim(
        'gp.city-gate.odorant',
        'Its pressure is lowered, and an [[odorant]] is added, because natural gas has no smell of its own.',
      ),
      claim(
        'gp.city-gate.meter',
        'Smaller pipes under the streets then carry it to a [[gas meter]] at each building.',
      ),
    ],
    safety: claim(
      'gp.city-gate.safety',
      'If you ever smell rotten eggs indoors, leave right away and call the gas company from outside.',
    ),
  },
  {
    id: 'gas-uses',
    path: 'gas',
    step: 9,
    label: 'Using natural gas',
    title: claim('gp.gas-uses.title', 'Electricity, heat and things we make'),
    text: [
      claim('gp.gas-uses.power', 'Much natural gas goes to [[power plants]] to make electricity.'),
      claim(
        'gp.gas-uses.homes',
        'In homes, it fuels furnaces, stoves and water heaters, and factories use it to make things like fertilizer.',
      ),
    ],
  },

  // The gasoline path.
  {
    id: 'crude-transport',
    path: 'gasoline',
    step: 5,
    label: 'To the refinery',
    title: claim('gp.crude-transport.title', 'Moving crude oil to a refinery'),
    text: [
      claim(
        'gp.crude-transport.crude',
        '[[Crude oil|crude oil]] is the thick, dark oil that comes out of the ground.',
      ),
      claim(
        'gp.crude-transport.pipeline',
        'On land, most of it travels to a [[refinery]] by pipeline.',
      ),
      claim(
        'gp.crude-transport.other',
        'Ships carry it across oceans, and trains and trucks go where there are no pipes.',
      ),
    ],
  },
  {
    id: 'distillation',
    path: 'gasoline',
    step: 6,
    label: 'Refinery',
    title: claim('gp.distillation.title', 'Turning crude oil into fuels'),
    text: [
      claim(
        'gp.distillation.vapor',
        'At a [[refinery]], crude oil is heated until much of it turns to vapor.',
      ),
      claim(
        'gp.distillation.tower',
        'In a tall [[distillation tower]], the vapor cools as it rises and turns back to liquid at different heights: gasoline near the top, heavier fuels lower down.',
      ),
      claim(
        'gp.distillation.blend',
        'The refinery then turns some of the heavier oils into more gasoline and blends the finished fuel.',
      ),
    ],
  },
  {
    id: 'delivery',
    path: 'gasoline',
    step: 7,
    label: 'Fuel delivery',
    title: claim('gp.delivery.title', 'From refinery to your neighborhood'),
    text: [
      claim(
        'gp.delivery.terminals',
        'Finished fuels travel through pipelines to [[storage terminals]], big tank farms near cities.',
      ),
      claim(
        'gp.delivery.trucks',
        'There, tanker trucks fill up and drive the fuel to gas stations, where it goes into large tanks buried under the station.',
      ),
    ],
  },
  {
    id: 'pump',
    path: 'gasoline',
    step: 8,
    label: 'Using gasoline',
    title: claim('gp.pump.title', 'At the pump, then on the road'),
    text: [
      claim('gp.pump.tanks', 'At the station, the pumps draw fuel from the tanks buried below.'),
      claim(
        'gp.pump.engines',
        'Most gasoline goes into cars and other vehicles, whose engines burn it to turn the wheels.',
      ),
    ],
  },
];

/** Definitions for every marked term, keyed as `termKey()` normalizes them. */
export const TERMS: Readonly<Record<string, Claim>> = {
  plankton: claim(
    'gp.term.plankton',
    'Tiny living things that drift in water, like algae and microscopic animals.',
  ),
  'cap rock': claim(
    'gp.term.cap-rock',
    "A tight layer of rock that fluids can't pass through. It seals oil and gas in.",
  ),
  'reservoir rock': claim(
    'gp.term.reservoir-rock',
    'Rock with many tiny connected holes that can hold oil, gas or water.',
  ),
  'seismic survey': claim(
    'gp.term.seismic-survey',
    'Mapping underground rock by sending sound waves down and timing their echoes.',
  ),
  groundwater: claim(
    'gp.term.groundwater',
    'Fresh water held in soil and rock near the surface. Many people drink it from wells.',
  ),
  fracking: claim(
    'gp.term.fracking',
    'Short for hydraulic fracturing: pumping water, sand and a little chemical additive into a well at high pressure to crack the rock.',
  ),
  'pump jack': claim(
    'gp.term.pump-jack',
    'A nodding machine at an oil well. It moves a long rod up and down to lift oil to the surface.',
  ),
  separator: claim(
    'gp.term.separator',
    'A tank that lets the gas, oil and water coming out of a well separate by weight.',
  ),
  'processing plant': claim(
    'gp.term.processing-plant',
    'A facility that cleans raw natural gas and separates it into useful parts.',
  ),
  pipelines: claim(
    'gp.term.pipelines',
    'Long steel pipes, usually buried, that carry gas or liquids over long distances.',
  ),
  'compressor station': claim(
    'gp.term.compressor-station',
    'A facility along a pipeline that squeezes the gas to raise its pressure so it keeps flowing.',
  ),
  'underground storage': claim(
    'gp.term.underground-storage',
    "Places deep underground, like old gas fields or caverns in salt, where gas is kept until it's needed.",
  ),
  lng: claim(
    'gp.term.lng',
    'Liquefied natural gas: natural gas chilled until it turns into a liquid, so it takes up far less space.',
  ),
  'city gate': claim(
    'gp.term.city-gate',
    'The station where gas moves from a long-distance pipeline into a local delivery network.',
  ),
  odorant: claim(
    'gp.term.odorant',
    'A strong-smelling chemical added to gas so leaks can be noticed.',
  ),
  'gas meter': claim(
    'gp.term.gas-meter',
    'A device on the outside of a building that measures how much gas it uses.',
  ),
  'power plants': claim(
    'gp.term.power-plants',
    'Facilities that make electricity, often by burning fuel to spin a generator.',
  ),
  'crude oil': claim(
    'gp.term.crude-oil',
    'Oil as it comes out of the ground, before a refinery turns it into fuels.',
  ),
  'distillation tower': claim(
    'gp.term.distillation-tower',
    'A tall column where hot vapor cools and turns back to liquid at different heights, sorting crude oil into fuels.',
  ),
  'storage terminals': claim(
    'gp.term.storage-terminals',
    'Large groups of tanks where fuel is stored and loaded onto trucks.',
  ),
  refinery: claim(
    'gp.term.refinery',
    'A plant that turns crude oil into fuels like gasoline, diesel and jet fuel.',
  ),
};

/** The big idea, shown first. */
export const OVERVIEW = {
  title: claim('gp.overview.title', 'Two fuels, one beginning'),
  text: [
    claim(
      'gp.overview.start',
      'Natural gas and gasoline start the same way: tiny sea life, buried and slowly "cooked" by heat and pressure over millions of years into oil and gas.',
    ),
    claim('gp.overview.wells', 'The two often come up the same wells.'),
    claim(
      'gp.overview.split',
      "Then the paths split: gas is cleaned and piped to where it's used, while crude oil goes to a [[refinery]] to become gasoline.",
    ),
  ],
} as const;

/** The guided tours: each walks the shared start, then its own path. */
export const TOURS = {
  gas: {
    name: 'Natural gas',
    stops: [
      'formation',
      'reservoir',
      'drilling',
      'lifting',
      'gas-plant',
      'pipeline',
      'storage-lng',
      'city-gate',
      'gas-uses',
    ],
  },
  gasoline: {
    name: 'Gasoline',
    stops: [
      'formation',
      'reservoir',
      'drilling',
      'lifting',
      'crude-transport',
      'distillation',
      'delivery',
      'pump',
    ],
  },
} as const satisfies Record<'gas' | 'gasoline', { name: string; stops: readonly StopId[] }>;

export interface Question {
  /** The question and its choices are prompts, not claims. */
  readonly prompt: string;
  readonly options: readonly string[];
  readonly answer: number;
  readonly why: Claim;
}

/** End-of-tour quizzes. */
export const QUIZZES: Readonly<Record<'gas' | 'gasoline', readonly Question[]>> = {
  gas: [
    {
      prompt: 'Natural gas and gasoline both started as…',
      options: [
        'Dinosaur bones',
        'Tiny sea life buried for millions of years',
        'Cooled volcanic lava',
        'Ancient tree sap',
      ],
      answer: 1,
      why: claim(
        'gp.quiz.gas.origin',
        'Both formed from plankton and algae that were buried and slowly "cooked" by heat and pressure.',
      ),
    },
    {
      prompt: 'Why does natural gas smell like rotten eggs?',
      options: [
        'That is its natural smell',
        'A smell is added on purpose so leaks are noticed',
        'It picks up the smell inside pipelines',
        'Burning it makes the smell',
      ],
      answer: 1,
      why: claim(
        'gp.quiz.gas.smell',
        'Natural gas has no smell. An odorant is added at the city gate so people can notice a leak.',
      ),
    },
    {
      prompt: 'What does a compressor station do?',
      options: [
        'Turns gas into a liquid',
        'Adds the rotten-egg smell',
        'Squeezes the gas so it keeps moving down the pipeline',
        'Removes propane and butane',
      ],
      answer: 2,
      why: claim(
        'gp.quiz.gas.compressor',
        'Gas loses pressure as it travels. Compressor stations push it back up so it keeps flowing.',
      ),
    },
  ],
  gasoline: [
    {
      prompt: 'Where is oil found underground?',
      options: [
        'In big underground lakes',
        'Soaked into tiny holes in rock',
        'Inside open caves',
        'Floating on groundwater near the surface',
      ],
      answer: 1,
      why: claim(
        'gp.quiz.gasoline.rock',
        'Oil fills the tiny spaces in reservoir rock, like water in a sponge, trapped under a cap rock.',
      ),
    },
    {
      prompt: 'What does a refinery do?',
      options: [
        'Pumps oil out of the ground',
        'Turns crude oil into fuels like gasoline',
        'Adds a smell to natural gas',
        'Stores gas for winter',
      ],
      answer: 1,
      why: claim(
        'gp.quiz.gasoline.refinery',
        'A refinery heats and separates crude oil, then turns it into finished fuels like gasoline.',
      ),
    },
    {
      prompt: 'Where is the fuel kept at a gas station?',
      options: [
        'In large tanks buried under the station',
        'Inside each pump',
        'In tanker trucks parked out back',
        "In the station's shop",
      ],
      answer: 0,
      why: claim(
        'gp.quiz.gasoline.tanks',
        'Tanker trucks unload into large tanks buried under the station, and the pumps draw fuel from them.',
      ),
    },
  ],
};

/**
 * The formation time-lapse: how many million years ago each caption starts, and where it starts
 * along the replay (0 to 1). The clock is illustrative; it's the only place figures show.
 */
export const TIMELAPSE: readonly { ma: number; at: number; caption: Claim }[] = [
  {
    ma: 150,
    at: 0,
    caption: claim(
      'gp.timelapse.sea',
      'Plankton thrive in a warm, shallow sea. When they die, they sink into the mud.',
    ),
  },
  {
    ma: 130,
    at: 0.12,
    caption: claim(
      'gp.timelapse.mud',
      'Low oxygen on the seafloor stops them rotting away. A dark, rich mud builds up.',
    ),
  },
  {
    ma: 100,
    at: 0.34,
    caption: claim(
      'gp.timelapse.buried',
      'Rivers dump sand and mud on top. Layer by layer, the remains are buried deeper.',
    ),
  },
  {
    ma: 60,
    at: 0.62,
    caption: claim(
      'gp.timelapse.oil',
      'Now buried deep, where it is hot, the remains slowly turn into oil.',
    ),
  },
  {
    ma: 30,
    at: 0.8,
    caption: claim(
      'gp.timelapse.gas',
      'Deeper, hotter parts turn into gas. Oil and gas creep upward through the rock.',
    ),
  },
  {
    ma: 0,
    at: 0.97,
    caption: claim(
      'gp.timelapse.today',
      'They collect in porous sandstone, trapped under tight cap rock. Today, we drill for them.',
    ),
  },
];

/** The small labels on the parts of each stop, shown while it's open. */
export const DETAILS = {
  formation: {
    source: claim('gp.detail.source-rock', 'Source rock: where oil and gas form'),
  },
  reservoir: {
    gas: claim('gp.detail.gas', 'Gas'),
    oil: claim('gp.detail.oil', 'Oil'),
    water: claim('gp.detail.salty-water', 'Salty water'),
    cap: claim('gp.detail.cap-rock', 'Cap rock (the lid)'),
    zoom: claim('gp.detail.zoom', 'Zoom: sand grains, oil in the gaps'),
  },
  drilling: {
    groundwater: claim('gp.detail.groundwater', 'Groundwater'),
    casing: claim('gp.detail.casing', 'Steel casing + cement'),
    fractures: claim('gp.detail.fractures', 'Fractures held open by sand'),
    seismic: claim('gp.detail.seismic', 'Seismic waves'),
  },
  lifting: {
    pumpJack: claim('gp.detail.pump-jack', 'Pump jack lifts the oil'),
    gasWell: claim('gp.detail.gas-well', 'Gas flows up on its own'),
    water: claim('gp.detail.water-tank', 'Salty water'),
    separator: claim('gp.detail.separator', 'Inside: gas · oil · water'),
  },
  'gas-plant': {
    propane: claim('gp.detail.propane', 'Propane & butane removed'),
    flare: claim('gp.detail.flare', 'Flare: burns off gas safely'),
    clean: claim('gp.detail.clean-gas', 'Clean gas leaves'),
  },
  pipeline: {
    compressors: claim('gp.detail.compressors', 'Compressors squeeze the gas'),
    markers: claim('gp.detail.markers', 'Buried pipeline (marker posts)'),
  },
  'storage-lng': {
    rock: claim('gp.detail.storage-rock', 'Gas stored in porous rock for winter'),
    chilled: claim('gp.detail.chilled', 'Gas chilled into a liquid'),
    ship: claim('gp.detail.lng-ship', 'LNG ship'),
    well: claim('gp.detail.storage-well', 'Underground storage well'),
  },
  'city-gate': {
    pressure: claim('gp.detail.pressure', 'Pressure lowered here'),
    odorant: claim('gp.detail.odorant', 'Odorant added'),
  },
  'gas-uses': {
    power: claim('gp.detail.power-plant', 'Power plant: electricity'),
    factory: claim('gp.detail.factory', 'Factory: fertilizer, plastics'),
    homes: claim('gp.detail.homes', 'Homes: heat, hot water, cooking'),
  },
  'crude-transport': {
    crude: claim('gp.detail.crude', 'Crude oil: thick and dark'),
    rail: claim('gp.detail.rail', 'Rail tank cars'),
  },
  distillation: {
    asphalt: claim('gp.detail.asphalt', 'Asphalt'),
    heavy: claim('gp.detail.heavy-oils', 'Heavy oils'),
    diesel: claim('gp.detail.diesel', 'Diesel'),
    jet: claim('gp.detail.jet-fuel', 'Jet fuel'),
    gasoline: claim('gp.detail.gasoline', 'Gasoline'),
    light: claim('gp.detail.light-gases', 'Light gases'),
    furnace: claim('gp.detail.furnace', 'Furnace heats the crude'),
  },
  delivery: {
    terminal: claim('gp.detail.terminal', 'Storage terminal'),
    truck: claim('gp.detail.tanker', 'Tanker truck'),
  },
  pump: {
    tanks: claim('gp.detail.fuel-tanks', 'Underground fuel tanks'),
  },
} as const satisfies Record<StopId, Record<string, Claim>>;

/** Under the time-lapse: how to watch it (an instruction), and how far to trust its clock. */
export const TIMELAPSE_NOTE = {
  howTo: 'Watch the glass column beside the model.',
  illustrative: claim(
    'gp.timelapse.illustrative',
    'Illustrative timeline: real ages vary widely from place to place.',
  ),
} as const;

/** What the model calls each path, and where each tour runs from and to. */
export const PATH_NAMES: Readonly<Record<PathId, string>> = {
  shared: 'Shared start',
  gas: 'Natural gas path',
  gasoline: 'Gasoline path',
};

export const TOUR_SPANS: Readonly<Record<keyof typeof TOURS, string>> = {
  gas: 'seafloor to stove',
  gasoline: 'seafloor to pump',
};

export function stopById(id: StopId): Stop {
  const stop = STOPS.find((s) => s.id === id);
  if (!stop) throw new Error(`No stop ${id}`);
  return stop;
}

/** The diorama's content, as one module for the review doc. */
export const GAS_PETROLEUM = {
  OVERVIEW,
  STOPS,
  TERMS,
  TOURS,
  QUIZZES,
  TIMELAPSE,
  TIMELAPSE_NOTE,
  DETAILS,
};
