import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

const CORE_FILES = 'src/core/**/*.{ts,tsx}'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  {
    // Shared rules for all TS/TSX, independent of environment globals.
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Browser/React code outside src/core. Kept as its own block (rather
    // than merging `globals.browser` into the shared block above) because
    // flat config merges `languageOptions.globals` across matching blocks
    // instead of replacing it, which would otherwise leak browser globals
    // like `document` into src/core.
    files: ['**/*.{ts,tsx}'],
    ignores: [CORE_FILES],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // src/core must stay a pure, framework-free module: no React, DOM, or
    // Web Audio imports, so it keeps running in Node for unit tests.
    // no-undef (from eslint:recommended above) plus Node-only globals here
    // catch ambient DOM/Web Audio globals like `window` or `AudioContext`,
    // since those aren't imports that no-restricted-imports can see.
    files: [CORE_FILES],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // typescript-eslint's recommended config turns no-undef off (TS
      // usually covers it); re-enable it here since it's how ambient
      // globals like `window` get caught in this framework-free zone.
      'no-undef': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/core must stay framework-free.' },
            { name: 'react-dom', message: 'src/core must stay framework-free.' },
          ],
          patterns: [
            { group: ['react/*', 'react-dom/*'], message: 'src/core must stay framework-free.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.config.{js,ts}', 'scripts/**/*.{js,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
)
