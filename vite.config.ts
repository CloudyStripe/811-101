import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import { tokensCss } from './src/design/tokens.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

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

/** Today's diorama stays the site root, copied byte-for-byte and never processed. */
function legacyRoot(): Plugin {
  let outDir = 'dist';
  return {
    name: 'legacy-root',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async writeBundle() {
      await copyFile(resolve(root, 'index.html'), resolve(outDir, 'index.html'));
    },
  };
}

/**
 * Starts downloading the 3D chunks with the page. The app asks for them only after it has loaded
 * and run, which on a slow connection costs a round trip before the 3D view can start.
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
  plugins: [tokens(), legacyRoot(), preload3d()],
  build: {
    target: 'es2022',
    manifest: true,
    // scripts/budgets.ts enforces gzip sizes per chunk; the 3D vendor chunk is ~760 KB minified.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      input: { 'frequency-lab': resolve(root, 'training/frequency-lab/index.html') },
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
    include: ['src/**/*.test.ts', 'content/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
