/** The transmitter: its frequency dial and its circuit readout, current and resistance. */
import {
  FREQUENCIES,
  frequencyLabel,
  frequencySpoken,
  type Frequency,
} from '../../../config/equipment.ts';
import { Segmented } from '../../design/Segmented.tsx';
import { transmitterReading, type SetupId } from '../../signal/model.ts';

const OPTIONS = FREQUENCIES.map((f) => ({
  value: f,
  label: frequencyLabel(f),
  ariaLabel: frequencySpoken(f),
}));

export function Console({
  setup,
  frequency,
  onFrequency,
}: {
  setup: SetupId;
  frequency: Frequency;
  onFrequency: (f: Frequency) => void;
}) {
  const reading = transmitterReading(setup, frequency);
  return (
    <section class="lab-console" aria-labelledby="console-title" data-chrome>
      <div class="console-head">
        <h2 class="console-title" id="console-title">
          Transmitter
        </h2>
        <dl class="readout">
          <div>
            <dt>Current</dt>
            <dd>{Math.round(reading.ma)} mA</dd>
          </div>
          <div>
            <dt>Resistance</dt>
            <dd>{reading.ohms} Ω</dd>
          </div>
        </dl>
      </div>
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
