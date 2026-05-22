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

export const ThemeSchema = Schema.Struct({
  baseline: Schema.optional(
    Schema.Literal('extend', 'replace').annotations({
      title: 'Theme Baseline',
      description:
        "Extend Sovrium's v1 default look ('extend', default) or replace it with a neutral floor ('replace').",
    })
  ),

  colors: Schema.optional(ColorsConfigSchema),

  darkColors: Schema.optional(ColorsConfigSchema),

  fonts: Schema.optional(FontsConfigSchema),
  spacing: Schema.optional(SpacingConfigSchema),
  animations: Schema.optional(AnimationsConfigSchema),
  breakpoints: Schema.optional(BreakpointsConfigSchema),
  shadows: Schema.optional(ShadowsConfigSchema),
  borderRadius: Schema.optional(BorderRadiusConfigSchema),

  codeBlock: Schema.optional(CodeBlockConfigSchema),
}).pipe(
  Schema.annotations({
    identifier: 'Theme',
    title: 'Theme Configuration',
    description: 'Design tokens for colors, typography, spacing, and animations',
  })
)

export type Theme = Schema.Schema.Type<typeof ThemeSchema>

export * from './animations'
export * from './border-radius'
export * from './breakpoints'
export * from './code-block'
export * from './colors'
export * from './fonts'
export * from './shadows'
export * from './spacing'
