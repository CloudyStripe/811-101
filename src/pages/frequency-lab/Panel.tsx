/**
 * The lab guide: what the signal is doing now, first, then how locating works, what to try and
 * the rule, each of which folds away. A side panel on wide screens that can be closed to its
 * title; a bottom sheet on phones and short screens, which also holds the lesson's one line and
 * the key (wider screens show those beside the view).
 */
import { useId } from 'preact/hooks';
import type { Frequency } from '../../../config/equipment.ts';
import {
  INTRO,
  RULE,
  SETUP_TEXT,
  TAGLINE,
  TERMS,
  TRY_THIS,
} from '../../../content/training/frequency-lab.ts';
import { Disclosure } from '../../design/Disclosure.tsx';
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
    happening: useId(),
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
        {/* Phones and short screens: the lesson's one line, which wider screens show by the view. */}
        <p class="panel-lede">{TAGLINE.text}</p>

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

        <Disclosure icon="info" title={INTRO.heading}>
          {INTRO.claims.map((c) => (
            <p key={c.id}>
              <Rich text={c.text} define={define} />
            </p>
          ))}
          <p class="muted">{INTRO.howTo}</p>
        </Disclosure>

        <Disclosure icon="idea" title="Try this">
          <ul class="try-list">
            {TRY_THIS[setup].map((c) => (
              <li key={c.id}>
                <Rich text={c.text} define={define} />
              </li>
            ))}
          </ul>
        </Disclosure>

        <Disclosure icon="rule" title={RULE.heading}>
          <p class="rule">
            <strong>{lowest.text}</strong> {why.text}
          </p>
          <p>{higher.text}</p>
          <p class="muted">{ruleSummary(setup)}</p>
        </Disclosure>

        {/* Phones and short screens: the key, which wider screens show by the view. */}
        <div class="panel-key">
          <Disclosure icon="list" title="Key" open={false}>
            <Legend setup={setup} />
          </Disclosure>
        </div>

        <div class="panel-footer">
          <button type="button" class="text-button" onClick={props.onAbout}>
            About this model
          </button>
        </div>
      </div>
    </aside>
  );
}
