/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Theme } from '@/domain/models/app/theme'

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
 * Build body classes — canonical `fg` text token (always present via the
 * default layer); the font class still tracks the author's body-font token.
 *
 * @param hasBodyFont - Whether theme defines body font
 * @returns Array of CSS class names for body element
 */
export function buildBodyClasses(hasBodyFont: boolean): readonly string[] {
  const fontClass = hasBodyFont ? 'font-body' : 'font-sans'
  return [fontClass, 'antialiased', 'text-foreground']
}

/**
 * Build heading classes — canonical `fg` text token (always present); the font
 * class still tracks the author's title-font token.
 *
 * @param hasTitleFont - Whether theme defines title font
 * @returns Array of CSS class names for heading elements
 */
export function buildHeadingClasses(hasTitleFont: boolean): readonly string[] {
  const fontClass = hasTitleFont ? 'font-title' : 'font-sans'
  return [fontClass, 'font-semibold', 'tracking-tight', 'text-foreground']
}

/**
 * Build link classes — canonical `primary` tokens (always present via the
 * default layer; author `theme.colors.primary` recolors them via the bridge).
 *
 * @returns Array of CSS class names for link elements
 */
export function buildLinkClasses(): readonly string[] {
  return ['transition-colors', 'text-primary', 'hover:text-primary-hover']
}

/**
 * Build focus-visible ring classes — canonical `focus-ring` token (always
 * present via the default layer). Applied to keyboard-focused interactive
 * elements (button, anchor, role=button) so accessibility focus indicators
 * are visible by default without per-component opt-in.
 *
 * @returns Array of CSS class names for focus-visible rings
 */
export function buildFocusVisibleClasses(): readonly string[] {
  return ['ring-2', 'ring-focus-ring', 'ring-offset-2', 'outline-none']
}

/**
 * Per-heading-level font size utility classes. Author classNames (utility
 * layer) still win because @layer utilities has higher specificity than
 * @layer base, so a schema author writing `className="text-6xl"` overrides
 * these defaults without `!important` or merge logic.
 *
 * @returns Object keyed by heading element name with size utility class
 */
export function buildHeadingSizeClasses(): Readonly<Record<string, string>> {
  return {
    h1: 'text-4xl',
    h2: 'text-3xl',
    h3: 'text-2xl',
    h4: 'text-xl',
    h5: 'text-lg',
    h6: 'text-base',
  }
}

/**
 * Build paragraph prose defaults — canonical `text-foreground` + comfortable reading
 * line-height. Applied to `<p>` globally via @layer base so author-supplied
 * classes still win via utility-layer specificity.
 *
 * @returns Array of CSS class names for paragraph elements
 */
export function buildParagraphClasses(): readonly string[] {
  return ['text-base', 'text-foreground', 'leading-relaxed']
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
  const fontFlags = extractThemeFontFlags(theme)

  const bodyClasses = buildBodyClasses(fontFlags.hasBodyFont)
  const headingClasses = buildHeadingClasses(fontFlags.hasTitleFont)
  const linkClasses = buildLinkClasses()
  const focusVisibleClasses = buildFocusVisibleClasses()
  const paragraphClasses = buildParagraphClasses()
  const headingSizes = buildHeadingSizeClasses()

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

      h1 { @apply ${headingSizes['h1']}; }
      h2 { @apply ${headingSizes['h2']}; }
      h3 { @apply ${headingSizes['h3']}; }
      h4 { @apply ${headingSizes['h4']}; }
      h5 { @apply ${headingSizes['h5']}; }
      h6 { @apply ${headingSizes['h6']}; }

      p {
        @apply ${paragraphClasses.join(' ')};
      }

      a {
        @apply ${linkClasses.join(' ')};
      }

      button:focus-visible,
      a:focus-visible,
      [role="button"]:focus-visible {
        @apply ${focusVisibleClasses.join(' ')};
      }

      button:not(:disabled),
      [role="button"]:not([aria-disabled="true"]),
      a[href] {
        cursor: pointer;
      }
    }`
}
