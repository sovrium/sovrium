/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import effectEslint from '@effect/eslint-plugin'
import type { Linter } from 'eslint'

/**
 * Effect ESLint Configuration
 *
 * Enforces Effect.ts best practices:
 * - no-import-from-barrel-package: Prevents importing from barrel packages for better tree-shaking
 *
 * Note: The `unnecessaryPipeChain` warning comes from the Effect Language Service
 * (TypeScript plugin), not from ESLint.
 */
export default [
  {
    plugins: {
      effect: effectEslint,
    },
    rules: {
      'effect/no-import-from-barrel-package': 'warn',
    },
  },
] as Linter.Config[]
