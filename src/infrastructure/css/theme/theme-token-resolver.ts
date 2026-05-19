/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Theme } from '@/domain/models/app/theme'

export function resolveColorToken(tokenName: string, theme?: Theme): string | undefined {
  if (!theme?.colors || !(tokenName in theme.colors)) return undefined
  const colorValue = theme.colors[tokenName]
  return colorValue ? String(colorValue) : undefined
}

export function resolveEasingToken(tokenName: string, theme?: Theme): string | undefined {
  if (!theme?.animations) return undefined
  const animations = theme.animations as Record<string, unknown>
  const easingTokens = animations.easing as Record<string, unknown> | undefined
  if (!easingTokens || typeof easingTokens !== 'object' || !(tokenName in easingTokens))
    return undefined
  const easingValue = easingTokens[tokenName]
  return easingValue ? String(easingValue) : undefined
}

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
