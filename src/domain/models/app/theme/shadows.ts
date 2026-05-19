/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ShadowsConfigSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
      message: () => 'Shadow key must use kebab-case format (lowercase letters/numbers)',
    }),
    Schema.annotations({
      title: 'Shadow Key',
      description: 'Semantic shadow name (kebab-case with numbers)',
      examples: ['sm', 'md', 'lg', 'xl', '2xl', 'inner', 'none'],
    })
  ),
  value: Schema.String.pipe(
    Schema.annotations({
      title: 'Shadow Value',
      description: 'CSS box-shadow value',
      examples: [
        '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
      ],
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Shadows',
    description: 'Box shadow design tokens',
  })
)

export type ShadowsConfig = Schema.Schema.Type<typeof ShadowsConfigSchema>
