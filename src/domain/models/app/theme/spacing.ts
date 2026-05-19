/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const SpacingConfigSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-z]+(-[a-z]+)*$/, {
      message: () => 'Spacing key must use kebab-case (e.g., container-small, not containerSmall)',
    }),
    Schema.annotations({
      title: 'Spacing Token Name',
      description: 'Kebab-case name for spacing token (e.g., container-small, not containerSmall)',
      examples: [
        'section',
        'container',
        'container-small',
        'gap',
        'gap-small',
        'padding',
        'margin',
      ],
    })
  ),
  value: Schema.String.pipe(
    Schema.annotations({
      title: 'Spacing Value',
      description:
        'Spacing value as Tailwind utility classes or CSS values (rem, px, em, %). Supports responsive variants (sm:, md:, lg:) and multiple classes.',
      examples: [
        'py-16',
        'px-4',
        'py-16 sm:py-20',
        'max-w-7xl mx-auto px-4',
        'gap-6',
        'p-6',
        'm-6',
        '4rem',
        '16px',
        '1.5em',
      ],
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Spacing Configuration',
    description: 'Spacing design tokens for consistent layout',
    examples: [
      {
        section: 'py-16 sm:py-20',
        container: 'max-w-7xl mx-auto px-4',
        'container-small': 'max-w-4xl mx-auto px-4',
        'container-xsmall': 'max-w-2xl mx-auto px-4',
        gap: 'gap-6',
        'gap-small': 'gap-4',
        'gap-large': 'gap-8',
        padding: 'p-6',
        'padding-small': 'p-4',
        'padding-large': 'p-8',
        margin: 'm-6',
        'margin-small': 'm-4',
        'margin-large': 'm-8',
      },
    ],
  })
)

export type SpacingConfig = Schema.Schema.Type<typeof SpacingConfigSchema>
