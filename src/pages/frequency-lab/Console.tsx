/**
 * The lab's console, under the view: what the view shows now, in one line that stays on screen;
 * the setup; a button that pauses the signal's motion; the transmitter's frequency, as four large
 * buttons; the buttons that open the guide or the key between the view and the console; and one
 * that shows or hides the labels in the view, remembered like the other settings. They read in that
 * order in every layout.
 */
import {
  FREQUENCIES,
  frequencyLabel,
  frequencySpoken,
  type Frequency,
} from '../../../config/equipment.ts';
import { Icon } from '../../design/icons.tsx';
import { Segmented } from '../../design/Segmented.tsx';
import type { SetupId } from '../../signal/model.ts';
import { stateSummary } from './summary.ts';

/** What can open between the view and the console. */
export type DrawerId = 'guide' | 'key';

const SETUP_OPTIONS = [
  { value: 'steel' as const, label: 'Steel main' },
  { value: 'plastic' as const, label: 'Plastic main' },
];

const FREQUENCY_OPTIONS = FREQUENCIES.map((f) => ({
  value: f,
  label: frequencyLabel(f),
  ariaLabel: frequencySpoken(f),
}));

const DRAWERS: readonly { id: DrawerId; label: string; icon: 'guide' | 'key' }[] = [
  { id: 'guide', label: 'Guide', icon: 'guide' },
  { id: 'key', label: 'Key', icon: 'key' },
];

export interface ConsoleProps {
  setup: SetupId;
  onSetup: (setup: SetupId) => void;
  frequency: Frequency;
  onFrequency: (frequency: Frequency) => void;
  /** Whether the signal's motion is paused (WCAG 2.2.2). */
  paused: boolean;
  onPause: (paused: boolean) => void;
  /** The drawer open now, if any, and the element it opens in. */
  drawer: DrawerId | null;
  drawerElement: string;
  onDrawer: (drawer: DrawerId | null) => void;
  /** Whether the view shows its labels on the tools and lines. */
  labels: boolean;
  onLabels: (labels: boolean) => void;
}

export function Console(props: ConsoleProps) {
  const { setup, frequency, drawer } = props;
  return (
    <section class="lab-console" aria-label="Controls" data-chrome>
      {/* What the 3D view shows, announced when it changes. */}
      <p id="lab-status" class="console-summary" role="status">
        {stateSummary(setup, frequency)}
      </p>
      <div class="console-group console-setup-group">
        {/* The groups' names, for the eye; each group carries the same name for assistive tech. */}
        <span class="console-caption" aria-hidden="true">
          Setup
        </span>
        <Segmented
          label="Setup"
          value={setup}
          options={SETUP_OPTIONS}
          onChange={props.onSetup}
          class="console-setup"
        />
      </div>
      <button
        type="button"
        class="icon-button console-pause"
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
      <div class="console-group console-frequency-group">
        <span class="console-caption" aria-hidden="true">
          Frequency
        </span>
        <Segmented
          label="Frequency"
          value={frequency}
          options={FREQUENCY_OPTIONS}
          onChange={props.onFrequency}
          class="console-frequency"
        />
      </div>
      <div class="console-drawers">
        {DRAWERS.map((d) => (
          <button
            key={d.id}
            type="button"
            class="console-toggle"
            aria-expanded={drawer === d.id}
            aria-controls={props.drawerElement}
            data-drawer={d.id}
            onClick={() => {
              props.onDrawer(drawer === d.id ? null : d.id);
            }}
            // Escape closes the open drawer from its buttons too.
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || !drawer || event.defaultPrevented) return;
              event.preventDefault();
              props.onDrawer(null);
            }}
          >
            <Icon name={d.icon} />
            {d.label}
          </button>
        ))}
        <button
          type="button"
          class="console-toggle"
          aria-pressed={props.labels}
          onClick={() => {
            props.onLabels(!props.labels);
          }}
        >
          <Icon name="labels" />
          Labels
        </button>
      </div>
    </section>
  );
}
