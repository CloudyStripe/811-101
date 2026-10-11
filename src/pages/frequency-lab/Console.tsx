/** The transmitter's frequency dial. */
import {
  FREQUENCIES,
  frequencyLabel,
  frequencySpoken,
  type Frequency,
} from '../../../config/equipment.ts';
import { Segmented } from '../../design/Segmented.tsx';

const OPTIONS = FREQUENCIES.map((f) => ({
  value: f,
  label: frequencyLabel(f),
  ariaLabel: frequencySpoken(f),
}));

export function Console({
  frequency,
  onFrequency,
}: {
  frequency: Frequency;
  onFrequency: (f: Frequency) => void;
}) {
  return (
    <section class="lab-console" aria-labelledby="console-title" data-chrome>
      <h2 class="console-title" id="console-title">
        Transmitter frequency
      </h2>
      <Segmented
        label="Transmitter frequency"
        value={frequency}
        options={OPTIONS}
        onChange={onFrequency}
        class="frequency"
      />
    </section>
  );
}
