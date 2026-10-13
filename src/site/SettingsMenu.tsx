/**
 * Settings, the same on every page: theme, motion and 3D quality, each a row of choices. A
 * native popover under the header's button, so the browser handles Escape, clicks outside and
 * returning focus. Choices apply at once and are remembered in this browser.
 */
import type { TargetedToggleEvent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Icon } from '../design/icons.tsx';
import { Segmented } from '../design/Segmented.tsx';
import type { Settings } from './settings.ts';
import { useSettings } from './useSettings.ts';

const POPOVER_ID = 'site-settings-menu';
const WIDTH = 320;
const EDGE = 12;

const GROUPS: {
  [K in keyof Settings]: {
    label: string;
    options: readonly { value: Settings[K]; label: string }[];
  };
} = {
  theme: {
    label: 'Theme',
    options: [
      { value: 'system', label: 'Match device' },
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ],
  },
  motion: {
    label: 'Motion',
    options: [
      { value: 'system', label: 'Match device' },
      { value: 'reduce', label: 'Reduced' },
      { value: 'full', label: 'Full' },
    ],
  },
  quality: {
    label: '3D quality',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ],
  },
};

/** One setting: its name, seen, and its choices as a radio group that carries the name. */
function Row<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onPick: (value: T) => void;
}) {
  return (
    <div class="settings-row">
      <p class="settings-label" aria-hidden="true">
        {label}
      </p>
      <Segmented
        label={label}
        value={value}
        options={options}
        onChange={onPick}
        class="settings-choices"
      />
    </div>
  );
}

export function SettingsMenu() {
  const [settings, setSettings] = useSettings();
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const close = () => {
    if (popover.current?.matches(':popover-open')) popover.current.hidePopover();
  };

  // It stays put while the page scrolls under it, so it closes instead. Only the page's own
  // scrolling counts (it reaches the window); the menu scrolling inside itself doesn't.
  useEffect(() => {
    const onScroll = () => {
      close();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  function place(event: TargetedToggleEvent<HTMLDivElement>) {
    const r = button.current?.getBoundingClientRect();
    if (event.newState !== 'open' || !r) return;
    const width = Math.min(WIDTH, innerWidth - 2 * EDGE);
    const left = Math.max(EDGE, Math.min(r.right - width, innerWidth - EDGE - width));
    const top = Math.round(r.bottom + 8);
    const { style } = event.currentTarget;
    style.top = `${String(top)}px`;
    style.left = `${String(Math.round(left))}px`;
    style.width = `${String(Math.round(width))}px`;
    // On a short screen it scrolls within the room below its button.
    style.maxHeight = `${String(Math.max(160, innerHeight - top - EDGE))}px`;
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        class="icon-button site-settings-button"
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
        ref={popover}
        onBeforeToggle={place}
        onFocusOut={(event) => {
          // Tabbing out of it closes it, so it never covers what has focus.
          const next = event.relatedTarget as Node | null;
          if (next && !popover.current?.contains(next) && next !== button.current) close();
        }}
      >
        <h2 id={`${POPOVER_ID}-title`}>Settings</h2>
        <Row
          {...GROUPS.theme}
          value={settings.theme}
          onPick={(theme) => {
            setSettings({ ...settings, theme });
          }}
        />
        <Row
          {...GROUPS.motion}
          value={settings.motion}
          onPick={(motion) => {
            setSettings({ ...settings, motion });
          }}
        />
        <Row
          {...GROUPS.quality}
          value={settings.quality}
          onPick={(quality) => {
            setSettings({ ...settings, quality });
          }}
        />
        <p class="settings-note">
          Saved in this browser, for every page. The site keeps nothing else.
        </p>
      </div>
    </>
  );
}
