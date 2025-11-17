/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Linter } from 'eslint'

export default [
  // Test files - Allow 'any' for testing flexibility
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      'specs/**/*.ts',
      'specs/**/*.tsx',
      'scripts/**/*.test.ts',
      'scripts/**/*.test.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' in tests for testing invalid inputs
      '@typescript-eslint/naming-convention': 'off', // Allow flexible naming in tests
      'no-restricted-syntax': 'off', // Allow mutations in tests for setup/mocking
      'no-param-reassign': 'off', // Allow parameter reassignment in test setup
      'functional/no-expression-statements': 'off', // Allow test assertions and setup
      'functional/no-let': 'off', // Allow let in test setup
      'functional/immutable-data': 'off', // Allow mutations in test setup
      'functional/prefer-immutable-types': 'off', // Allow mutable types in tests
      'functional/no-throw-statements': 'off', // Allow throwing in tests
      'functional/no-loop-statements': 'off', // Allow loops in tests
      'prefer-destructuring': 'off', // Allow non-destructured assignments in tests
      'unicorn/no-null': 'off', // Allow null in tests for edge cases
      // Size limits OFF for test files (comprehensive test suites require longer functions)
      'max-lines': 'off', // Tests can be comprehensive
      'max-lines-per-function': 'off', // Test functions contain multiple scenarios
      'max-statements': 'off', // Test setup can have many statements
      complexity: 'off', // Test scenarios can be complex
    },
  },

  // E2E Tests - Must use Playwright (not Bun Test)
  // Enforces testing strategy: E2E tests in specs/ directory use Playwright
  {
    files: ['specs/**/*.ts', 'specs/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'bun:test',
              message:
                'E2E tests (in specs/ directory) must use Playwright, not Bun Test. Import from @playwright/test instead. See docs/architecture/testing-strategy.md',
            },
          ],
        },
      ],
    },
  },

  // Unit Tests - Must use Bun Test (not Playwright)
  // Enforces testing strategy: Unit tests (*.test.ts) use Bun Test
  {
    files: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'scripts/**/*.test.ts',
      'scripts/**/*.test.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              message:
                'Unit tests (*.test.ts) must use Bun Test, not Playwright. Import from bun:test instead. See docs/architecture/testing-strategy.md',
            },
          ],
        },
      ],
    },
  },
] satisfies Linter.Config[]
