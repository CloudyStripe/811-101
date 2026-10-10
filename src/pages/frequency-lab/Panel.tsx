/**
 * The lab's guide: a side panel on wide screens and a bottom sheet on phones. It covers what the
 * lab is, what the signal is doing right now (with the chart), what to try, the rule, and the key.
 */
import { useId, useState } from 'preact/hooks';
import type { Frequency } from '../../../config/equipment.ts';
import {
  BLEED_DIRECTION,
  FREQUENCY_NOTES,
  INTRO,
  KEY,
  RULE,
  SETUP_TEXT,
  TERMS,
  TRY_THIS,
} from '../../../content/training/frequency-lab.ts';
import { Icon } from '../../design/icons.tsx';
import { Rich } from '../../design/Term.tsx';
import type { SetupId } from '../../signal/model.ts';
import { Chart } from './Chart.tsx';
import { Legend } from './Legend.tsx';
import { ruleSummary, stateSummary } from './summary.ts';

export const define = (key: string): string | undefined => TERMS[key]?.text;

export interface PanelProps {
  setup: SetupId;
  frequency: Frequency;
  /** Phones only: whether the sheet is expanded. Wide screens always show everything. */
  sheetOpen: boolean;
  onSheetToggle: () => void;
  onAbout: () => void;
}

export function Panel({ setup, frequency, sheetOpen, onSheetToggle, onAbout }: PanelProps) {
  const [introOpen, setIntroOpen] = useState(true);
  const ids = {
    body: useId(),
    intro: useId(),
    happening: useId(),
    tryThis: useId(),
    rule: useId(),
    key: useId(),
  };
  const summary = stateSummary(setup, frequency);
  // "Steel main at 83 kHz:" leads in bold; the reading follows.
  const split = summary.indexOf(': ') + 1;
  const [lowest, why, stepUp, higher] = RULE.claims;

  return (
    <aside
      class="lab-panel"
      aria-label="Lab guide"
      data-open={sheetOpen ? '' : undefined}
      data-chrome
    >
      <div class="sheet-bar">
        <p class="sheet-summary">{summary}</p>
        <p class="sheet-title" aria-hidden="true">
          Lab guide
        </p>
        <button
          type="button"
          class="sheet-toggle"
          aria-expanded={sheetOpen}
          aria-controls={ids.body}
          onClick={onSheetToggle}
        >
          Details
          <Icon name={sheetOpen ? 'chevron-down' : 'chevron-up'} />
        </button>
      </div>

      <div class="panel-body" id={ids.body}>
        <section class="panel-section">
          <h2 class="disclosure">
            <button
              type="button"
              aria-expanded={introOpen}
              aria-controls={ids.intro}
              onClick={() => {
                setIntroOpen(!introOpen);
              }}
            >
              {INTRO.heading}
              <Icon name={introOpen ? 'chevron-up' : 'chevron-down'} />
            </button>
          </h2>
          <div id={ids.intro} hidden={!introOpen}>
            {INTRO.claims.map((c) => (
              <p key={c.id}>
                <Rich text={c.text} define={define} />
              </p>
            ))}
            <p class="muted">{INTRO.howTo}</p>
          </div>
        </section>

        <section class="panel-section" aria-labelledby={ids.happening}>
          <h2 id={ids.happening}>What's happening</h2>
          <p class="state-summary">
            <strong>{summary.slice(0, split)}</strong>
            {summary.slice(split)}
          </p>
          <Chart setup={setup} frequency={frequency} />
          <p>
            <Rich text={SETUP_TEXT[setup].note.text} define={define} />
          </p>
          <p>
            <Rich text={FREQUENCY_NOTES[frequency].text} define={define} />
          </p>
          <p>
            <Rich text={BLEED_DIRECTION.text} define={define} />
          </p>
        </section>

        <section class="panel-section" aria-labelledby={ids.tryThis}>
          <h2 id={ids.tryThis}>Try this</h2>
          <ul class="try-list">
            {TRY_THIS[setup].map((c) => (
              <li key={c.id}>
                <Rich text={c.text} define={define} />
              </li>
            ))}
          </ul>
        </section>

        <section class="panel-section" aria-labelledby={ids.rule}>
          <h2 id={ids.rule}>{RULE.heading}</h2>
          <p class="rule">
            <strong>{lowest.text}</strong> {why.text}
          </p>
          <p>{higher.text}</p>
          <p>{stepUp.text}</p>
          <p class="muted">{ruleSummary(setup)}</p>
        </section>

        <section class="panel-section" aria-labelledby={ids.key}>
          <h2 id={ids.key}>{KEY.heading}</h2>
          <Legend setup={setup} define={define} />
        </section>

        <div class="panel-footer">
          <button type="button" class="text-button" onClick={onAbout}>
            About this model
          </button>
        </div>
      </div>
    </aside>
  );
}
