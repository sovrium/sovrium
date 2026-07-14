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
  return [fontClass, 'antialiased', 'text-foreground']
}

export function buildHeadingClasses(hasTitleFont: boolean): readonly string[] {
  const fontClass = hasTitleFont ? 'font-title' : 'font-sans'
  return [fontClass, 'font-semibold', 'tracking-tight', 'text-foreground']
}

export function buildLinkClasses(): readonly string[] {
  return ['transition-colors', 'text-primary', 'hover:text-primary-hover']
}

export function buildFocusVisibleClasses(): readonly string[] {
  return ['ring-2', 'ring-focus-ring', 'ring-offset-2', 'outline-none']
}

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

export function buildParagraphClasses(): readonly string[] {
  return ['text-base', 'text-foreground', 'leading-relaxed']
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
