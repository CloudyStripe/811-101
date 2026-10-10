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

export default defineConfig({
  base: '/811-101/',
  plugins: [tokens(), legacyRoot()],
  build: {
    target: 'es2022',
    manifest: true,
    rolldownOptions: {
      input: { 'frequency-lab': resolve(root, 'training/frequency-lab/index.html') },
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-3d',
              test: /node_modules[\\/](three|postprocessing|camera-controls)[\\/]/,
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
