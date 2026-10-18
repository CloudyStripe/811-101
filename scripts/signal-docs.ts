/**
 * Generates docs/SIGNAL_MODEL.md from src/signal/constants.ts.
 * `--check` fails instead of writing when the file is stale.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { FREQUENCIES, frequencyLabel } from '../config/equipment.ts';
import {
  CIRCUIT_RESISTANCE_OHMS,
  FADE_PER_100FT,
  GEOMETRY,
  TELECOM_SHARE,
  TRANSMITTER,
  WORKS_THRESHOLD_MA,
  type Constant,
  type PerFrequency,
} from '../src/signal/constants.ts';
import { SETUPS, labState, lowestWorkingFrequency, type SetupId } from '../src/signal/model.ts';

const OUT = 'docs/SIGNAL_MODEL.md';
const SETUP_NAMES: Record<SetupId, string> = {
  steel: 'Steel main',
  plastic: 'Plastic main (tracer wire)',
};

const ma = (n: number) => `${n.toFixed(1)} mA`;
const header = `| | ${FREQUENCIES.map(frequencyLabel).join(' | ')} |\n|---|${FREQUENCIES.map(() => '---').join('|')}|`;
const row = (label: string, table: PerFrequency) =>
  `| ${label} | ${FREQUENCIES.map((f) => String(table[f])).join(' | ')} |`;

function single(c: Constant<number>): string {
  return [
    `### ${c.name}`,
    '',
    c.meaning,
    '',
    `**Value:** ${c.value} ${c.unit}`,
    '',
    `**Why:** ${c.why}`,
  ].join('\n');
}

function perFrequency(title: string, rows: readonly [string, Constant<PerFrequency>][]): string {
  const parts = [`### ${title}`, ''];
  for (const [, c] of rows) parts.push(`- **${c.name}:** ${c.meaning}`);
  parts.push('', `Unit: ${rows[0]?.[1].unit ?? ''}.`, '', header);
  for (const [label, c] of rows) parts.push(row(label, c.value));
  parts.push('');
  for (const [, c] of rows) parts.push(`**Why (${c.name.toLowerCase()}):** ${c.why}`, '');
  return parts.join('\n').trimEnd();
}

function statesTable(): string {
  const lines = [
    '| Setup | Frequency | Transmitter | Resistance | Far end of block | Telecom at hookup | Works? |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const setup of SETUPS) {
    for (const f of FREQUENCIES) {
      const s = labState(setup, f);
      lines.push(
        `| ${SETUP_NAMES[setup]} | ${frequencyLabel(f)} | ${ma(s.transmitter.ma)} | ${s.transmitter.ohms} Ω | ${ma(s.farEndMa)} | ${ma(s.earth.viaTelecom)} | ${s.works ? 'Yes' : 'No'} |`,
      );
    }
  }
  return lines.join('\n');
}

function lowest(setup: SetupId): string {
  const f = lowestWorkingFrequency(setup);
  return `${SETUP_NAMES[setup]}: ${f === null ? 'none' : frequencyLabel(f)}`;
}

export function render(): string {
  return `<!-- Generated from src/signal/constants.ts by \`npm run docs\`. Do not edit by hand. -->

# Frequency Lab signal model

The lab shows eight states: two setups × four frequencies. The model is a small, pure function of setup and frequency, not a circuit solver. Every value below is a teaching calibration, chosen so the lab behaves the way experienced locators expect, and pending their review.

## What it models

- **What carries the signal:** the steel main itself, or, on the plastic main, its tracer wire. Plastic pipe can't carry a locate signal.
- **Fade:** the current falls off exponentially along the line, at a rate set per conductor (steel main or tracer wire) and per frequency. What fades leaks into the soil.
- **Bleed-over:** along the parallel run, the telecom cable carries a share of the target's current, set per frequency. It flows back toward the stake, in the return direction.
- **Earth return:** everything that leaves the target returns to the ground stake. That includes the fade and what continues past the end of the model. The telecom cable's share is part of that return, not added to it.
- **Direction:** outgoing on the target, returning on the telecom cable, and through the earth toward the stake.
- **Transmitter readout:** circuit resistance is set per setup and frequency. Current follows from a fixed output with internal resistance.
- **Water main:** it isn't connected to anything, so the model gives it no signal. An unconnected crossing line picks up too little to show.

**Left out:** a circuit solver, receiver field math, depth, passive modes, clamp and induction coupling, and stake placement.

## Values

${single(GEOMETRY.blockLengthFt)}

${single(GEOMETRY.modelLengthFt)}

${perFrequency('Fade along the line', [
  ['Coated steel main', FADE_PER_100FT.steel],
  ['Tracer wire', FADE_PER_100FT.tracer],
])}

${perFrequency(TELECOM_SHARE.name, [['Telecom cable', TELECOM_SHARE]])}

${perFrequency('Circuit resistance', [
  ['Steel main', CIRCUIT_RESISTANCE_OHMS.steel],
  ['Tracer wire', CIRCUIT_RESISTANCE_OHMS.plastic],
])}

${single(TRANSMITTER.openCircuitVolts)}

${single(TRANSMITTER.internalOhms)}

${single(WORKS_THRESHOLD_MA)}

## The eight states, computed

${statesTable()}

**Lowest frequency that works:** ${lowest('steel')}; ${lowest('plastic')}.
`;
}

const content = render();
if (process.argv.includes('--check')) {
  const current = await readFile(OUT, 'utf8').catch(() => '');
  if (current !== content) {
    console.error(`${OUT} is out of date. Run \`npm run docs\`.`);
    process.exit(1);
  }
  console.log(`${OUT} is up to date.`);
} else {
  await writeFile(OUT, content);
  console.log(`Wrote ${OUT}.`);
}
