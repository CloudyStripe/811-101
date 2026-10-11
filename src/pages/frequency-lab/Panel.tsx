/**
 * The lab guide: how locating works, what the signal is doing now, what to try, the rule, and
 * the key. A side panel on wide screens that can be closed to a small card; a bottom sheet on
 * phones and short screens.
 */
import { useId } from 'preact/hooks';
import type { Frequency } from '../../../config/equipment.ts';
import {
  INTRO,
  RULE,
  SETUP_TEXT,
  TERMS,
  TRY_THIS,
} from '../../../content/training/frequency-lab.ts';
import { Icon } from '../../design/icons.tsx';
import { Rich } from '../../design/Term.tsx';
import type { SetupId } from '../../signal/model.ts';
import { Legend } from './Legend.tsx';
import { ruleSummary, stateLead, stateNote, stateSummary } from './summary.ts';

export const define = (key: string): string | undefined => TERMS[key]?.text;

export interface PanelProps {
  setup: SetupId;
  frequency: Frequency;
  /** Wide screens: whether the panel is open or closed down to its title. */
  panelOpen: boolean;
  onPanelToggle: () => void;
  /** Phones and short screens: whether the sheet is expanded. */
  sheetOpen: boolean;
  onSheetToggle: () => void;
  onAbout: () => void;
}

export function Panel(props: PanelProps) {
  const { setup, frequency, panelOpen, sheetOpen } = props;
  const ids = {
    title: useId(),
    body: useId(),
    intro: useId(),
    happening: useId(),
    tryThis: useId(),
    rule: useId(),
    key: useId(),
  };
  const [lowest, why, higher] = RULE.claims;

  return (
    <aside
      class="lab-panel"
      aria-labelledby={ids.title}
      data-open={sheetOpen ? '' : undefined}
      data-collapsed={panelOpen ? undefined : ''}
      data-chrome
    >
      {/* Phones and short screens: a bar that sums up the view, and opens the sheet. */}
      <div class="sheet-bar">
        <p class="sheet-summary">{stateSummary(setup, frequency)}</p>
        <p class="sheet-title" aria-hidden="true">
          Lab guide
        </p>
        <button
          type="button"
          class="sheet-toggle"
          aria-expanded={sheetOpen}
          aria-controls={ids.body}
          onClick={props.onSheetToggle}
        >
          Details
          <Icon name={sheetOpen ? 'chevron-down' : 'chevron-up'} />
        </button>
      </div>

      {/* Wide screens: a title, and a button that closes the panel down to it. */}
      <div class="panel-head">
        <h2 id={ids.title} class="panel-title">
          Lab guide
        </h2>
        <button
          type="button"
          class="icon-button"
          aria-label={panelOpen ? 'Close the lab guide' : 'Open the lab guide'}
          title={panelOpen ? 'Close the lab guide' : 'Open the lab guide'}
          aria-expanded={panelOpen}
          aria-controls={ids.body}
          onClick={props.onPanelToggle}
        >
          <Icon name={panelOpen ? 'close' : 'chevron-down'} />
        </button>
      </div>

      <div class="panel-body" id={ids.body}>
        <section class="panel-section" aria-labelledby={ids.intro}>
          <h3 id={ids.intro}>{INTRO.heading}</h3>
          {INTRO.claims.map((c) => (
            <p key={c.id}>
              <Rich text={c.text} define={define} />
            </p>
          ))}
          <p class="muted">{INTRO.howTo}</p>
        </section>

        <section class="panel-section" aria-labelledby={ids.happening}>
          <h3 id={ids.happening}>What's happening</h3>
          <p>
            <strong>{stateLead(setup, frequency)}:</strong>{' '}
            <Rich text={stateNote(frequency)} define={define} />
          </p>
          <p>
            <Rich text={SETUP_TEXT[setup].note.text} define={define} />
          </p>
        </section>

        <section class="panel-section" aria-labelledby={ids.tryThis}>
          <h3 id={ids.tryThis}>Try this</h3>
          <ul class="try-list">
            {TRY_THIS[setup].map((c) => (
              <li key={c.id}>
                <Rich text={c.text} define={define} />
              </li>
            ))}
          </ul>
        </section>

        <section class="panel-section" aria-labelledby={ids.rule}>
          <h3 id={ids.rule}>{RULE.heading}</h3>
          <p class="rule">
            <strong>{lowest.text}</strong> {why.text}
          </p>
          <p>{higher.text}</p>
          <p class="muted">{ruleSummary(setup)}</p>
        </section>

        <section class="panel-section" aria-labelledby={ids.key}>
          <h3 id={ids.key}>Key</h3>
          <Legend setup={setup} />
        </section>

        <div class="panel-footer">
          <button type="button" class="text-button" onClick={props.onAbout}>
            About this model
          </button>
        </div>
      </div>
    </aside>
  );
}
