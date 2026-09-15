import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // src/core must stay a pure, framework-free module: no React, DOM, or
    // Web Audio imports, so it keeps running in Node for unit tests.
    files: ['src/core/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Re-enable no-undef (typescript-eslint's recommended config turns it
      // off) so DOM/Web Audio globals like `window` or `AudioContext` are
      // flagged here, since they're ambient rather than imports.
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
