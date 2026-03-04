/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import js from '@eslint/js'
import type { Linter } from 'eslint'
import globals from 'globals'

export default [
  // Global ignores
  {
    ignores: [
      '.claude/**',
      'dist/**',
      'node_modules/**',
      '.next/**',
      '.turbo/**',
      'test-results/**', // Playwright test results directory
      'playwright-report/**', // Playwright HTML report directory
      'schemas/**', // Generated schema exports
      'tmp/**', // Temporary test files
      'eslint/**', // ESLint config modules - not subject to linting
      'website/build/**', // Website static build output
    ],
  },

  // Base JavaScript recommended rules
  js.configs.recommended,

  // Base JavaScript configuration
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,tsx}'],
    languageOptions: { globals: globals.browser },
  },

  // Node.js scripts configuration
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
] satisfies Linter.Config[]
