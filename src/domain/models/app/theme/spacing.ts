/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Spacing Configuration
 *
 * Spacing design tokens for consistent layout. Supports both Tailwind utility
 * classes (py-16, px-4) and raw CSS values (4rem, 16px, 1.5em).
 *
 * **Behavior Specifications**:
 * - Validates Tailwind spacing utilities (py-16, px-4, gap-6, etc.)
 * - Validates responsive spacing with Tailwind breakpoints (py-16 sm:py-20)
 * - Validates centering and width constraints (max-w-7xl mx-auto px-4)
 * - Validates consistent spacing scale (gap-small, gap, gap-large)
 * - Validates custom CSS spacing values (2rem, 16px, 1.5em)
 * - Supports hierarchical content width constraints (container, container-small, container-xsmall)
 *
 * **Token Categories**:
 * - Section spacing: Vertical rhythm for page sections (py-16 sm:py-20)
 * - Container spacing: Width constraints and centering (max-w-7xl mx-auto px-4)
 * - Gap spacing: Space between flex/grid items (gap-6)
 * - Padding spacing: Internal component spacing (p-6, p-4, p-8)
 * - Margin spacing: External component spacing (m-6, m-4, m-8)
 *
 * @example
 * ```typescript
 * // Complete spacing system
 * const spacing = {
 *   section: 'py-16 sm:py-20',
 *   container: 'max-w-7xl mx-auto px-4',
 *   'container-small': 'max-w-4xl mx-auto px-4',
 *   'container-xsmall': 'max-w-2xl mx-auto px-4',
 *   gap: 'gap-6',
 *   'gap-small': 'gap-4',
 *   'gap-large': 'gap-8',
 *   padding: 'p-6',
 *   'padding-small': 'p-4',
 *   'padding-large': 'p-8',
 *   margin: 'm-6',
 *   'margin-small': 'm-4',
 *   'margin-large': 'm-8'
 * }
 * ```
 *
 * @see specs/app/theme/spacing/spacing.schema.json
 */
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
