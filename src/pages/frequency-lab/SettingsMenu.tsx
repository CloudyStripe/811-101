/**
 * Settings: theme, motion and quality. A native popover, so the browser handles Escape, clicks
 * outside and returning focus; it opens just below its button.
 */
import type { TargetedToggleEvent } from 'preact';
import { useRef } from 'preact/hooks';
import { Icon } from '../../design/icons.tsx';
import type { Settings } from './settings.ts';

const POPOVER_ID = 'lab-settings';
const WIDTH = 288;
const EDGE = 12;

type Option<K extends keyof Settings> = readonly [Settings[K], string];

const GROUPS: {
  [K in keyof Settings]: { legend: string; options: readonly Option<K>[] };
} = {
  theme: {
    legend: 'Theme',
    options: [
      ['system', 'Match device'],
      ['light', 'Light'],
      ['dark', 'Dark'],
    ],
  },
  motion: {
    legend: 'Motion',
    options: [
      ['system', 'Match device'],
      ['reduce', 'Reduced'],
      ['full', 'Full'],
    ],
  },
  quality: {
    legend: '3D quality',
    options: [
      ['auto', 'Automatic'],
      ['low', 'Low'],
      ['medium', 'Medium'],
      ['high', 'High'],
    ],
  },
};

function Group<K extends keyof Settings>({
  name,
  value,
  onPick,
}: {
  name: K;
  value: Settings[K];
  onPick: (value: Settings[K]) => void;
}) {
  const group: { legend: string; options: readonly Option<K>[] } = GROUPS[name];
  return (
    <fieldset class="settings-group">
      <legend>{group.legend}</legend>
      {group.options.map(([option, label]) => (
        <label key={option} class="radio">
          <input
            type="radio"
            name={`setting-${name}`}
            value={option}
            checked={value === option}
            onChange={() => {
              onPick(option);
            }}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

export function SettingsMenu({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);

  function place(event: TargetedToggleEvent<HTMLDivElement>) {
    const r = button.current?.getBoundingClientRect();
    if (event.newState !== 'open' || !r) return;
    const left = Math.max(EDGE, Math.min(r.right - WIDTH, innerWidth - EDGE - WIDTH));
    const top = Math.round(r.bottom + 8);
    const { style } = event.currentTarget;
    style.top = `${String(top)}px`;
    style.left = `${String(Math.round(left))}px`;
    // On a short screen it scrolls within the room below its button.
    style.maxHeight = `${String(Math.max(160, innerHeight - top - EDGE))}px`;
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        class="icon-button"
        popovertarget={POPOVER_ID}
        aria-label="Settings"
        title="Settings"
      >
        <Icon name="settings" />
      </button>
      <div
        id={POPOVER_ID}
        popover="auto"
        class="settings"
        role="dialog"
        aria-labelledby={`${POPOVER_ID}-title`}
        onBeforeToggle={place}
      >
        <h2 id={`${POPOVER_ID}-title`}>Settings</h2>
        <Group
          name="theme"
          value={settings.theme}
          onPick={(theme) => {
            onChange({ ...settings, theme });
          }}
        />
        <Group
          name="motion"
          value={settings.motion}
          onPick={(motion) => {
            onChange({ ...settings, motion });
          }}
        />
        <Group
          name="quality"
          value={settings.quality}
          onPick={(quality) => {
            onChange({ ...settings, quality });
          }}
        />
        <p class="settings-note">These are saved in this browser. The lab saves nothing else.</p>
      </div>
    </>
  );
}
