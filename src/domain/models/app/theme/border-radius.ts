/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const BorderRadiusConfigSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^(DEFAULT|[a-z0-9]+(-[a-z0-9]+)*)$/, {
      message: () =>
        'Border radius key must be DEFAULT or use kebab-case format (lowercase letters/numbers)',
    }),
    Schema.annotations({
      title: 'Border Radius Key',
      description: 'Semantic radius name (kebab-case with numbers) or DEFAULT for base radius',
      examples: ['DEFAULT', 'none', 'sm', 'md', 'lg', '2xl', '3xl', 'full'],
    })
  ),
  value: Schema.String.pipe(
    Schema.annotations({
      title: 'Border Radius Value',
      description: 'CSS border-radius value',
      examples: ['0', '0.125rem', '0.5rem', '9999px'],
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Border Radius',
    description: 'Border radius design tokens',
  })
)

export type BorderRadiusConfig = Schema.Schema.Type<typeof BorderRadiusConfigSchema>
