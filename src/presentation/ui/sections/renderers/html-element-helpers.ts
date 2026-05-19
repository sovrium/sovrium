/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export function buildAccessibilityRole(
  type: string,
  hasChildren: boolean,
  hasContent: boolean,
  existingRole: unknown
): Record<string, unknown> {
  if (type === 'section') {
    return { role: 'region' }
  }
  if (type === 'div' && hasChildren && !hasContent && !existingRole) {
    return { role: 'group' }
  }
  return {}
}

export function buildScrollAttributes(interactions: unknown): Record<string, unknown> {
  const scrollInteractions = interactions as
    | {
        scroll?: {
          animation?: string
          threshold?: number
          delay?: string
          duration?: string
          once?: boolean
        }
      }
    | undefined

  const { scroll } = scrollInteractions ?? {}
  if (!scroll) return {}

  return {
    'data-scroll-animation': scroll.animation,
    ...(scroll.threshold !== undefined && { 'data-scroll-threshold': scroll.threshold }),
    ...(scroll.delay && { 'data-scroll-delay': scroll.delay }),
    ...(scroll.duration && { 'data-scroll-duration': scroll.duration }),
    ...(scroll.once === true && { 'data-scroll-once': scroll.once }),
  }
}

export function getAnimationConfig(theme: { animations?: unknown } | undefined) {
  const animations = theme?.animations as { fadeIn?: unknown } | undefined
  const fadeInConfig = animations?.fadeIn
  return fadeInConfig && typeof fadeInConfig === 'object' && !Array.isArray(fadeInConfig)
    ? (fadeInConfig as Record<string, unknown>)
    : undefined
}

export function calculateStaggerDelay(duration: string): number {
  const durationMs = parseInt(duration.replace('ms', ''), 10)
  return Math.max(50, durationMs / 4)
}

export function buildAlertVariantStyles(
  variant: string | undefined,
  theme: { colors?: Record<string, unknown> } | undefined
): Record<string, unknown> {
  if (!variant || !theme?.colors) {
    return {}
  }

  const colorKey = variant as keyof typeof theme.colors
  const lightColorKey = `${variant}-light` as keyof typeof theme.colors
  const color = theme.colors[colorKey] as string | undefined
  const lightColor = theme.colors[lightColorKey] as string | undefined

  return {
    ...(color && { color, borderColor: color }),
    ...(lightColor && { backgroundColor: lightColor }),
  }
}
