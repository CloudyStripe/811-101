/** The display settings, kept in step with the header's menu and with other tabs. */
import { useEffect, useState } from 'preact/hooks';
import { getSettings, setSettings, subscribeSettings, type Settings } from './settings.ts';

export function useSettings(): [Settings, (next: Settings) => void] {
  const [settings, set] = useState<Settings>(getSettings);
  useEffect(() => subscribeSettings(set), []);
  return [settings, setSettings];
}
