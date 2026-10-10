/**
 * Plain-language readings of the signal model, for the live summary, the chart and the rule:
 * the numbers come from the model, the names from the lab's content.
 */
import { frequencyLabel, type Frequency } from '../../../config/equipment.ts';
import { SETUP_TEXT } from '../../../content/training/frequency-lab.ts';
import { GEOMETRY } from '../../signal/constants.ts';
import { labState, lowestWorkingFrequency, reachFt, type SetupId } from '../../signal/model.ts';
import { percent } from './format.ts';

/** What the signal is doing in this state, in two sentences. */
export function stateSummary(setup: SetupId, frequency: Frequency): string {
  const s = labState(setup, frequency);
  const { name, target } = SETUP_TEXT[setup];
  const left = percent(s.farEndMa / s.transmitter.ma);
  const enough = s.works ? '' : ', too little to trace';
  return `${name} at ${frequencyLabel(frequency)}: ${left} of the signal is left at the far end of the block${enough}. The telecom cable carries ${percent(s.telecom.share)} as much as the ${target}, flowing back toward the stake.`;
}

/** How far along the line the signal stays strong enough to trace, within the chart. */
export function reachSummary(setup: SetupId, frequency: Frequency): string {
  const reach = reachFt(setup, frequency);
  const chartEnd = GEOMETRY.chartLengthFt.value;
  if (reach >= chartEnd) return `Still strong enough to trace at ${String(chartEnd)} ft.`;
  return `Strong enough to trace for about ${String(Math.round(reach / 10) * 10)} ft.`;
}

/** The rule, applied to this setup. */
export function ruleSummary(setup: SetupId): string {
  const f = lowestWorkingFrequency(setup);
  return f === null
    ? 'Here, no frequency gets enough signal to the far end of the block.'
    : `Here, that's ${frequencyLabel(f)}.`;
}
