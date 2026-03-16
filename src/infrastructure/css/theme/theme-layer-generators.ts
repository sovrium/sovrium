/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Theme } from '@/domain/models/app/theme'

/**
 * Theme color flags extracted from theme configuration
 */
export interface ThemeColorFlags {
  readonly hasTextColor: boolean
  readonly hasPrimaryColor: boolean
  readonly hasPrimaryHoverColor: boolean
}

/**
 * Theme font flags extracted from theme configuration
 */
export interface ThemeFontFlags {
  readonly hasTitleFont: boolean
  readonly hasBodyFont: boolean
}

/**
 * Title font configuration type
 */
export interface TitleFontConfig {
  readonly style?: string
  readonly transform?: string
  readonly letterSpacing?: string
}

/**
 * Extract color availability flags from theme
 * Returns flags indicating which colors are defined in the theme
 *
 * @param theme - Optional theme configuration
 * @returns Object with color availability flags
 */
export function extractThemeColorFlags(theme?: Theme): ThemeColorFlags {
  return {
    hasTextColor: Boolean(theme?.colors?.text),
    hasPrimaryColor: Boolean(theme?.colors?.primary),
    hasPrimaryHoverColor: Boolean(theme?.colors?.['primary-hover']),
  }
}

/**
 * Extract font availability flags from theme
 * Returns flags indicating which fonts are defined in the theme
 *
 * @param theme - Optional theme configuration
 * @returns Object with font availability flags
 */
export function extractThemeFontFlags(theme?: Theme): ThemeFontFlags {
  return {
    hasTitleFont: Boolean(theme?.fonts?.title),
    hasBodyFont: Boolean(theme?.fonts?.body),
  }
}

/**
 * Extract title font properties from theme fonts config
 * Returns undefined if no title font is configured
 *
 * @param theme - Optional theme configuration
 * @returns Title font configuration or undefined
 */
export function extractTitleFontProperties(theme?: Theme): TitleFontConfig | undefined {
  if (!theme?.fonts?.title || typeof theme.fonts.title !== 'object') {
    return undefined
  }

  return theme.fonts.title as TitleFontConfig
}

/**
 * Build body classes with optional text color and font
 *
 * @param hasTextColor - Whether theme defines text color
 * @param hasBodyFont - Whether theme defines body font
 * @returns Array of CSS class names for body element
 */
export function buildBodyClasses(hasTextColor: boolean, hasBodyFont: boolean): readonly string[] {
  const fontClass = hasBodyFont ? 'font-body' : 'font-sans'
  return hasTextColor ? [fontClass, 'antialiased', 'text-text'] : [fontClass, 'antialiased']
}

/**
 * Build heading classes with optional text color and font
 *
 * @param hasTextColor - Whether theme defines text color
 * @param hasTitleFont - Whether theme defines title font
 * @returns Array of CSS class names for heading elements
 */
export function buildHeadingClasses(
  hasTextColor: boolean,
  hasTitleFont: boolean
): readonly string[] {
  const fontClass = hasTitleFont ? 'font-title' : 'font-sans'
  const baseClasses = hasTextColor
    ? [fontClass, 'font-semibold', 'tracking-tight', 'text-text']
    : [fontClass, 'font-semibold', 'tracking-tight']
  return baseClasses
}

/**
 * Build link classes with optional primary colors
 *
 * @param hasPrimaryColor - Whether theme defines primary color
 * @param hasPrimaryHoverColor - Whether theme defines primary hover color
 * @returns Array of CSS class names for link elements
 */
export function buildLinkClasses(
  hasPrimaryColor: boolean,
  hasPrimaryHoverColor: boolean
): readonly string[] {
  if (hasPrimaryColor && hasPrimaryHoverColor) {
    return ['transition-colors', 'text-primary', 'hover:text-primary-hover']
  }
  if (hasPrimaryColor) {
    return ['transition-colors', 'text-primary']
  }
  return ['transition-colors', 'text-blue-600', 'hover:text-blue-700']
}

/**
 * Build CSS property strings for heading styles
 * Returns array of CSS properties based on title font configuration
 *
 * @param titleFont - Optional title font configuration
 * @returns Array of CSS property strings
 */
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

/**
 * Generate heading CSS with base classes and optional style properties
 * Combines heading classes with additional CSS properties
 *
 * @param headingClasses - Array of CSS class names
 * @param styleProps - Array of CSS property strings
 * @returns Complete CSS rule for headings
 */
export function generateHeadingStyles(
  headingClasses: readonly string[],
  styleProps: readonly string[]
): string {
  const baseStyles = `@apply ${headingClasses.join(' ')};`
  if (styleProps.length === 0) return baseStyles

  return `${baseStyles}
        ${styleProps.join('\n        ')}`
}

/**
 * Generate base layer styles with theme color and font applications
 * Applies theme colors and fonts to base HTML elements if theme defines those tokens
 *
 * @param theme - Optional theme configuration
 * @returns CSS @layer base rule as string
 *
 * @example
 * generateBaseLayer(theme)
 * // => '@layer base { body { ... } h1, h2, ... { ... } a { ... } }'
 */
export function generateBaseLayer(theme?: Theme): string {
  const colorFlags = extractThemeColorFlags(theme)
  const fontFlags = extractThemeFontFlags(theme)

  const bodyClasses = buildBodyClasses(colorFlags.hasTextColor, fontFlags.hasBodyFont)
  const headingClasses = buildHeadingClasses(colorFlags.hasTextColor, fontFlags.hasTitleFont)
  const linkClasses = buildLinkClasses(colorFlags.hasPrimaryColor, colorFlags.hasPrimaryHoverColor)

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
