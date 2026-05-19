/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ColorNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z]+[a-z0-9]*(-[a-z0-9]+)*$/, {
    message: () =>
      'Color name must use kebab-case format: lowercase letters and numbers separated by hyphens (e.g., "primary", "text-muted", "gray-500")',
  }),
  Schema.annotations({
    title: 'Color Name',
    description: 'Color name in kebab-case format',
    examples: ['primary', 'primary-hover', 'gray-500', 'text-muted'],
  })
)

export const ColorValueSchema = Schema.String.pipe(
  Schema.pattern(/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{8}$|^rgb\(|^rgba\(|^hsl\(|^hsla\(/, {
    message: () => 'Color value must be in hex (#RRGGBB or #RRGGBBAA), rgb(a), or hsl(a) format',
  }),
  Schema.annotations({
    title: 'Color Value',
    description: 'Color value in hex, rgb, rgba, hsl, or hsla format',
    examples: ['#007bff', '#007bff80', 'rgb(0, 123, 255)', 'hsl(210, 100%, 50%)'],
  })
)

export const ColorsConfigSchema = Schema.Record({
  key: ColorNameSchema,
  value: ColorValueSchema,
}).pipe(
  Schema.annotations({
    title: 'Color Palette',
    description: 'Color design tokens with support for semantic naming and variants',
  })
)

export type ColorName = Schema.Schema.Type<typeof ColorNameSchema>
export type ColorValue = Schema.Schema.Type<typeof ColorValueSchema>
export type ColorsConfig = Schema.Schema.Type<typeof ColorsConfigSchema>
