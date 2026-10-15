/**
 * The portal's sections and lessons. Descriptions of what each lesson covers, not claims about
 * the world, so they don't carry claim IDs or go to locator review. Keep each to one short line.
 */
import type { IconName } from '../src/design/icons.tsx';

export interface Lesson {
  title: string;
  summary: string;
  /** Relative to the site root. */
  href: string;
  /** The name of the lesson's preview stills on the portal (see src/site/stills.ts). */
  image: 'frequency-lab' | 'gas-petroleum';
}

export interface Section {
  id: string;
  title: string;
  summary: string;
  icon: IconName;
  /** Empty while the section is still being built; the portal says it's coming soon. */
  lessons: readonly Lesson[];
}

export const SECTIONS: readonly Section[] = [
  {
    id: 'basics',
    title: '811 Basics',
    summary: 'Why 811 exists, the life of a locate ticket, and what the marks mean.',
    icon: 'ticket',
    lessons: [],
  },
  {
    id: 'training',
    title: 'Locator Training',
    summary: 'How locators find buried lines.',
    icon: 'locate',
    lessons: [
      {
        title: 'Frequency Lab',
        summary: 'See why locators use the lowest frequency that works.',
        href: 'training/frequency-lab/',
        image: 'frequency-lab',
      },
    ],
  },
  {
    id: 'utilities',
    title: 'Utility Education',
    summary: 'How each utility works, from its source to the street.',
    icon: 'layers',
    lessons: [
      {
        title: 'Gas & Petroleum',
        summary: 'From Rock to Flame: how natural gas and gasoline are made, moved and used.',
        href: 'utilities/gas-petroleum/',
        image: 'gas-petroleum',
      },
    ],
  },
];
