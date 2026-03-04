/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AnimationsConfigSchema } from './theme/animations'
import { BorderRadiusConfigSchema } from './theme/border-radius'
import { BreakpointsConfigSchema } from './theme/breakpoints'
import { ColorsConfigSchema } from './theme/colors'
import { FontsConfigSchema } from './theme/fonts'
import { ShadowsConfigSchema } from './theme/shadows'
import { SpacingConfigSchema } from './theme/spacing'

/**
 * Theme configuration orchestrating all design token categories
 *
 * Provides a unified design system by composing:
 * - colors: Visual identity and branding
 * - fonts: Typography system
 * - spacing: Layout rhythm and whitespace
 * - animations: Motion design library
 * - breakpoints: Responsive system thresholds
 * - shadows: Elevation and depth
 * - borderRadius: Corner styling
 *
 * All properties are optional, allowing minimal themes (colors-only)
 * or comprehensive design systems (all 7 categories).
 *
 * @example
 * ```typescript
 * const minimalTheme = {
 *   colors: { primary: '#007bff' }
 * }
 *
 * const completeTheme = {
 *   colors: { primary: '#007bff' },
 *   fonts: { body: { family: 'Inter' } },
 *   spacing: { section: '4rem' },
 *   animations: { fadeIn: true },
 *   breakpoints: { md: '768px' },
 *   shadows: { md: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
 *   borderRadius: { md: '0.375rem' }
 * }
 * ```
 *
 * @see specs/app/theme/theme.schema.json
 */
export const ThemeSchema = Schema.Struct({
  colors: Schema.optional(ColorsConfigSchema),
  fonts: Schema.optional(FontsConfigSchema),
  spacing: Schema.optional(SpacingConfigSchema),
  animations: Schema.optional(AnimationsConfigSchema),
  breakpoints: Schema.optional(BreakpointsConfigSchema),
  shadows: Schema.optional(ShadowsConfigSchema),
  borderRadius: Schema.optional(BorderRadiusConfigSchema),
}).pipe(
  Schema.annotations({
    identifier: 'Theme',
    title: 'Theme Configuration',
    description: 'Design tokens for colors, typography, spacing, and animations',
  })
)

export type Theme = Schema.Schema.Type<typeof ThemeSchema>
