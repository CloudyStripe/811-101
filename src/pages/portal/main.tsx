import '../../site/boot.ts';
import './portal.css';
import { render } from 'preact';
import { Portal } from './Portal.tsx';

const root = document.getElementById('app');
if (root) {
  // The static shell is for first paint and no-JS visitors; the app replaces it.
  root.textContent = '';
  render(<Portal />, root);
}
