import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const removedThree = 'Removed or renamed in three r186 and logs a console warning.';

export default defineConfig(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'index.html',
      'docs/',
      'playwright-report/',
      'test-results/',
      'artifacts/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'three',
              importNames: ['Clock', 'PCFSoftShadowMap'],
              message: `${removedThree} Use Timer, and PCFShadowMap with shadow.radius.`,
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'THREE', property: 'Clock', message: `${removedThree} Use Timer.` },
        {
          object: 'THREE',
          property: 'PCFSoftShadowMap',
          message: `${removedThree} Use PCFShadowMap.`,
        },
        {
          object: 'ColorManagement',
          property: 'fromWorkingColorSpace',
          message: `${removedThree} Use workingToColorSpace.`,
        },
        {
          object: 'ColorManagement',
          property: 'toWorkingColorSpace',
          message: `${removedThree} Use colorSpaceToWorking.`,
        },
      ],
    },
  },
);
