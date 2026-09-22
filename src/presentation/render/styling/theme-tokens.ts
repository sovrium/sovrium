/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Design } from '@/domain/models/app/design'

/**
 * Substitutes design tokens in a value
 *
 * Replaces `$design.category.key` patterns with actual design values.
 * Supports multiple tokens in a single string.
 *
 * @param value - Value that may contain design tokens
 * @param design - Design configuration
 * @returns Value with design tokens replaced
 *
 * @example
 * ```typescript
 * const design = {
 *   colors: { primary: '#007bff' },
 *   spacing: { section: 'py-16', container: 'px-4' }
 * }
 * substituteThemeTokens('$design.colors.primary', design)
 * // '#007bff'
 *
 * substituteThemeTokens('$design.spacing.section $design.spacing.container', design)
 * // 'py-16 px-4'
 *
 * substituteThemeTokens('static', design)
 * // 'static'
 *
 * substituteThemeTokens(123, design)
 * // 123
 * ```
 */
export function substituteThemeTokens(value: unknown, design?: Design): unknown {
  if (typeof value !== 'string') {
    return value
  }

  if (!design || !value.includes('$design.')) {
    return value
  }

  // Handle multiple design tokens in a single string
  // Example: "$design.spacing.section $design.spacing.container" → "py-16 px-4"
  // Supports color names with numbers like gray-100, primary-500, etc.
  return value.replace(/\$design\.[a-z]+(\.[a-z0-9-]+)+/g, (match) => {
    // Extract the path: $design.colors.primary → ['colors', 'primary']
    const path = match.slice(7).split('.')

    // Navigate through the design object using functional reduce
    const result = path.reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) {
        return (acc as Record<string, unknown>)[key]
      }
      // Return a sentinel to indicate path not found
      return undefined
    }, design as unknown)

    // If path navigation failed, return original token
    return result !== undefined ? String(result) : match
  })
}

/**
 * Resolve shorthand design token reference
 *
 * Handles tokens in format: $category.key (e.g., $easing.smooth, $colors.primary)
 * without the `design.` prefix.
 *
 * @param category - Design category (colors, easing, spacing, etc.)
 * @param tokenName - Token key within category
 * @param design - Design configuration
 * @returns Resolved token value or original token string if not found
 */
/**
 * The `$<category>.<name>` categories that resolve to a MEMBER of
 * `design.motion` rather than to a top-level design key.
 *
 * Both the singular and plural spellings are accepted because authors write
 * `$easing.smooth` far more often than `$easings.smooth`, and refusing the
 * natural one would only teach them that the syntax is unreliable.
 *
 * The three used to be reserved keys INSIDE the animation map, and this
 * function used to dig them out of `animations.easing`. They are siblings of
 * `animations` now, so that path resolves nothing at all — a token would have
 * silently rendered as its own literal.
 */
const MOTION_CATEGORY_MEMBERS: Readonly<Record<string, 'durations' | 'easings' | 'keyframes'>> = {
  duration: 'durations',
  durations: 'durations',
  easing: 'easings',
  easings: 'easings',
  keyframes: 'keyframes',
}

function resolveShorthandToken(category: string, tokenName: string, design?: Design): string {
  // An unresolvable token renders as the text the author wrote, so a typo shows
  // up in the output instead of collapsing to an empty string.
  const literal = `$${category}.${tokenName}`
  if (design === undefined) return literal

  const motionMember = MOTION_CATEGORY_MEMBERS[category]
  const table: unknown =
    motionMember === undefined ? design[category as keyof Design] : design.motion?.[motionMember]
  if (table === null || typeof table !== 'object') return literal

  const value = (table as Record<string, unknown>)[tokenName]
  return value === undefined ? literal : String(value)
}

/**
 * Resolve shorthand design tokens in string
 *
 * Replaces tokens in format: $category.key (e.g., $easing.smooth, $colors.primary)
 * Supports multiple tokens in a single string.
 *
 * @param value - String that may contain shorthand design tokens
 * @param design - Design configuration
 * @returns String with shorthand tokens replaced
 *
 * @example
 * ```typescript
 * const design = {
 *   colors: { primary: '#007bff' },
 *   motion: { easings: { smooth: 'cubic-bezier(0.4, 0, 0.2, 1)' } }
 * }
 * resolveShorthandThemeTokens('colorPulse 2s $easing.smooth infinite', design)
 * // 'colorPulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite'
 * ```
 */
function resolveShorthandThemeTokens(value: unknown, design?: Design): unknown {
  if (typeof value !== 'string') {
    return value
  }

  if (!design || !value.includes('$')) {
    return value
  }

  // Replace shorthand tokens: $category.key (without design. prefix)
  return value.replace(/\$(\w+)\.(\w+)/g, (_match, category, tokenName) =>
    resolveShorthandToken(category, tokenName, design)
  )
}

/**
 * Substitutes design tokens in props recursively
 *
 * Walks through props object and replaces all design token strings with actual design values.
 * Handles nested objects (e.g., style props) recursively.
 * Supports both full syntax ($design.colors.primary) and shorthand ($colors.primary, $easing.smooth).
 *
 * @param props - Component props that may contain design tokens
 * @param design - Design configuration
 * @returns Props with design tokens replaced
 *
 * @example
 * ```typescript
 * const design = { colors: { primary: '#007bff', secondary: '#6c757d' } }
 * const props = {
 *   color: '$design.colors.primary',
 *   style: { backgroundColor: '$design.colors.secondary' }
 * }
 * substitutePropsThemeTokens(props, design)
 * // {
 * //   color: '#007bff',
 * //   style: { backgroundColor: '#6c757d' }
 * // }
 * ```
 */
export function substitutePropsThemeTokens(
  props: Record<string, unknown> | undefined,
  design?: Design
): Record<string, unknown> | undefined {
  if (!props || !design) {
    return props
  }

  // Use functional Object.entries + reduce for immutable transformation
  return Object.entries(props).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      // Apply both full syntax and shorthand token resolution
      const fullSyntaxResolved = substituteThemeTokens(value, design)
      const shorthandResolved = resolveShorthandThemeTokens(fullSyntaxResolved, design)
      return { ...acc, [key]: shorthandResolved }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively handle nested objects (like style props)
      return { ...acc, [key]: substitutePropsThemeTokens(value as Record<string, unknown>, design) }
    } else {
      return { ...acc, [key]: value }
    }
  }, {})
}
