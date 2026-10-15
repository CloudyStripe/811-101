import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { BASE_PATH } from './config/brand.ts';
import { PAGES } from './src/site/pages.ts';
import { notFoundPages, preloadScenes, siteShell, siteTokens } from './src/site/vite.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: BASE_PATH,
  // Pages, not an app: an unknown path is a 404, as on GitHub Pages, rather than the portal.
  appType: 'mpa',
  plugins: [siteTokens(), siteShell(), notFoundPages(), preloadScenes()],
  build: {
    target: 'es2022',
    manifest: true,
    // scripts/budgets.ts enforces gzip sizes per chunk; the 3D vendor chunk is ~760 KB minified.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      input: Object.fromEntries(PAGES.map((p) => [p.id, resolve(root, p.html)])),
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
