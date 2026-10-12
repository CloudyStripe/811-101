import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import { fillBrand } from './config/brand.ts';
import { tokensCss } from './src/design/tokens.ts';
import { BOOT_SCRIPT } from './src/site/settings.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

/** The original diorama, published as it is: copied byte-for-byte and never processed. */
const DIORAMA = 'utilities/gas-petroleum/index.html';
/** The Frequency Lab's page, the only built page that loads the 3D code. */
const LAB = 'training/frequency-lab/index.html';

/** Serves the design tokens as a CSS module, so CSS, the 3D scene and the tests share one source. */
function tokens(): Plugin {
  const id = 'virtual:tokens.css';
  const resolved = '/__tokens.css';
  return {
    name: 'tokens-css',
    resolveId: (source) => (source === id ? resolved : undefined),
    load: (source) => (source === resolved ? tokensCss() : undefined),
  };
}

/**
 * Applies saved display settings in each built page's <head>, before first paint. Not the
 * diorama: it's published as it is, and the dev server would otherwise add it there.
 */
function settingsBoot(): Plugin {
  return {
    name: 'settings-boot',
    transformIndexHtml: (_html, ctx) =>
      ctx.path.endsWith(DIORAMA)
        ? []
        : [{ tag: 'script', children: BOOT_SCRIPT, injectTo: 'head-prepend' }],
  };
}

/** Fills the brand into pages that ask for it (see config/brand.ts). */
function brand(): Plugin {
  return {
    name: 'brand',
    transformIndexHtml: { order: 'pre', handler: (html) => fillBrand(html) },
  };
}

/** Copies the diorama into the build unchanged. */
function diorama(): Plugin {
  let outDir = 'dist';
  return {
    name: 'diorama',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async writeBundle() {
      const to = resolve(outDir, DIORAMA);
      await mkdir(dirname(to), { recursive: true });
      await copyFile(resolve(root, DIORAMA), to);
    },
  };
}

/**
 * Starts downloading the 3D chunks with the lab's page. The app asks for them only after it has
 * loaded and run, which on a slow connection costs a round trip before the 3D view can start.
 */
function preload3d(): Plugin {
  let base = '/';
  return {
    name: 'preload-3d',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.path.endsWith(LAB)) return [];
        return Object.values(ctx.bundle ?? {})
          .filter((c) => c.type === 'chunk' && (c.name === 'vendor-3d' || c.name === 'scene'))
          .map((c) => ({
            tag: 'link',
            attrs: { rel: 'modulepreload', crossorigin: true, href: `${base}${c.fileName}` },
            injectTo: 'head' as const,
          }));
      },
    },
  };
}

export default defineConfig({
  base: '/811-101/',
  // Pages, not an app: an unknown path is a 404, as on GitHub Pages, rather than the portal.
  appType: 'mpa',
  plugins: [tokens(), brand(), settingsBoot(), diorama(), preload3d()],
  build: {
    target: 'es2022',
    manifest: true,
    // scripts/budgets.ts enforces gzip sizes per chunk; the 3D vendor chunk is ~760 KB minified.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      input: {
        portal: resolve(root, 'index.html'),
        'frequency-lab': resolve(root, LAB),
      },
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-3d',
              test: /node_modules[\\/](three|postprocessing)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    include: [
      'src/**/*.test.ts',
      'content/**/*.test.ts',
      'config/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
    environment: 'node',
  },
});
