/**
 * Plain-language readings of the signal model, for the live summary, the chart and the rule:
 * the numbers come from the model, the names from the lab's content.
 */
import { frequencyLabel, type Frequency } from '../../../config/equipment.ts';
import { SETUP_TEXT, SUMMARY, SUMMARY_TOO_WEAK } from '../../../content/training/frequency-lab.ts';
import { GEOMETRY } from '../../signal/constants.ts';
import { labState, lowestWorkingFrequency, reachFt, type SetupId } from '../../signal/model.ts';
import { feetAndMeters, percent } from './format.ts';

/** What the signal is doing in this state, in two sentences. */
export function stateSummary(setup: SetupId, frequency: Frequency): string {
  const s = labState(setup, frequency);
  const { name, target } = SETUP_TEXT[setup];
  const fill: Record<string, string> = {
    setup: name,
    frequency: frequencyLabel(frequency),
    left: percent(s.farEndMa / s.transmitter.ma),
    short: s.works ? '' : SUMMARY_TOO_WEAK,
    share: percent(s.telecom.share),
    target,
  };
  return SUMMARY.text.replaceAll(/\{(\w+)\}/g, (whole, key: string) => fill[key] ?? whole);
}

/** How far along the line the signal stays strong enough to trace, within the chart. */
export function reachSummary(setup: SetupId, frequency: Frequency): string {
  const reach = reachFt(setup, frequency);
  const chartEnd = GEOMETRY.chartLengthFt.value;
  if (reach >= chartEnd) return `Still strong enough to trace at ${feetAndMeters(chartEnd)}.`;
  return `Strong enough to trace for about ${feetAndMeters(Math.round(reach / 10) * 10)}.`;
}

/** The rule, applied to this setup. */
export function ruleSummary(setup: SetupId): string {
  const f = lowestWorkingFrequency(setup);
  return f === null
    ? 'Here, no frequency gets enough signal to the far end of the block.'
    : `Here, that's ${frequencyLabel(f)}.`;
}
