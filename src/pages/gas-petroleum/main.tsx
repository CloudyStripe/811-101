import '../../site/boot.ts';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './diorama.css';
import { render } from 'preact';
import { arrived } from '../../site/arrival.ts';
import { keepShellLoader } from '../../site/loader.ts';
import { App } from './App.tsx';

const root = document.getElementById('app');
if (root) {
  // The static shell is for first paint and no-JS visitors; the app replaces it, once any page
  // change still showing the shell's loader is done.
  void arrived().then(() => {
    // Its own loader carries on with the shell's pictures.
    keepShellLoader(root);
    root.textContent = '';
    render(<App />, root);
  });
}
