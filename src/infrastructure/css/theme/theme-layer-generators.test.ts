/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  extractThemeColorFlags,
  extractThemeFontFlags,
  extractTitleFontProperties,
  buildBodyClasses,
  buildHeadingClasses,
  buildLinkClasses,
  buildHeadingStyleProperties,
  generateHeadingStyles,
  generateBaseLayer,
  type TitleFontConfig,
} from './theme-layer-generators'
import type { Theme } from '@/domain/models/app/theme'

describe('Theme Layer Generators', () => {
  describe('extractThemeColorFlags', () => {
    test('extracts all color flags when theme has all colors', () => {
      const theme: Theme = {
        colors: {
          text: '#333333',
          primary: '#3b82f6',
          'primary-hover': '#2563eb',
        },
      }

      const flags = extractThemeColorFlags(theme)

      expect(flags.hasTextColor).toBe(true)
      expect(flags.hasPrimaryColor).toBe(true)
      expect(flags.hasPrimaryHoverColor).toBe(true)
    })

    test('returns false for missing colors', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
        },
      }

      const flags = extractThemeColorFlags(theme)

      expect(flags.hasTextColor).toBe(false)
      expect(flags.hasPrimaryColor).toBe(true)
      expect(flags.hasPrimaryHoverColor).toBe(false)
    })

    test('returns all false when theme has no colors', () => {
      const theme: Theme = {}

      const flags = extractThemeColorFlags(theme)

      expect(flags.hasTextColor).toBe(false)
      expect(flags.hasPrimaryColor).toBe(false)
      expect(flags.hasPrimaryHoverColor).toBe(false)
    })

    test('returns all false when theme is undefined', () => {
      const flags = extractThemeColorFlags(undefined)

      expect(flags.hasTextColor).toBe(false)
      expect(flags.hasPrimaryColor).toBe(false)
      expect(flags.hasPrimaryHoverColor).toBe(false)
    })
  })

  describe('extractThemeFontFlags', () => {
    test('extracts font flags when theme has all fonts', () => {
      const theme: Theme = {
        fonts: {
          title: {
            family: 'Montserrat',
            fallback: 'sans-serif',
          },
          body: {
            family: 'Open Sans',
            fallback: 'sans-serif',
          },
        },
      }

      const flags = extractThemeFontFlags(theme)

      expect(flags.hasTitleFont).toBe(true)
      expect(flags.hasBodyFont).toBe(true)
    })

    test('returns false for missing fonts', () => {
      const theme: Theme = {
        fonts: {
          title: {
            family: 'Montserrat',
            fallback: 'sans-serif',
          },
        },
      }

      const flags = extractThemeFontFlags(theme)

      expect(flags.hasTitleFont).toBe(true)
      expect(flags.hasBodyFont).toBe(false)
    })

    test('returns all false when theme has no fonts', () => {
      const theme: Theme = {}

      const flags = extractThemeFontFlags(theme)

      expect(flags.hasTitleFont).toBe(false)
      expect(flags.hasBodyFont).toBe(false)
    })

    test('returns all false when theme is undefined', () => {
      const flags = extractThemeFontFlags(undefined)

      expect(flags.hasTitleFont).toBe(false)
      expect(flags.hasBodyFont).toBe(false)
    })
  })

  describe('extractTitleFontProperties', () => {
    test('extracts title font properties when defined', () => {
      const theme: Theme = {
        fonts: {
          title: {
            family: 'Montserrat',
            fallback: 'sans-serif',
            style: 'italic',
            transform: 'uppercase',
            letterSpacing: '0.05em',
          },
        },
      }

      const props = extractTitleFontProperties(theme)

      expect(props).toBeDefined()
      expect(props?.style).toBe('italic')
      expect(props?.transform).toBe('uppercase')
      expect(props?.letterSpacing).toBe('0.05em')
    })

    test('returns undefined when theme has no title font', () => {
      const theme: Theme = {
        fonts: {
          body: {
            family: 'Open Sans',
            fallback: 'sans-serif',
          },
        },
      }

      const props = extractTitleFontProperties(theme)

      expect(props).toBeUndefined()
    })

    test('returns undefined when theme is undefined', () => {
      const props = extractTitleFontProperties(undefined)

      expect(props).toBeUndefined()
    })

    test('returns undefined when title font is not an object', () => {
      const theme = {
        fonts: {
          title: 'not-an-object',
        },
      } as unknown as Theme

      const props = extractTitleFontProperties(theme)

      expect(props).toBeUndefined()
    })
  })

  describe('buildBodyClasses', () => {
    test('includes text-text class when hasTextColor is true', () => {
      const classes = buildBodyClasses(true, false)

      expect(classes).toContain('text-text')
      expect(classes).toContain('antialiased')
      expect(classes).toContain('font-sans')
    })

    test('uses font-body when hasBodyFont is true', () => {
      const classes = buildBodyClasses(false, true)

      expect(classes).toContain('font-body')
      expect(classes).toContain('antialiased')
      expect(classes).not.toContain('text-text')
    })

    test('combines text color and body font', () => {
      const classes = buildBodyClasses(true, true)

      expect(classes).toContain('font-body')
      expect(classes).toContain('antialiased')
      expect(classes).toContain('text-text')
    })

    test('uses defaults when no theme colors or fonts', () => {
      const classes = buildBodyClasses(false, false)

      expect(classes).toContain('font-sans')
      expect(classes).toContain('antialiased')
      expect(classes).not.toContain('text-text')
    })
  })

  describe('buildHeadingClasses', () => {
    test('includes text-text when hasTextColor is true', () => {
      const classes = buildHeadingClasses(true, false)

      expect(classes).toContain('text-text')
      expect(classes).toContain('font-sans')
      expect(classes).toContain('font-semibold')
      expect(classes).toContain('tracking-tight')
    })

    test('uses font-title when hasTitleFont is true', () => {
      const classes = buildHeadingClasses(false, true)

      expect(classes).toContain('font-title')
      expect(classes).toContain('font-semibold')
      expect(classes).toContain('tracking-tight')
      expect(classes).not.toContain('text-text')
    })

    test('combines text color and title font', () => {
      const classes = buildHeadingClasses(true, true)

      expect(classes).toContain('font-title')
      expect(classes).toContain('font-semibold')
      expect(classes).toContain('tracking-tight')
      expect(classes).toContain('text-text')
    })

    test('uses defaults when no theme colors or fonts', () => {
      const classes = buildHeadingClasses(false, false)

      expect(classes).toContain('font-sans')
      expect(classes).toContain('font-semibold')
      expect(classes).toContain('tracking-tight')
      expect(classes).not.toContain('text-text')
    })
  })

  describe('buildLinkClasses', () => {
    test('includes both primary and hover colors when defined', () => {
      const classes = buildLinkClasses(true, true)

      expect(classes).toContain('transition-colors')
      expect(classes).toContain('text-primary')
      expect(classes).toContain('hover:text-primary-hover')
    })

    test('uses only primary color when hover not defined', () => {
      const classes = buildLinkClasses(true, false)

      expect(classes).toContain('transition-colors')
      expect(classes).toContain('text-primary')
      expect(classes).not.toContain('hover:text-primary-hover')
    })

    test('uses default blue colors when theme has no primary', () => {
      const classes = buildLinkClasses(false, false)

      expect(classes).toContain('transition-colors')
      expect(classes).toContain('text-blue-600')
      expect(classes).toContain('hover:text-blue-700')
    })
  })

  describe('buildHeadingStyleProperties', () => {
    test('includes font-style property when style is not normal', () => {
      const titleFont: TitleFontConfig = {
        style: 'italic',
      }

      const props = buildHeadingStyleProperties(titleFont)

      expect(props).toContain('font-style: var(--font-title-style);')
    })

    test('excludes font-style property when style is normal', () => {
      const titleFont: TitleFontConfig = {
        style: 'normal',
      }

      const props = buildHeadingStyleProperties(titleFont)

      expect(props).not.toContain('font-style')
    })

    test('includes text-transform property when transform is not none', () => {
      const titleFont: TitleFontConfig = {
        transform: 'uppercase',
      }

      const props = buildHeadingStyleProperties(titleFont)

      expect(props).toContain('text-transform: var(--font-title-transform);')
    })

    test('excludes text-transform property when transform is none', () => {
      const titleFont: TitleFontConfig = {
        transform: 'none',
      }

      const props = buildHeadingStyleProperties(titleFont)

      expect(props).not.toContain('text-transform')
    })

    test('includes letter-spacing property when defined', () => {
      const titleFont: TitleFontConfig = {
        letterSpacing: '0.05em',
      }

      const props = buildHeadingStyleProperties(titleFont)

      expect(props).toContain('letter-spacing: var(--font-title-letter-spacing);')
    })

    test('combines multiple style properties', () => {
      const titleFont: TitleFontConfig = {
        style: 'italic',
        transform: 'uppercase',
        letterSpacing: '0.05em',
      }

      const props = buildHeadingStyleProperties(titleFont)

      expect(props).toHaveLength(3)
      expect(props).toContain('font-style: var(--font-title-style);')
      expect(props).toContain('text-transform: var(--font-title-transform);')
      expect(props).toContain('letter-spacing: var(--font-title-letter-spacing);')
    })

    test('returns empty array when titleFont is undefined', () => {
      const props = buildHeadingStyleProperties(undefined)

      expect(props).toHaveLength(0)
    })

    test('returns empty array when no style properties set', () => {
      const titleFont: TitleFontConfig = {}

      const props = buildHeadingStyleProperties(titleFont)

      expect(props).toHaveLength(0)
    })
  })

  describe('generateHeadingStyles', () => {
    test('generates styles with only base classes', () => {
      const classes = ['font-sans', 'font-semibold', 'tracking-tight']
      const props: readonly string[] = []

      const result = generateHeadingStyles(classes, props)

      expect(result).toBe('@apply font-sans font-semibold tracking-tight;')
    })

    test('generates styles with base classes and additional properties', () => {
      const classes = ['font-title', 'font-semibold']
      const props = ['font-style: var(--font-title-style);', 'text-transform: uppercase;']

      const result = generateHeadingStyles(classes, props)

      expect(result).toContain('@apply font-title font-semibold;')
      expect(result).toContain('font-style: var(--font-title-style);')
      expect(result).toContain('text-transform: uppercase;')
    })
  })

  describe('generateBaseLayer', () => {
    test('generates base layer with default styles', () => {
      const result = generateBaseLayer(undefined)

      expect(result).toContain('@layer base')
      expect(result).toContain('body {')
      expect(result).toContain('font-sans')
      expect(result).toContain('antialiased')
      expect(result).toContain('h1,')
      expect(result).toContain('a {')
    })

    test('applies text color when theme defines it', () => {
      const theme: Theme = {
        colors: {
          text: '#333333',
        },
      }

      const result = generateBaseLayer(theme)

      expect(result).toContain('text-text')
    })

    test('applies title font when theme defines it', () => {
      const theme: Theme = {
        fonts: {
          title: {
            family: 'Montserrat',
            fallback: 'sans-serif',
          },
        },
      }

      const result = generateBaseLayer(theme)

      expect(result).toContain('font-title')
    })

    test('applies body font when theme defines it', () => {
      const theme: Theme = {
        fonts: {
          body: {
            family: 'Open Sans',
            fallback: 'sans-serif',
          },
        },
      }

      const result = generateBaseLayer(theme)

      expect(result).toContain('font-body')
    })

    test('applies primary colors to links when theme defines them', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
          'primary-hover': '#2563eb',
        },
      }

      const result = generateBaseLayer(theme)

      expect(result).toContain('text-primary')
      expect(result).toContain('hover:text-primary-hover')
    })

    test('includes heading style properties when title font has them', () => {
      const theme: Theme = {
        fonts: {
          title: {
            family: 'Montserrat',
            fallback: 'sans-serif',
            style: 'italic',
            transform: 'uppercase',
            letterSpacing: '0.05em',
          },
        },
      }

      const result = generateBaseLayer(theme)

      expect(result).toContain('font-style: var(--font-title-style);')
      expect(result).toContain('text-transform: var(--font-title-transform);')
      expect(result).toContain('letter-spacing: var(--font-title-letter-spacing);')
    })

    test('generates complete base layer with all theme options', () => {
      const theme: Theme = {
        colors: {
          text: '#333333',
          primary: '#3b82f6',
          'primary-hover': '#2563eb',
        },
        fonts: {
          title: {
            family: 'Montserrat',
            fallback: 'sans-serif',
            style: 'italic',
          },
          body: {
            family: 'Open Sans',
            fallback: 'sans-serif',
          },
        },
      }

      const result = generateBaseLayer(theme)

      // Body styles
      expect(result).toContain('body {')
      expect(result).toContain('font-body')
      expect(result).toContain('text-text')

      // Heading styles
      expect(result).toContain('h1,')
      expect(result).toContain('font-title')
      expect(result).toContain('font-style: var(--font-title-style);')

      // Link styles
      expect(result).toContain('a {')
      expect(result).toContain('text-primary')
      expect(result).toContain('hover:text-primary-hover')
    })
  })
})
