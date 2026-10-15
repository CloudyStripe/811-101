/**
 * The APWA uniform color code. In the field, the color is the code, so these colors are
 * reserved for their meanings and never used as decoration or UI accent.
 *
 * Screen values approximate the ANSI Z535 safety colors the code builds on. The exact values
 * are listed for content review.
 */

export type ApwaCode = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'white';

export interface ApwaColor {
  code: ApwaCode;
  name: string;
  meaning: string;
  /** Fill for marks, lines, swatches and badges. */
  fill: string;
  /** Text-safe version of the color, per theme. */
  ink: { light: string; dark: string };
  /** Tinted background, per theme. */
  soft: { light: string; dark: string };
}

export const APWA: Record<ApwaCode, ApwaColor> = {
  red: {
    code: 'red',
    name: 'Red',
    meaning: 'Electric power lines, cables, conduit and lighting cables',
    fill: '#d7262e',
    ink: { light: '#a81d24', dark: '#ff8f8f' },
    soft: { light: '#f9dfdf', dark: '#3a1618' },
  },
  orange: {
    code: 'orange',
    name: 'Orange',
    meaning: 'Telecommunication, alarm or signal lines, cables or conduit',
    fill: '#f26a1b',
    ink: { light: '#9c3f08', dark: '#ffa36b' },
    soft: { light: '#fde4d4', dark: '#3a2112' },
  },
  yellow: {
    code: 'yellow',
    name: 'Yellow',
    meaning: 'Natural gas, oil, steam, petroleum or other gaseous or flammable material',
    fill: '#f5c400',
    ink: { light: '#735600', dark: '#f7d24a' },
    soft: { light: '#fbf0c6', dark: '#352c0d' },
  },
  green: {
    code: 'green',
    name: 'Green',
    meaning: 'Sewers and drain lines',
    fill: '#2e9a47',
    ink: { light: '#1e6f33', dark: '#74d48c' },
    soft: { light: '#dcf0e1', dark: '#13301b' },
  },
  blue: {
    code: 'blue',
    name: 'Blue',
    meaning: 'Potable water',
    fill: '#2b6cd6',
    ink: { light: '#1c51a8', dark: '#8fb8ff' },
    soft: { light: '#dde8fb', dark: '#13233b' },
  },
  purple: {
    code: 'purple',
    name: 'Purple',
    meaning: 'Reclaimed water, irrigation and slurry lines',
    fill: '#8a4fc4',
    ink: { light: '#6b39a3', dark: '#c9a6f3' },
    soft: { light: '#ece2f8', dark: '#2a1c3b' },
  },
  pink: {
    code: 'pink',
    name: 'Pink',
    meaning: 'Temporary survey markings, unknown or unidentified facilities',
    fill: '#f28ab8',
    ink: { light: '#a8336a', dark: '#f7b3d1' },
    soft: { light: '#fbe3ee', dark: '#3a1a2a' },
  },
  white: {
    code: 'white',
    name: 'White',
    meaning: 'Proposed excavation limits or route',
    fill: '#ffffff',
    ink: { light: '#4a4640', dark: '#f2ede5' },
    soft: { light: '#f3f1ed', dark: '#2a2723' },
  },
};

/** The APWA colors this lab uses. */
export const LAB_APWA: readonly ApwaCode[] = ['yellow', 'orange', 'blue'];

/** The colors the Gas & Petroleum diorama uses: both fuels are yellow, told apart by pattern. */
export const DIORAMA_APWA: readonly ApwaCode[] = ['yellow'];
