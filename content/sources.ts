/**
 * Where content comes from: each claim names its sources by these keys (`source` on a claim), and
 * docs/CONTENT_REVIEW.md lists them with every claim. `scene` and `game` aren't sources of facts:
 * they mark text that describes a lesson's own scene or how its game works.
 */
export interface Source {
  /** As it's cited. */
  title: string;
  publisher: string;
  url?: string;
}

export const SOURCES = {
  'apwa-card': {
    title:
      'APWA Uniform Color Code: Guidelines for Uniform Temporary Marking of Underground Facilities (Rev. 4/99)',
    publisher: 'American Public Works Association',
    url: 'https://www.apwa.org/wp-content/uploads/Uniform-Color-Code-1.pdf',
  },
  'cga-best-practices-b': {
    title: 'CGA Best Practices 22.0, Appendix B: Uniform Color Code and Marking Guidelines',
    publisher: 'Common Ground Alliance',
    url: 'https://www.bluestakes.org/pdfs/CGA_BestPractices_ApxB.pdf',
  },
  'bls-surveyors': {
    title: 'Surveyors, Occupational Outlook Handbook',
    publisher: 'U.S. Bureau of Labor Statistics',
    url: 'https://www.bls.gov/ooh/architecture-and-engineering/surveyors.htm',
  },
  'fcc-conduit': {
    title: '47 CFR § 1.1402(i), the definition of conduit',
    publisher: 'Federal Communications Commission',
    url: 'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-1/subpart-J/section-1.1402',
  },
  'mw-conduit': {
    title: 'Conduit',
    publisher: 'Merriam-Webster',
    url: 'https://www.merriam-webster.com/dictionary/conduit',
  },
  'usgs-glossary': {
    title: 'Water Science Glossary: potable water, reclaimed wastewater',
    publisher: 'U.S. Geological Survey, Water Science School',
    url: 'https://www.usgs.gov/water-science-school/science/water-science-glossary',
  },
  'mw-slurry': {
    title: 'Slurry',
    publisher: 'Merriam-Webster',
    url: 'https://www.merriam-webster.com/dictionary/slurry',
  },
  'usgs-coal-slurry': {
    title:
      'Comparative assessment of water use and environmental implications of coal slurry pipelines (1977)',
    publisher: 'U.S. Geological Survey',
    url: 'https://www.usgs.gov/publications/comparative-assessment-water-use-and-environmental-implications-coal-slurry-pipelines',
  },
  scene: {
    title: 'Describes the lesson’s own scene, not the world',
    publisher: 'This site',
  },
  game: {
    title: 'How the lesson’s game works',
    publisher: 'This site',
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;
