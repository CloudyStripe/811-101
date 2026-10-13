import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import { BASE_PATH } from './config/brand.ts';
import { PAGES, pageById } from './src/site/pages.ts';
import { notFoundPages, preloadScenes, siteShell, siteTokens } from './src/site/vite.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

/** The original diorama, published as it is: copied byte-for-byte and never processed. */
const DIORAMA = pageById('gas-petroleum').html;

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

export default defineConfig({
  base: BASE_PATH,
  // Pages, not an app: an unknown path is a 404, as on GitHub Pages, rather than the portal.
  appType: 'mpa',
  plugins: [siteTokens(), siteShell(), notFoundPages(), diorama(), preloadScenes()],
  build: {
    target: 'es2022',
    manifest: true,
    // scripts/budgets.ts enforces gzip sizes per chunk; the 3D vendor chunk is ~760 KB minified.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      input: Object.fromEntries(
        PAGES.filter((p) => p.built).map((p) => [p.id, resolve(root, p.html)]),
      ),
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
