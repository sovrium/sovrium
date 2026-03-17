/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Color name in kebab-case format
 *
 * Supports semantic naming (primary, secondary) and variants:
 * - Base colors: primary, secondary, success, danger
 * - Variants: primary-hover, primary-light, primary-dark
 * - Numbered scales: gray-100, gray-200, ..., gray-900
 *
 * @example
 * ```typescript
 * const base = 'primary'
 * const variant = 'primary-hover'
 * const scale = 'gray-500'
 * ```
 *
 * @see specs/app/theme/colors/colors.schema.json#/patternProperties
 */
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

/**
 * Color value in various CSS formats
 *
 * Supports multiple color formats:
 * - Hex 6-digit: #007bff (standard)
 * - Hex 8-digit: #007bff80 (with alpha channel)
 * - RGB: rgb(255, 0, 0)
 * - RGBA: rgba(255, 0, 0, 0.5)
 * - HSL: hsl(210, 100%, 50%)
 * - HSLA: hsla(210, 100%, 50%, 0.8)
 *
 * @example
 * ```typescript
 * const hex6 = '#007bff'
 * const hex8 = '#007bff80'  // 50% opacity
 * const rgb = 'rgb(0, 123, 255)'
 * const hsl = 'hsl(210, 100%, 50%)'
 * ```
 *
 * @see specs/app/theme/colors/colors.schema.json#/patternProperties/.../pattern
 */
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

/**
 * Color palette (design tokens)
 *
 * Map of semantic color names to CSS color values.
 * Supports comprehensive color systems with:
 * - Semantic colors (primary, secondary, success, danger, warning, info)
 * - Variants (hover states, light/dark tints)
 * - Numbered scales (gray-100 to gray-900)
 * - Multiple formats (hex, rgb, hsl with optional alpha)
 *
 * @example
 * ```typescript
 * const colors = {
 *   primary: '#007bff',
 *   'primary-hover': '#0056b3',
 *   'primary-light': '#e7f1ff',
 *   secondary: '#6c757d',
 *   success: '#28a745',
 *   danger: '#dc3545',
 *   'gray-100': '#f8f9fa',
 *   'gray-500': '#adb5bd',
 *   'gray-900': '#212529',
 * }
 * ```
 *
 * @see specs/app/theme/colors/colors.schema.json
 */
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
