/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AnimationsConfigSchema } from './animations'
import { BorderRadiusConfigSchema } from './border-radius'
import { BreakpointsConfigSchema } from './breakpoints'
import { CodeBlockConfigSchema } from './code-block'
import { ColorsConfigSchema } from './colors'
import { FontsConfigSchema } from './fonts'
import { ShadowsConfigSchema } from './shadows'
import { SpacingConfigSchema } from './spacing'

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
 */
export const ThemeSchema = Schema.Struct({
  /**
   * Whether prebuilt components extend Sovrium's default design system look
   * (the `V1_TOKEN_LAYER` in `src/infrastructure/css/theme/default-theme-layer.ts`)
   * or replace it with a neutral, unstyled floor. Defaults to `'extend'`.
   */
  baseline: Schema.optional(
    Schema.Literal('extend', 'replace').annotations({
      title: 'Theme Baseline',
      description:
        "Extend Sovrium's v1 default look ('extend', default) or replace it with a neutral floor ('replace').",
    })
  ),

  /**
   * Default color scheme applied before content renders (no-FOUC).
   *
   * - `'light'` — force the light scheme as the default.
   * - `'dark'` — force the dark scheme as the default (the `.dark` class is
   *   set on `<html>` ahead of the stylesheet).
   * - `'system'` — follow the visitor's `prefers-color-scheme` (default when a
   *   `theme-toggle` is present and no value is configured).
   *
   * A stored visitor preference (`localStorage.theme`) always overrides this
   * default once the no-FOUC head script runs.
   */
  colorScheme: Schema.optional(
    Schema.Literal('light', 'dark', 'system').annotations({
      title: 'Default Color Scheme',
      description:
        "Default color scheme before content renders: 'light', 'dark', or 'system' (follow prefers-color-scheme).",
    })
  ),

  colors: Schema.optional(ColorsConfigSchema),

  /** Dark mode color overrides (mirrors colors structure) */
  darkColors: Schema.optional(ColorsConfigSchema),

  fonts: Schema.optional(FontsConfigSchema),
  spacing: Schema.optional(SpacingConfigSchema),
  animations: Schema.optional(AnimationsConfigSchema),
  breakpoints: Schema.optional(BreakpointsConfigSchema),
  shadows: Schema.optional(ShadowsConfigSchema),
  borderRadius: Schema.optional(BorderRadiusConfigSchema),

  /** Syntax-highlighting theme for markdown fenced code blocks */
  codeBlock: Schema.optional(CodeBlockConfigSchema),
}).pipe(
  Schema.annotations({
    identifier: 'Theme',
    title: 'Theme Configuration',
    description: 'Design tokens for colors, typography, spacing, and animations',
  })
)

export type Theme = Schema.Schema.Type<typeof ThemeSchema>

// Re-export all theme sub-schemas for convenient imports
export * from './animations'
export * from './border-radius'
export * from './breakpoints'
export * from './code-block'
export * from './colors'
export * from './fonts'
export * from './shadows'
export * from './spacing'
