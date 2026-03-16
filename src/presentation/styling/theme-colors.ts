/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Default theme color palette
 *
 * Provides a minimal set of predefined theme colors for quick prototyping.
 * These colors are used when a component references a color by name (e.g., color="orange")
 * but no theme configuration is provided in the schema.
 *
 * NOTE: This is a simplified implementation. In a full theme system, colors should
 * come from the app's theme configuration (src/domain/models/app/theme/colors.ts).
 * Future enhancement: Integrate with theme context to support custom colors.
 *
 * @see src/domain/models/app/theme/colors.ts - For proper theme color configuration
 * @see src/presentation/ui/sections/utils/theme-tokens.ts - For theme token substitution
 */
export const DEFAULT_THEME_COLORS = {
  orange: '#F97316',
  blue: '#3B82F6',
  green: '#10B981',
  red: '#EF4444',
} as const

/**
 * Supported theme color names
 *
 * Type-safe color names that can be used in components.
 */
export type ThemeColorName = keyof typeof DEFAULT_THEME_COLORS

/**
 * Resolves a color name to its hex value
 *
 * @param color - Color name from DEFAULT_THEME_COLORS
 * @returns Hex color value, or undefined if color not found
 *
 * @example
 * ```typescript
 * resolveThemeColor('orange') // '#F97316'
 * resolveThemeColor('invalid') // undefined
 * ```
 */
export function resolveThemeColor(color: string | undefined): string | undefined {
  if (!color) {
    return undefined
  }
  return DEFAULT_THEME_COLORS[color as ThemeColorName]
}
