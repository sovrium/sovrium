/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Design } from '@/domain/models/app/design'

/**
 * Design font flags extracted from design configuration
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
 * Extract font availability flags from design
 * Returns flags indicating which fonts are defined in the design
 *
 * @param design - Optional design configuration
 * @returns Object with font availability flags
 */
export function extractThemeFontFlags(design?: Design): ThemeFontFlags {
  return {
    hasTitleFont: Boolean(design?.typeScale?.families?.title),
    hasBodyFont: Boolean(design?.typeScale?.families?.body),
  }
}

/**
 * Extract title font properties from design fonts config
 * Returns undefined if no title font is configured
 *
 * @param design - Optional design configuration
 * @returns Title font configuration or undefined
 */
export function extractTitleFontProperties(design?: Design): TitleFontConfig | undefined {
  if (!design?.typeScale?.families?.title || typeof design.typeScale?.families.title !== 'object') {
    return undefined
  }

  return design.typeScale?.families.title as TitleFontConfig
}

/**
 * Build body classes — canonical `fg` text token (always present via the
 * default layer); the font class still tracks the author's body-font token.
 *
 * @param hasBodyFont - Whether design defines body font
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
 * @param hasTitleFont - Whether design defines title font
 * @returns Array of CSS class names for heading elements
 */
export function buildHeadingClasses(hasTitleFont: boolean): readonly string[] {
  const fontClass = hasTitleFont ? 'font-title' : 'font-sans'
  return [fontClass, 'font-semibold', 'tracking-tight', 'text-foreground']
}

/**
 * Build link classes — canonical `primary` tokens (always present via the
 * default layer; author `design.colors.primary` recolors them via the bridge).
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
 * `ring-offset-background` is load-bearing and was missing. A ring offset with
 * no colour falls back to Tailwind's literal `#fff`, so on a dark page every
 * element reaching THIS rule — rather than a component recipe that sets its own
 * offset — drew a white halo. The button and input recipes both set one, which
 * is what kept this hidden; the element it was not hidden on is the
 * skip-to-main-content link, the first thing a keyboard user ever focuses.
 *
 * @returns Array of CSS class names for focus-visible rings
 */
export function buildFocusVisibleClasses(): readonly string[] {
  return ['ring-2', 'ring-focus-ring', 'ring-offset-2', 'ring-offset-background', 'outline-none']
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
  // The SAME ladder `HEADING_LEVEL_TYPE` gives the `heading` component:
  // 30 · 24 · 20 · 16 · 13 · 12. A bare `<h4>` and a `heading` component must
  // render alike, or which one an author reached for becomes a visual decision
  // they did not make.
  //
  // h1–h3 needed no edit: the platform ladder moved under these class names and
  // landed them on exactly the drawings' first three steps. h4–h6 did not, and
  // are re-pointed here rather than left one rung apart from their component.
  return {
    h1: 'text-4xl',
    h2: 'text-3xl',
    h3: 'text-2xl',
    h4: 'text-lg',
    h5: 'text-base',
    h6: 'text-sm',
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
  // The body rung, 14px — the same step `computeBodyClasses()` gives a `text`
  // component's default paragraph. A bare `<p>` and a body paragraph rendering
  // at two different sizes is the drift this pass exists to remove.
  //
  // No `leading-*`: the rung emits its own line-height, and a leading class
  // WINS the merge and replaces it. `leading-relaxed` (1.625) was sitting on a
  // step whose own leading is 1.57.
  return ['text-md', 'text-foreground']
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
 * Generate base layer styles with design color and font applications
 * Applies design colors and fonts to base HTML elements if design defines those tokens
 *
 * @param design - Optional design configuration
 * @returns CSS @layer base rule as string
 *
 * @example
 * generateBaseLayer(design)
 * // => '@layer base { body { ... } h1, h2, ... { ... } a { ... } }'
 */
export function generateBaseLayer(design?: Design): string {
  const fontFlags = extractThemeFontFlags(design)

  const bodyClasses = buildBodyClasses(fontFlags.hasBodyFont)
  const headingClasses = buildHeadingClasses(fontFlags.hasTitleFont)
  const linkClasses = buildLinkClasses()
  const focusVisibleClasses = buildFocusVisibleClasses()
  const paragraphClasses = buildParagraphClasses()
  const headingSizes = buildHeadingSizeClasses()

  const titleFont = extractTitleFontProperties(design)
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
