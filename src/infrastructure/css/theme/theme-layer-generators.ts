/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Theme } from '@/domain/models/app/theme'

export interface ThemeFontFlags {
  readonly hasTitleFont: boolean
  readonly hasBodyFont: boolean
}

export interface TitleFontConfig {
  readonly style?: string
  readonly transform?: string
  readonly letterSpacing?: string
}

export function extractThemeFontFlags(theme?: Theme): ThemeFontFlags {
  return {
    hasTitleFont: Boolean(theme?.fonts?.title),
    hasBodyFont: Boolean(theme?.fonts?.body),
  }
}

export function extractTitleFontProperties(theme?: Theme): TitleFontConfig | undefined {
  if (!theme?.fonts?.title || typeof theme.fonts.title !== 'object') {
    return undefined
  }

  return theme.fonts.title as TitleFontConfig
}

export function buildBodyClasses(hasBodyFont: boolean): readonly string[] {
  const fontClass = hasBodyFont ? 'font-body' : 'font-sans'
  return [fontClass, 'antialiased', 'text-fg']
}

export function buildHeadingClasses(hasTitleFont: boolean): readonly string[] {
  const fontClass = hasTitleFont ? 'font-title' : 'font-sans'
  return [fontClass, 'font-semibold', 'tracking-tight', 'text-fg']
}

export function buildLinkClasses(): readonly string[] {
  return ['transition-colors', 'text-primary', 'hover:text-primary-hover']
}

export function buildHeadingStyleProperties(titleFont?: TitleFontConfig): readonly string[] {
  if (!titleFont) return []

  const styleProperty =
    titleFont.style && titleFont.style !== 'normal'
      ? `font-style: var(--font-title-style);`
      : undefined

  const transformProperty =
    titleFont.transform && titleFont.transform !== 'none'
      ? `text-transform: var(--font-title-transform);`
      : undefined

  const letterSpacingProperty = titleFont.letterSpacing
    ? `letter-spacing: var(--font-title-letter-spacing);`
    : undefined

  return [styleProperty, transformProperty, letterSpacingProperty].filter(
    (prop): prop is string => prop !== undefined
  )
}

export function generateHeadingStyles(
  headingClasses: readonly string[],
  styleProps: readonly string[]
): string {
  const baseStyles = `@apply ${headingClasses.join(' ')};`
  if (styleProps.length === 0) return baseStyles

  return `${baseStyles}
        ${styleProps.join('\n        ')}`
}

export function generateBaseLayer(theme?: Theme): string {
  const fontFlags = extractThemeFontFlags(theme)

  const bodyClasses = buildBodyClasses(fontFlags.hasBodyFont)
  const headingClasses = buildHeadingClasses(fontFlags.hasTitleFont)
  const linkClasses = buildLinkClasses()

  const titleFont = extractTitleFontProperties(theme)
  const headingStyleProps = buildHeadingStyleProperties(titleFont)
  const headingStyles = generateHeadingStyles(headingClasses, headingStyleProps)

  return `@layer base {
      body {
        @apply ${bodyClasses.join(' ')};
      }

      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        ${headingStyles}
      }

      a {
        @apply ${linkClasses.join(' ')};
      }
    }`
}
