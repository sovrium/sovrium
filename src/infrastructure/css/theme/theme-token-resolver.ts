/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Theme } from '@/domain/models/app/theme'

/**
 * Resolve color token reference
 *
 * @param tokenName - Name of the color token (e.g., 'primary', 'text')
 * @param theme - Optional theme configuration
 * @returns Resolved color value or undefined if token not found
 *
 * @example
 * resolveColorToken('primary', theme) // => '#ff5733'
 * resolveColorToken('unknown', theme) // => undefined
 */
export function resolveColorToken(tokenName: string, theme?: Theme): string | undefined {
  if (!theme?.colors || !(tokenName in theme.colors)) return undefined
  const colorValue = theme.colors[tokenName]
  return colorValue ? String(colorValue) : undefined
}

/**
 * Resolve easing token reference
 *
 * @param tokenName - Name of the easing token (e.g., 'smooth', 'bounce')
 * @param theme - Optional theme configuration
 * @returns Resolved easing value or undefined if token not found
 *
 * @example
 * resolveEasingToken('smooth', theme) // => 'cubic-bezier(0.4, 0, 0.2, 1)'
 * resolveEasingToken('unknown', theme) // => undefined
 */
export function resolveEasingToken(tokenName: string, theme?: Theme): string | undefined {
  if (!theme?.animations) return undefined
  const animations = theme.animations as Record<string, unknown>
  const easingTokens = animations.easing as Record<string, unknown> | undefined
  if (!easingTokens || typeof easingTokens !== 'object' || !(tokenName in easingTokens))
    return undefined
  const easingValue = easingTokens[tokenName]
  return easingValue ? String(easingValue) : undefined
}

/**
 * Resolve token references in a value
 * Supports: $colors.primary, $easing.smooth, etc.
 *
 * @param value - Value to resolve (can be string with token reference or any other type)
 * @param theme - Optional theme configuration
 * @returns Resolved value as string
 *
 * @example
 * resolveTokenReference('$colors.primary', theme) // => '#ff5733'
 * resolveTokenReference('$easing.smooth', theme) // => 'cubic-bezier(0.4, 0, 0.2, 1)'
 * resolveTokenReference('plain-value', theme) // => 'plain-value'
 * resolveTokenReference(42, theme) // => '42'
 */
export function resolveTokenReference(value: unknown, theme?: Theme): string {
  if (typeof value !== 'string') return String(value)

  const tokenMatch = value.match(/^\$(\w+)\.(\w+)$/)
  if (!tokenMatch) return value

  const [, category, tokenName] = tokenMatch
  if (!category || !tokenName) return value

  return (
    (category === 'colors' ? resolveColorToken(tokenName, theme) : undefined) ??
    (category === 'easing' ? resolveEasingToken(tokenName, theme) : undefined) ??
    value
  )
}
