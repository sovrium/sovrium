/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Theme } from '@/domain/models/app/theme'

/**
 * Substitutes theme tokens in a value
 *
 * Replaces `$theme.category.key` patterns with actual theme values.
 * Supports multiple tokens in a single string.
 *
 * @param value - Value that may contain theme tokens
 * @param theme - Theme configuration
 * @returns Value with theme tokens replaced
 *
 * @example
 * ```typescript
 * const theme = {
 *   colors: { primary: '#007bff' },
 *   spacing: { section: 'py-16', container: 'px-4' }
 * }
 * substituteThemeTokens('$theme.colors.primary', theme)
 * // '#007bff'
 *
 * substituteThemeTokens('$theme.spacing.section $theme.spacing.container', theme)
 * // 'py-16 px-4'
 *
 * substituteThemeTokens('static', theme)
 * // 'static'
 *
 * substituteThemeTokens(123, theme)
 * // 123
 * ```
 */
export function substituteThemeTokens(value: unknown, theme?: Theme): unknown {
  if (typeof value !== 'string') {
    return value
  }

  if (!theme || !value.includes('$theme.')) {
    return value
  }

  // Handle multiple theme tokens in a single string
  // Example: "$theme.spacing.section $theme.spacing.container" → "py-16 px-4"
  // Supports color names with numbers like gray-100, primary-500, etc.
  return value.replace(/\$theme\.[a-z]+(\.[a-z0-9-]+)+/g, (match) => {
    // Extract the path: $theme.colors.primary → ['colors', 'primary']
    const path = match.slice(7).split('.')

    // Navigate through the theme object using functional reduce
    const result = path.reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) {
        return (acc as Record<string, unknown>)[key]
      }
      // Return a sentinel to indicate path not found
      return undefined
    }, theme as unknown)

    // If path navigation failed, return original token
    return result !== undefined ? String(result) : match
  })
}

/**
 * Resolve shorthand theme token reference
 *
 * Handles tokens in format: $category.key (e.g., $easing.smooth, $colors.primary)
 * without the `theme.` prefix.
 *
 * @param category - Theme category (colors, easing, spacing, etc.)
 * @param tokenName - Token key within category
 * @param theme - Theme configuration
 * @returns Resolved token value or original token string if not found
 */
function resolveShorthandToken(category: string, tokenName: string, theme?: Theme): string {
  if (!theme) return `$${category}.${tokenName}`

  const themeCategory = theme[category as keyof Theme]
  if (!themeCategory || typeof themeCategory !== 'object') {
    return `$${category}.${tokenName}`
  }

  // Handle nested animations category (easing, duration, keyframes)
  if (category === 'easing' && theme.animations) {
    const animations = theme.animations as Record<string, unknown>
    const easingTokens = animations.easing as Record<string, unknown> | undefined
    if (easingTokens && typeof easingTokens === 'object') {
      const value = easingTokens[tokenName]
      return value !== undefined ? String(value) : `$${category}.${tokenName}`
    }
  }

  const value = (themeCategory as Record<string, unknown>)[tokenName]
  return value !== undefined ? String(value) : `$${category}.${tokenName}`
}

/**
 * Resolve shorthand theme tokens in string
 *
 * Replaces tokens in format: $category.key (e.g., $easing.smooth, $colors.primary)
 * Supports multiple tokens in a single string.
 *
 * @param value - String that may contain shorthand theme tokens
 * @param theme - Theme configuration
 * @returns String with shorthand tokens replaced
 *
 * @example
 * ```typescript
 * const theme = {
 *   colors: { primary: '#007bff' },
 *   animations: { easing: { smooth: 'cubic-bezier(0.4, 0, 0.2, 1)' } }
 * }
 * resolveShorthandThemeTokens('colorPulse 2s $easing.smooth infinite', theme)
 * // 'colorPulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite'
 * ```
 */
function resolveShorthandThemeTokens(value: unknown, theme?: Theme): unknown {
  if (typeof value !== 'string') {
    return value
  }

  if (!theme || !value.includes('$')) {
    return value
  }

  // Replace shorthand tokens: $category.key (without theme. prefix)
  return value.replace(/\$(\w+)\.(\w+)/g, (_match, category, tokenName) =>
    resolveShorthandToken(category, tokenName, theme)
  )
}

/**
 * Substitutes theme tokens in props recursively
 *
 * Walks through props object and replaces all theme token strings with actual theme values.
 * Handles nested objects (e.g., style props) recursively.
 * Supports both full syntax ($theme.colors.primary) and shorthand ($colors.primary, $easing.smooth).
 *
 * @param props - Component props that may contain theme tokens
 * @param theme - Theme configuration
 * @returns Props with theme tokens replaced
 *
 * @example
 * ```typescript
 * const theme = { colors: { primary: '#007bff', secondary: '#6c757d' } }
 * const props = {
 *   color: '$theme.colors.primary',
 *   style: { backgroundColor: '$theme.colors.secondary' }
 * }
 * substitutePropsThemeTokens(props, theme)
 * // {
 * //   color: '#007bff',
 * //   style: { backgroundColor: '#6c757d' }
 * // }
 * ```
 */
export function substitutePropsThemeTokens(
  props: Record<string, unknown> | undefined,
  theme?: Theme
): Record<string, unknown> | undefined {
  if (!props || !theme) {
    return props
  }

  // Use functional Object.entries + reduce for immutable transformation
  return Object.entries(props).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      // Apply both full syntax and shorthand token resolution
      const fullSyntaxResolved = substituteThemeTokens(value, theme)
      const shorthandResolved = resolveShorthandThemeTokens(fullSyntaxResolved, theme)
      return { ...acc, [key]: shorthandResolved }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively handle nested objects (like style props)
      return { ...acc, [key]: substitutePropsThemeTokens(value as Record<string, unknown>, theme) }
    } else {
      return { ...acc, [key]: value }
    }
  }, {})
}
