import 'virtual:tokens.css';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '../../design/base.css';
import './portal.css';
import { render } from 'preact';
import { applyToDocument, loadSettings } from '../../site/settings.ts';
import { Portal } from './Portal.tsx';

applyToDocument(loadSettings());

const root = document.getElementById('app');
if (root) {
  // The static shell is for first paint and no-JS visitors; the app replaces it.
  root.textContent = '';
  render(<Portal />, root);
}
