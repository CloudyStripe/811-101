/**
 * What every page starts with: the tokens, the site's fonts and shared styles, and the shell's
 * interactive parts. Pages import this first, then their own styles and code.
 */
import 'virtual:tokens.css';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '../design/base.css';
import '../design/components.css';
import './site.css';
import { mountSiteChrome } from './chrome.tsx';

mountSiteChrome();
