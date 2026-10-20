/** Content modules whose claims go to locator review. */
import { READ_THE_MARKS } from './basics/read-the-marks.ts';
import { FREQUENCY_LAB } from './training/frequency-lab.ts';
import { GAS_PETROLEUM } from './utilities/gas-petroleum.ts';

export interface ContentModule {
  name: string;
  content: unknown;
}

export const CONTENT_MODULES: readonly ContentModule[] = [
  { name: 'Read the Marks', content: READ_THE_MARKS },
  { name: 'Frequency Lab', content: FREQUENCY_LAB },
  { name: 'Gas & Petroleum', content: GAS_PETROLEUM },
];
