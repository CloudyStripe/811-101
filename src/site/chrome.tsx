/**
 * The interactive parts of the site shell, mounted once a page's code runs: the settings menu in
 * the header. The rest of the shell is static HTML (src/site/shell.ts).
 */
import { render } from 'preact';
import { followOtherTabs, getSettings, applyToDocument } from './settings.ts';
import { SettingsMenu } from './SettingsMenu.tsx';

export function mountSiteChrome(): void {
  applyToDocument(getSettings());
  followOtherTabs();
  const slot = document.getElementById('site-settings');
  if (slot) render(<SettingsMenu />, slot);
}
