/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Design } from '@/domain/models/app/design'

/**
 * Resolve color token reference
 *
 * @param tokenName - Name of the color token (e.g., 'primary', 'text')
 * @param design - Optional design configuration
 * @returns Resolved color value or undefined if token not found
 *
 * @example
 * resolveColorToken('primary', design) // => '#ff5733'
 * resolveColorToken('unknown', design) // => undefined
 */
export function resolveColorToken(tokenName: string, design?: Design): string | undefined {
  if (!design?.colors || !(tokenName in design.colors)) return undefined
  const colorValue = design.colors[tokenName]
  return colorValue ? String(colorValue) : undefined
}

/**
 * Resolve an easing token reference against `design.motion.easings`.
 *
 * It used to read `theme.animations.easing` — a reserved key inside the flat
 * animation record, told apart from a real animation only by the shape of its
 * value. `motion` gives the ladder its own member, so this is now a plain
 * lookup rather than a discrimination.
 *
 * @param tokenName - Name of the easing token (e.g., 'smooth', 'bounce')
 * @param design - Optional design configuration
 * @returns Resolved easing value or undefined if token not found
 *
 * @example
 * resolveEasingToken('smooth', design) // => 'cubic-bezier(0.4, 0, 0.2, 1)'
 * resolveEasingToken('unknown', design) // => undefined
 */
export function resolveEasingToken(tokenName: string, design?: Design): string | undefined {
  const easings = design?.motion?.easings
  // The `typeof` guard is not redundant with the truthiness one: this is
  // reached with a decoded config in production and with a hand-built object in
  // a test, and a non-object `easings` makes `in` THROW rather than miss.
  if (typeof easings !== 'object' || easings === null || !(tokenName in easings)) return undefined
  const easingValue = easings[tokenName]
  return easingValue ? String(easingValue) : undefined
}

/**
 * Resolve token references in a value
 * Supports: $colors.primary, $easing.smooth, etc.
 *
 * @param value - Value to resolve (can be string with token reference or any other type)
 * @param design - Optional design configuration
 * @returns Resolved value as string
 *
 * @example
 * resolveTokenReference('$colors.primary', design) // => '#ff5733'
 * resolveTokenReference('$easing.smooth', design) // => 'cubic-bezier(0.4, 0, 0.2, 1)'
 * resolveTokenReference('plain-value', design) // => 'plain-value'
 * resolveTokenReference(42, design) // => '42'
 */
export function resolveTokenReference(value: unknown, design?: Design): string {
  if (typeof value !== 'string') return String(value)

  const tokenMatch = value.match(/^\$(\w+)\.(\w+)$/)
  if (!tokenMatch) return value

  const [, category, tokenName] = tokenMatch
  if (!category || !tokenName) return value

  return (
    (category === 'colors' ? resolveColorToken(tokenName, design) : undefined) ??
    (category === 'easing' ? resolveEasingToken(tokenName, design) : undefined) ??
    value
  )
}
