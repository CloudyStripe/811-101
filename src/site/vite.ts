/**
 * The build's site plugins:
 * - `siteTokens`: the design tokens as a CSS module (`virtual:tokens.css`).
 * - `siteShell`: each built page's head, header, footer and loader (src/site/shell.ts).
 * - `notFoundPages`: unknown addresses get the site's 404 page, with a 404 status, in the dev and
 *   preview servers as on GitHub Pages.
 * - `preloadScenes`: a 3D page starts fetching its scene code with the page itself, after what
 *   its first paint needs.
 * - `firstPaint`: each page's own script holds its first paint until it runs, and the fonts its
 *   first screen sets text in start loading with the page.
 */
import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { relative, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { tokensCss } from '../design/tokens.ts';
import { pageById, pageForHtml } from './pages.ts';
import { BOOT, renderPage } from './shell.ts';

export function siteTokens(): Plugin {
  const id = 'virtual:tokens.css';
  const resolved = '/__tokens.css';
  return {
    name: 'site-tokens',
    resolveId: (source) => (source === id ? resolved : undefined),
    load: (source) => (source === resolved ? tokensCss() : undefined),
  };
}

/** The registered page an HTML file is, by its path in the project; none for anything else. */
const pageAt = (root: string, file: string) =>
  pageForHtml(relative(root, file).replaceAll('\\', '/'));

export function siteShell(): Plugin {
  let root = process.cwd();
  return {
    name: 'site-shell',
    configResolved(config) {
      root = config.root;
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const page = pageAt(root, ctx.filename);
        return page ? renderPage(html, page) : html;
      },
    },
  };
}

const wantsPage = (req: IncomingMessage) =>
  (req.method === 'GET' || req.method === 'HEAD') &&
  (req.headers.accept ?? '').includes('text/html');

const isFile = (path: string) => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;

/**
 * What a request finds in this folder: a file (or a folder's index.html), which the server's own
 * handlers serve; a folder asked for without its slash, which GitHub Pages sends on to the slashed
 * address; or nothing.
 */
function lookUp(req: IncomingMessage, folder: string, base: string): 'file' | 'slash' | 'missing' {
  let path: string;
  try {
    path = decodeURIComponent((req.url ?? '/').split(/[?#]/)[0] ?? '/');
  } catch {
    return 'missing';
  }
  // Both servers take the base path off before this runs; strip it in case one doesn't.
  const file = (path.startsWith(base) ? path.slice(base.length) : path).replace(/^\/+/, '');
  if (file === '' || file.endsWith('/')) {
    return isFile(resolve(folder, file, 'index.html')) ? 'file' : 'missing';
  }
  if (isFile(resolve(folder, file))) return 'file';
  return isFile(resolve(folder, file, 'index.html')) ? 'slash' : 'missing';
}

/** Answers what a lookup found that the server's own handlers don't: a redirect, or the 404 page. */
function answer(
  req: IncomingMessage,
  res: ServerResponse,
  found: 'slash' | 'missing',
  base: string,
  notFoundPage: () => Promise<string>,
  next: (error?: unknown) => void,
) {
  if (found === 'slash') {
    const [path = '/', query = ''] = (req.url ?? '/').split(/(?=\?)/);
    const location = `${path.startsWith(base) ? path : `${base}${path.replace(/^\//, '')}`}/${query}`;
    res.statusCode = 301;
    res.setHeader('Location', location);
    res.end();
    return;
  }
  notFoundPage().then((html) => {
    sendNotFound(res, html);
  }, next);
}

function sendNotFound(res: ServerResponse, html: string) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

export function notFoundPages(): Plugin {
  let root = process.cwd();
  let outDir = 'dist';
  let base = '/';
  const notFound = pageById('not-found');
  return {
    name: 'not-found-pages',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
      base = config.base;
    },
    // After Vite's own handlers, but before it serves pages: pages that exist pass on.
    configureServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          const found = wantsPage(req) ? lookUp(req, root, base) : 'file';
          if (found === 'file') {
            next();
            return;
          }
          answer(
            req,
            res,
            found,
            base,
            async () => {
              const raw = await readFile(resolve(root, notFound.html), 'utf8');
              return server.transformIndexHtml(`/${notFound.html}`, raw);
            },
            next,
          );
        });
      };
    },
    configurePreviewServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          const found = wantsPage(req) ? lookUp(req, outDir, base) : 'file';
          if (found === 'file') {
            next();
            return;
          }
          answer(
            req,
            res,
            found,
            base,
            () => readFile(resolve(outDir, notFound.html), 'utf8'),
            next,
          );
        });
      };
    },
  };
}

export function preloadScenes(): Plugin {
  let base = '/';
  let root = process.cwd();
  return {
    name: 'preload-scenes',
    apply: 'build',
    configResolved(config) {
      base = config.base;
      root = config.root;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const page = pageAt(root, ctx.filename);
        const { bundle, chunk: entry } = ctx;
        if (!page?.scene || !bundle || !entry) return [];
        // What the page loads up front anyway.
        const initial = new Set<string>();
        const addInitial = (file: string) => {
          const c = bundle[file];
          if (initial.has(file) || c?.type !== 'chunk') return;
          initial.add(file);
          c.imports.forEach(addInitial);
        };
        addInitial(entry.fileName);
        // Its scene code and everything that imports outright, but not ambient occlusion, which
        // only some quality tiers load.
        const scene = new Set<string>();
        const addScene = (file: string) => {
          const c = bundle[file];
          if (scene.has(file) || initial.has(file) || c?.type !== 'chunk') return;
          if (c.moduleIds.some((id) => id.includes('node_modules/n8ao'))) return;
          scene.add(file);
          c.imports.forEach(addScene);
        };
        entry.dynamicImports.forEach(addScene);
        // Low, so it doesn't hold up what the first paint waits for: the page's styles, its own
        // script, fonts and pictures.
        return [...scene].map((file) => ({
          tag: 'link',
          attrs: {
            rel: 'modulepreload',
            crossorigin: true,
            fetchpriority: 'low',
            href: `${base}${file}`,
          },
          injectTo: 'head' as const,
        }));
      },
    },
  };
}

/**
 * The font files the first screen of every page sets text in, by the start of their built names:
 * the display face, the body face's regular and bold, and the mono face's semibold. (Measured: each
 * page loads exactly these on its first screen, at every size; a font preloaded and not used is a
 * console warning.)
 */
export const FIRST_SCREEN_FONTS = [
  'archivo-latin-wdth-normal-',
  'atkinson-hyperlegible-latin-400-normal-',
  'atkinson-hyperlegible-latin-700-normal-',
  'ibm-plex-mono-latin-600-normal-',
] as const;

/**
 * Each page's first paint, made whole:
 * - Its own script holds it (`blocking="render"`) until it runs, so a page that draws its controls
 *   (a lesson's console or dock, the header's settings button) shows them in its first paint, and
 *   a page change into it animates: Chromium skips the change's animation into a page revealed
 *   while its script is still loading. Browsers that don't know the attribute paint as before.
 * - The fonts its first screen uses load with the page, not once its styles are read and its text
 *   laid out, so they're in before text shows (from the cache on a return, at once).
 */
export function firstPaint(): Plugin {
  let base = '/';
  let root = process.cwd();
  return {
    name: 'first-paint',
    configResolved(config) {
      base = config.base;
      root = config.root;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!pageAt(root, ctx.filename)) return html;
        // The page's own script, its only module script: built, from the bundle (a page with no
        // code of its own, as the 404 page, loads a shared chunk); served in development, its
        // source (not the dev server's client).
        const own = (src: string) =>
          ctx.bundle ? src.startsWith(`${base}assets/`) : src.includes('/src/pages/');
        let marked = 0;
        const out = html.replace(
          /<script type="module"([^>]*) src="([^"]+)"/g,
          (tag, attrs: string, src: string) => {
            if (!own(src) || attrs.includes('blocking=')) return tag;
            marked++;
            return `<script type="module" blocking="render"${attrs} src="${src}"`;
          },
        );
        // Built, a page that misses either (a bundler or font package that names things otherwise)
        // stops the build, rather than quietly painting without its controls or in other faces.
        const built = ctx.bundle !== undefined;
        if (built && marked !== 1) {
          throw new Error(
            `${ctx.filename}: ${String(marked)} scripts of its own to hold the first paint`,
          );
        }
        // Only the WOFF2 files: every browser that reads a preload reads those, so the WOFF ones
        // beside them would never be used.
        const fonts = Object.values(ctx.bundle ?? {})
          .filter((file) => {
            const name = file.fileName.split('/').pop() ?? '';
            return (
              file.type === 'asset' &&
              name.endsWith('.woff2') &&
              FIRST_SCREEN_FONTS.some((font) => name.startsWith(font))
            );
          })
          .map(
            (file) =>
              `<link rel="preload" as="font" type="font/woff2" crossorigin href="${base}${file.fileName}" />`,
          );
        if (built && fonts.length !== FIRST_SCREEN_FONTS.length) {
          throw new Error(
            `${ctx.filename}: ${String(fonts.length)} of the ${String(FIRST_SCREEN_FONTS.length)} first-screen fonts found to preload`,
          );
        }
        if (fonts.length === 0) return out;
        // Straight after the settings script, so they're asked for first, before the pictures,
        // styles and scripts: the pictures have their tiny copies to show meanwhile, and text has
        // nothing but its own face.
        const boot = `<script>${BOOT}</script>`;
        const at = out.indexOf(boot);
        if (at < 0) throw new Error(`${ctx.filename}: no settings script to put the fonts after`);
        const after = at + boot.length;
        return `${out.slice(0, after)}\n    ${fonts.join('\n    ')}${out.slice(after)}`;
      },
    },
  };
}
