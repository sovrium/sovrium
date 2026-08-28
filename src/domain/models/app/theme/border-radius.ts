/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Border radius configuration (design tokens for rounded corners)
 *
 * Map of semantic radius names to CSS border-radius values.
 * Supports progressive rounding scale:
 * - none: 0 (sharp corners)
 * - sm, md, lg, xl, 2xl, 3xl: progressive rounding
 * - full: 9999px (perfect circles/pills)
 *
 * @example
 * ```typescript
 * const borderRadius = {
 *   none: '0',
 *   sm: '0.125rem',
 *   md: '0.375rem',
 *   lg: '0.5rem',
 *   full: '9999px',
 * }
 * ```
 *
 */
export const BorderRadiusConfigSchema = Schema.Record(
  Schema.String.pipe(
    Schema.check(
      Schema.isPattern(/^(DEFAULT|[a-z0-9]+(-[a-z0-9]+)*)$/, {
        message:
          'Border radius key must be DEFAULT or use kebab-case format (lowercase letters/numbers)',
      })
    ),
    Schema.annotate({
      title: 'Border Radius Key',
      description: 'Semantic radius name (kebab-case with numbers) or DEFAULT for base radius',
      examples: ['DEFAULT', 'none', 'sm', 'md', 'lg', '2xl', '3xl', 'full'],
    })
  ),
  Schema.String.pipe(
    Schema.annotate({
      title: 'Border Radius Value',
      description: 'CSS border-radius value',
      examples: ['0', '0.125rem', '0.5rem', '9999px'],
    })
  )
).pipe(
  Schema.annotate({
    title: 'Border Radius',
    description: 'Border radius design tokens',
  })
)

export type BorderRadiusConfig = Schema.Schema.Type<typeof BorderRadiusConfigSchema>
