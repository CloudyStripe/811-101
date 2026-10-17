/**
 * Plain-language readings of the lab's state, for the live summary, the guide and the rule. The
 * words come from the lab's content; which ones apply comes from the model.
 */
import { frequencyLabel, type Frequency } from '../../../config/equipment.ts';
import { FREQUENCY_NOTES, SETUP_TEXT } from '../../../content/training/frequency-lab.ts';
import { plainText } from '../../content-kit/terms.ts';
import { lowestWorkingFrequency, type SetupId } from '../../signal/model.ts';

/** "Steel main at 83 kHz": what the view shows, by name. */
export function stateLead(setup: SetupId, frequency: Frequency): string {
  return `${SETUP_TEXT[setup].name} at ${frequencyLabel(frequency)}`;
}

/**
 * What the signal does at this frequency, to follow the lead (term markup kept): on the plastic
 * main, after what carries it.
 */
export function stateNote(setup: SetupId, frequency: Frequency): string {
  const carries = SETUP_TEXT[setup].carries;
  const note = FREQUENCY_NOTES[frequency].text;
  const text = carries ? `${carries.text} ${note}` : note;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** What the 3D view shows, in plain words. */
export function stateSummary(setup: SetupId, frequency: Frequency): string {
  return `${stateLead(setup, frequency)}: ${plainText(stateNote(setup, frequency))}`;
}

/** The rule, applied to this setup. */
export function ruleSummary(setup: SetupId): string {
  const f = lowestWorkingFrequency(setup);
  return f === null
    ? 'Here, no frequency gets enough signal to the end of the block.'
    : `Here, that's ${frequencyLabel(f)}.`;
}
