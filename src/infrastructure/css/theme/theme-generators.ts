/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { BorderRadiusConfig } from '@/domain/models/app/theme/border-radius'
import type { BreakpointsConfig } from '@/domain/models/app/theme/breakpoints'
import type { ColorsConfig } from '@/domain/models/app/theme/colors'
import type { FontsConfig } from '@/domain/models/app/theme/fonts'
import type { ShadowsConfig } from '@/domain/models/app/theme/shadows'
import type { SpacingConfig } from '@/domain/models/app/theme/spacing'

/**
 * Generate Tailwind @theme colors from domain color config
 * Uses hex format directly - Tailwind v4 handles color format conversion
 */
export function generateThemeColors(colors?: ColorsConfig): string {
  if (!colors || Object.keys(colors).length === 0) return ''

  const colorEntries = Object.entries(colors).map(([name, value]) => {
    return `    --color-${name}: ${value};`
  })

  return colorEntries.join('\n')
}

/**
 * Generate Tailwind @theme font families from domain font config
 */
export function generateThemeFonts(fonts?: FontsConfig): string {
  if (!fonts || Object.keys(fonts).length === 0) return ''

  const fontEntries = Object.entries(fonts).flatMap(([category, config]) => {
    // Type assertion needed because Record values are unknown in TypeScript
    const fontConfig = config as {
      family: string
      fallback?: string
      style?: string
      transform?: string
      letterSpacing?: string
    }
    const fontStack = fontConfig.fallback
      ? `${fontConfig.family}, ${fontConfig.fallback}`
      : fontConfig.family

    const baseEntry = `    --font-${category}: ${fontStack};`

    // Build entries array immutably
    const styleEntry =
      fontConfig.style && fontConfig.style !== 'normal'
        ? `    --font-${category}-style: ${fontConfig.style};`
        : undefined

    const transformEntry =
      fontConfig.transform && fontConfig.transform !== 'none'
        ? `    --font-${category}-transform: ${fontConfig.transform};`
        : undefined

    const letterSpacingEntry = fontConfig.letterSpacing
      ? `    --font-${category}-letter-spacing: ${fontConfig.letterSpacing};`
      : undefined

    return [baseEntry, styleEntry, transformEntry, letterSpacingEntry].filter(
      (entry): entry is string => entry !== undefined
    )
  })

  return fontEntries.join('\n')
}

/**
 * Generate Tailwind @theme spacing from domain spacing config
 * Only includes raw CSS values (rem, px, em), not Tailwind classes
 */
export function generateThemeSpacing(spacing?: SpacingConfig): string {
  if (!spacing || Object.keys(spacing).length === 0) return ''

  const spacingEntries = Object.entries(spacing)
    .filter(([_, value]) => {
      // Only include raw CSS values (not Tailwind classes)
      return /^[0-9.]+(?:rem|px|em|%)$/.test(value as string)
    })
    .map(([name, value]) => `    --spacing-${name}: ${value};`)

  return spacingEntries.join('\n')
}

/**
 * Generate Tailwind @theme shadows from domain shadow config
 */
export function generateThemeShadows(shadows?: ShadowsConfig): string {
  if (!shadows || Object.keys(shadows).length === 0) return ''

  const shadowEntries = Object.entries(shadows).map(([name, value]) => {
    // Preserve original shadow values as-is
    // The .shadow-none utility class override handles the actual rendering
    return `    --shadow-${name}: ${value};`
  })

  return shadowEntries.join('\n')
}

/**
 * Generate Tailwind @theme border radius from domain border radius config
 */
export function generateThemeBorderRadius(borderRadius?: BorderRadiusConfig): string {
  if (!borderRadius || Object.keys(borderRadius).length === 0) return ''

  const radiusEntries = Object.entries(borderRadius).map(([name, value]) => {
    const key = name === 'DEFAULT' ? 'radius' : `radius-${name}`
    return `    --${key}: ${value};`
  })

  return radiusEntries.join('\n')
}

/**
 * Generate Tailwind @theme breakpoints from domain breakpoints config
 */
export function generateThemeBreakpoints(breakpoints?: BreakpointsConfig): string {
  if (!breakpoints || Object.keys(breakpoints).length === 0) return ''

  const breakpointEntries = Object.entries(breakpoints).map(
    ([name, value]) => `    --breakpoint-${name}: ${value};`
  )

  return breakpointEntries.join('\n')
}
