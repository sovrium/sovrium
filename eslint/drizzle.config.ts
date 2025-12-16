/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// @ts-expect-error - Plugin lacks proper TypeScript definitions for flat config
import drizzlePlugin from 'eslint-plugin-drizzle'
import type { Linter } from 'eslint'

// Type workaround for flat config compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const drizzle = drizzlePlugin as any

export default [
  // Drizzle ORM - Safety rules to prevent catastrophic database operations
  // Enforces WHERE clauses in DELETE and UPDATE to prevent accidental mass operations
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      drizzle,
    },
    rules: {
      // Prevent accidental deletion of all rows - require WHERE clause
      'drizzle/enforce-delete-with-where': 'error',

      // Prevent accidental update of all rows - require WHERE clause
      'drizzle/enforce-update-with-where': 'error',
    },
  },
  // Disable drizzle rules for E2E specs - they use Playwright's request.delete() for HTTP requests,
  // not Drizzle's db.delete(), which causes false positives
  {
    files: ['specs/**/*.{ts,tsx}'],
    rules: {
      'drizzle/enforce-delete-with-where': 'off',
      'drizzle/enforce-update-with-where': 'off',
    },
  },
] satisfies Linter.Config[]
