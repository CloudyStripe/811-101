import 'virtual:tokens.css';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '../../design/base.css';
import './lab.css';
import { render } from 'preact';
import { App } from './App.tsx';
import { applyToDocument, loadSettings } from './settings.ts';

applyToDocument(loadSettings());

const root = document.getElementById('app');
if (root) {
  // The static shell is for first paint and no-JS visitors; the app replaces it.
  root.textContent = '';
  render(<App />, root);
}
