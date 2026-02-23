/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import checkFilePlugin from 'eslint-plugin-check-file'
import type { Linter } from 'eslint'

export default [
  // File Naming Conventions - Page Components (PascalCase exception)
  // Must come before the general kebab-case rule
  {
    files: ['src/presentation/ui/pages/**/*.{ts,tsx}'],
    plugins: {
      'check-file': checkFilePlugin,
    },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        {
          '**/*.{ts,tsx}': 'PASCAL_CASE',
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],
    },
  },

  // File Naming Conventions - All other files (kebab-case)
  // Comprehensive enforcement of naming patterns from docs/architecture/file-naming-conventions.md
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    ignores: ['src/presentation/ui/pages/**/*.{ts,tsx}'], // Already handled above
    plugins: {
      'check-file': checkFilePlugin,
    },
    rules: {
      // File naming with pattern specificity (specific patterns first)
      'check-file/filename-naming-convention': [
        'error',
        {
          // Error CLASS files ending with -error.ts (not handlers)
          'src/**/errors/*-error.ts': '*-error',

          // Specific patterns for file types
          'src/infrastructure/database/repositories/*.ts': '*-repository-live',
          'src/infrastructure/layers/*.ts': '*-layer',
          'src/presentation/ui/ui/*-variants.ts': '*-variants',
          'src/presentation/hooks/*.{ts,tsx}': 'use-*',
          'src/presentation/ui/ui/*-hook.ts': '*-hook',

          // DEFAULT: All other files use kebab-case (must be last)
          '**/*.{ts,tsx,js,jsx}': 'KEBAB_CASE',
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],

      // Folder naming: kebab-case for src/ directories only
      'check-file/folder-naming-convention': [
        'error',
        {
          'src/**/': 'KEBAB_CASE',
        },
      ],
    },
  },
] satisfies Linter.Config[]
