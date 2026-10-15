/**
 * The transmitter, as a faceplate: the setup switch, a small screen showing the frequency and
 * where the transmitter is hooked up, the frequency knob, and a button that pauses the signal's
 * motion. On phones it sits at the bottom, in thumb reach.
 */
import {
  FREQUENCIES,
  frequencyLabel,
  frequencySpoken,
  type Frequency,
} from '../../../config/equipment.ts';
import { Icon } from '../../design/icons.tsx';
import { RotaryDial } from '../../design/RotaryDial.tsx';
import { Segmented } from '../../design/Segmented.tsx';
import type { SetupId } from '../../signal/model.ts';
import { LABEL_SPECS } from './scene/labels.ts';

const SETUP_OPTIONS = [
  { value: 'steel' as const, label: 'Steel main' },
  { value: 'plastic' as const, label: 'Plastic main' },
];

const FREQUENCY_OPTIONS = FREQUENCIES.map((f) => ({
  value: f,
  label: frequencyLabel(f),
  ariaLabel: frequencySpoken(f),
}));

/** Where the transmitter's signal lead clips on: the access point's own name in the view. */
const hookup = (setup: SetupId) => LABEL_SPECS.find((s) => s.id === 'access')?.text[setup] ?? '';

export function TransmitterDock(props: {
  setup: SetupId;
  onSetup: (setup: SetupId) => void;
  frequency: Frequency;
  onFrequency: (frequency: Frequency) => void;
  /** Whether the signal's motion is paused (WCAG 2.2.2). */
  paused: boolean;
  onPause: (paused: boolean) => void;
}) {
  return (
    <section class="lab-dock" aria-labelledby="dock-title" data-chrome>
      <h2 class="sr-only" id="dock-title">
        Transmitter
      </h2>
      <div class="dock-row">
        <Segmented
          label="Setup"
          value={props.setup}
          options={SETUP_OPTIONS}
          onChange={props.onSetup}
          class="dock-setup"
        />
        <button
          type="button"
          class="icon-button dock-pause"
          // Named for what it does next, the same to the eye (its tip) and to assistive tech.
          aria-label={props.paused ? 'Play the signal' : 'Pause the signal'}
          title={props.paused ? 'Play the signal' : 'Pause the signal'}
          data-paused={props.paused ? '' : undefined}
          onClick={() => {
            props.onPause(!props.paused);
          }}
        >
          <Icon name={props.paused ? 'play' : 'pause'} />
        </button>
      </div>
      <div class="dock-row dock-face">
        {/* The screen repeats what the knob and the view say, so it's for the eye only. */}
        <div class="dock-lcd" aria-hidden="true">
          <span class="lcd-frequency">
            <span class="lcd-led" />
            {frequencyLabel(props.frequency)}
          </span>
          <span class="lcd-hookup">→ {hookup(props.setup)}</span>
        </div>
        <RotaryDial
          label="Transmitter frequency"
          value={props.frequency}
          options={FREQUENCY_OPTIONS}
          onChange={props.onFrequency}
        />
      </div>
    </section>
  );
}
