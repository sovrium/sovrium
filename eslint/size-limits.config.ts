/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Linter } from 'eslint'

export default [
  // Code Size and Complexity Limits - Prevent overly large files and functions
  // These rules help maintain manageable, testable code
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    ignores: ['*.config.ts', '**/*.config.ts'], // Exclude config files from naming rules
    rules: {
      'max-lines': [
        'warn',
        {
          max: 400, // Warn at 400 lines (ideal target)
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      'max-lines-per-function': [
        'warn',
        {
          max: 50, // Warn at 50 lines per function
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true, // Skip immediately invoked function expressions
        },
      ],

      // Cognitive complexity - prevents overly complex functions
      complexity: ['warn', { max: 10 }], // Cyclomatic complexity limit

      // Prevent deeply nested code
      'max-depth': ['warn', { max: 4 }], // Max nesting depth

      // Limit function parameters (encourages using objects for many params)
      'max-params': ['warn', { max: 4 }],

      // Prevent too many statements in a single function
      'max-statements': ['warn', { max: 20 }, { ignoreTopLevelFunctions: false }],
    },
  },

  // Configuration files and Schema definitions - Can be longer
  {
    files: [
      '**/*.config.{ts,js,mjs,cjs}',
      '**/schemas/**/*.ts',
      'src/domain/models/**/*.ts', // Schema definitions can be comprehensive
      '**/types/**/*.ts', // Type definition files
      'templates/**/*.ts',
    ],
    rules: {
      'max-lines': ['warn', { max: 800, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': 'off', // Schema/config objects can be large
      'max-statements': 'off', // Config setup can have many statements
    },
  },

  // Website page definitions - Declarative data structures
  {
    files: ['website/pages/**/*.ts'],
    rules: {
      'max-lines': 'off', // Page configurations are declarative data structures
      'max-lines-per-function': 'off', // Large configuration objects are acceptable
      'max-statements': 'off', // Configuration setup can have many statements
    },
  },

  // Strict limits for React components - Should be modular
  {
    files: ['src/presentation/components/**/*.tsx'],
    ignores: ['src/presentation/components/**/*.test.tsx'],
    rules: {
      'max-lines': [
        'error',
        {
          max: 300, // Stricter limit for React components
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-lines-per-function': [
        'warn',
        {
          max: 60, // UI components need reasonable length flexibility
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },

  // Third-party UI components (shadcn/ui) - Follow library patterns
  {
    files: ['src/presentation/components/ui/**/*.tsx'],
    ignores: ['src/presentation/components/ui/**/*.test.tsx'],
    rules: {
      'max-lines-per-function': 'off', // shadcn/ui components follow their own patterns
      complexity: 'off', // Complex UI patterns acceptable in third-party components
    },
  },

  // SSR/Page generation components - Declarative configuration rendering
  {
    files: ['src/presentation/components/pages/utils/**/*.tsx'],
    ignores: ['src/presentation/components/pages/utils/**/*.test.tsx'],
    rules: {
      'max-lines-per-function': 'off', // SSR metadata/script rendering is declarative
      complexity: 'off', // Conditional configuration is acceptable
    },
  },

  // Complex use case files with multiple helper functions
  // These files handle complex domains and are well-structured with helper functions
  {
    files: ['src/application/use-cases/server/generate-static.ts'],
    rules: {
      'max-lines': ['warn', { max: 700, skipBlankLines: true, skipComments: true }], // Complex static generation with helpers
      'max-lines-per-function': ['warn', { max: 100 }], // Allow larger helper functions for complex operations
      'max-params': 'off', // Helper functions may need many parameters (consider options objects in future)
    },
  },

  // TODO: Remove these overrides after refactoring (tracked in codebase-refactor-auditor findings)
  // Temporary overrides for files exceeding limits - should be refactored into smaller modules
  {
    files: [
      'src/presentation/components/pages/DynamicPage.tsx',
      'src/presentation/components/sections/component-renderer.tsx',
    ],
    rules: {
      'max-lines': 'warn', // Downgrade from error to warning temporarily
    },
  },
] satisfies Linter.Config[]
