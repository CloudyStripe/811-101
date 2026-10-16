/**
 * The lab guide: what the signal is doing now, first, then how locating works, what to try and
 * the rule, in plain sections, and the way to About this model. On phones it starts with the
 * lesson's one line, which wider screens show over the view.
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
import { Icon } from '../../design/icons.tsx';
import { Rich } from '../../design/Term.tsx';
import type { SetupId } from '../../signal/model.ts';
import { ruleSummary, stateLead, stateNote } from './summary.ts';

export const define = (key: string): string | undefined => TERMS[key]?.text;

export function Guide(props: { setup: SetupId; frequency: Frequency; onAbout: () => void }) {
  const { setup, frequency } = props;
  const ids = { happening: useId(), how: useId(), try: useId(), rule: useId() };
  const [lowest, why, higher] = RULE.claims;

  return (
    <div class="guide">
      <p class="guide-lede">{TAGLINE.text}</p>

      <section class="guide-section" aria-labelledby={ids.happening}>
        <h3 id={ids.happening}>What's happening</h3>
        <p>
          <strong>{stateLead(setup, frequency)}:</strong>{' '}
          <Rich text={stateNote(frequency)} define={define} />
        </p>
        <p>
          <Rich text={SETUP_TEXT[setup].note.text} define={define} />
        </p>
      </section>

      <section class="guide-section" aria-labelledby={ids.how}>
        <h3 id={ids.how}>
          <Icon name="info" />
          {INTRO.heading}
        </h3>
        {INTRO.claims.map((c) => (
          <p key={c.id}>
            <Rich text={c.text} define={define} />
          </p>
        ))}
        <p class="muted">{INTRO.howTo}</p>
      </section>

      <section class="guide-section" aria-labelledby={ids.try}>
        <h3 id={ids.try}>
          <Icon name="idea" />
          Try this
        </h3>
        <ul class="try-list">
          {TRY_THIS[setup].map((c) => (
            <li key={c.id}>
              <Rich text={c.text} define={define} />
            </li>
          ))}
        </ul>
      </section>

      <section class="guide-section" aria-labelledby={ids.rule}>
        <h3 id={ids.rule}>
          <Icon name="rule" />
          {RULE.heading}
        </h3>
        <p class="rule">
          <strong>{lowest.text}</strong> {why.text}
        </p>
        <p>{higher.text}</p>
        <p class="muted">{ruleSummary(setup)}</p>
        <button type="button" class="text-button guide-about" onClick={props.onAbout}>
          About this model
        </button>
      </section>
    </div>
  );
}
