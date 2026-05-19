/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Theme } from '@/domain/models/app/theme'

export function substituteThemeTokens(value: unknown, theme?: Theme): unknown {
  if (typeof value !== 'string') {
    return value
  }

  if (!theme || !value.includes('$theme.')) {
    return value
  }

  return value.replace(/\$theme\.[a-z]+(\.[a-z0-9-]+)+/g, (match) => {
    const path = match.slice(7).split('.')

    const result = path.reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) {
        return (acc as Record<string, unknown>)[key]
      }
      return undefined
    }, theme as unknown)

    return result !== undefined ? String(result) : match
  })
}

function resolveShorthandToken(category: string, tokenName: string, theme?: Theme): string {
  if (!theme) return `$${category}.${tokenName}`

  const themeCategory = theme[category as keyof Theme]
  if (!themeCategory || typeof themeCategory !== 'object') {
    return `$${category}.${tokenName}`
  }

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

function resolveShorthandThemeTokens(value: unknown, theme?: Theme): unknown {
  if (typeof value !== 'string') {
    return value
  }

  if (!theme || !value.includes('$')) {
    return value
  }

  return value.replace(/\$(\w+)\.(\w+)/g, (_match, category, tokenName) =>
    resolveShorthandToken(category, tokenName, theme)
  )
}

export function substitutePropsThemeTokens(
  props: Record<string, unknown> | undefined,
  theme?: Theme
): Record<string, unknown> | undefined {
  if (!props || !theme) {
    return props
  }

  return Object.entries(props).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      const fullSyntaxResolved = substituteThemeTokens(value, theme)
      const shorthandResolved = resolveShorthandThemeTokens(fullSyntaxResolved, theme)
      return { ...acc, [key]: shorthandResolved }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ...acc, [key]: substitutePropsThemeTokens(value as Record<string, unknown>, theme) }
    } else {
      return { ...acc, [key]: value }
    }
  }, {})
}
