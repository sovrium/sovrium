/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  generateThemeColors,
  generateThemeFonts,
  generateThemeSpacing,
  generateThemeShadows,
  generateThemeBorderRadius,
  generateThemeBreakpoints,
} from './theme-generators'

describe('Theme Generators', () => {
  describe('generateThemeColors', () => {
    test('should return empty string when colors is undefined', () => {
      // Given
      const colors = undefined

      // When
      const result = generateThemeColors(colors)

      // Then
      expect(result).toBe('')
    })

    test('should return empty string when colors is empty object', () => {
      // Given
      const colors = {}

      // When
      const result = generateThemeColors(colors)

      // Then
      expect(result).toBe('')
    })

    test('should generate CSS variables for single color', () => {
      // Given
      const colors = {
        primary: '#3B82F6',
      }

      // When
      const result = generateThemeColors(colors)

      // Then
      expect(result).toBe('    --color-primary: #3B82F6;')
    })

    test('should generate CSS variables for multiple colors', () => {
      // Given
      const colors = {
        primary: '#3B82F6',
        secondary: '#10B981',
        accent: '#F59E0B',
      }

      // When
      const result = generateThemeColors(colors)

      // Then
      expect(result).toBe(
        '    --color-primary: #3B82F6;\n' +
          '    --color-secondary: #10B981;\n' +
          '    --color-accent: #F59E0B;'
      )
    })

    test('should handle various color formats', () => {
      // Given
      const colors = {
        rgb: 'rgb(255, 0, 0)',
        rgba: 'rgba(255, 0, 0, 0.5)',
        hsl: 'hsl(0, 100%, 50%)',
        hex: '#FF0000',
        named: 'red',
      }

      // When
      const result = generateThemeColors(colors)

      // Then
      expect(result).toBe(
        '    --color-rgb: rgb(255, 0, 0);\n' +
          '    --color-rgba: rgba(255, 0, 0, 0.5);\n' +
          '    --color-hsl: hsl(0, 100%, 50%);\n' +
          '    --color-hex: #FF0000;\n' +
          '    --color-named: red;'
      )
    })
  })

  describe('generateThemeFonts', () => {
    test('should return empty string when fonts is undefined', () => {
      // Given
      const fonts = undefined

      // When
      const result = generateThemeFonts(fonts)

      // Then
      expect(result).toBe('')
    })

    test('should return empty string when fonts is empty object', () => {
      // Given
      const fonts = {}

      // When
      const result = generateThemeFonts(fonts)

      // Then
      expect(result).toBe('')
    })

    test('should generate font family without fallback', () => {
      // Given
      const fonts = {
        sans: {
          family: 'Inter',
        },
      }

      // When
      const result = generateThemeFonts(fonts)

      // Then
      expect(result).toBe('    --font-sans: Inter;')
    })

    test('should generate font family with fallback', () => {
      // Given
      const fonts = {
        sans: {
          family: 'Inter',
          fallback: 'system-ui, sans-serif',
        },
      }

      // When
      const result = generateThemeFonts(fonts)

      // Then
      expect(result).toBe('    --font-sans: Inter, system-ui, sans-serif;')
    })

    test('should include style when not normal', () => {
      // Given
      const fonts = {
        serif: {
          family: 'Georgia',
          style: 'italic',
        },
      }

      // When
      const result = generateThemeFonts(fonts)

      // Then
      expect(result).toBe('    --font-serif: Georgia;\n    --font-serif-style: italic;')
    })

    test('should not include style when normal', () => {
      // Given
      const fonts = {
        serif: {
          family: 'Georgia',
          style: 'normal',
        },
      }

      // When
      const result = generateThemeFonts(fonts)

      // Then
      expect(result).toBe('    --font-serif: Georgia;')
    })

    test('should include transform when not none', () => {
      // Given
      const fonts = {
        heading: {
          family: 'Montserrat',
          transform: 'uppercase',
        },
      }

      // When
      const result = generateThemeFonts(fonts)

      // Then
      expect(result).toBe('    --font-heading: Montserrat;\n    --font-heading-transform: uppercase;')
    })

    test('should not include transform when none', () => {
      // Given
      const fonts = {
        heading: {
          family: 'Montserrat',
          transform: 'none',
        },
      }

      // When
      const result = generateThemeFonts(fonts)

      // Then
      expect(result).toBe('    --font-heading: Montserrat;')
    })

    test('should include letter spacing', () => {
      // Given
      const fonts = {
        mono: {
          family: 'JetBrains Mono',
          letterSpacing: '0.05em',
        },
      }

      // When
      const result = generateThemeFonts(fonts)

      // Then
      expect(result).toBe(
        '    --font-mono: JetBrains Mono;\n    --font-mono-letter-spacing: 0.05em;'
      )
    })

    test('should generate complete font configuration', () => {
      // Given
      const fonts = {
        display: {
          family: 'Playfair Display',
          fallback: 'serif',
          style: 'italic',
          transform: 'capitalize',
          letterSpacing: '-0.02em',
        },
      }

      // When
      const result = generateThemeFonts(fonts)

      // Then
      expect(result).toBe(
        '    --font-display: Playfair Display, serif;\n' +
          '    --font-display-style: italic;\n' +
          '    --font-display-transform: capitalize;\n' +
          '    --font-display-letter-spacing: -0.02em;'
      )
    })

    test('should handle multiple font configurations', () => {
      // Given
      const fonts = {
        sans: { family: 'Inter' },
        serif: { family: 'Georgia', style: 'italic' },
        mono: { family: 'Fira Code', letterSpacing: '0.1em' },
      }

      // When
      const result = generateThemeFonts(fonts)

      // Then
      expect(result).toBe(
        '    --font-sans: Inter;\n' +
          '    --font-serif: Georgia;\n' +
          '    --font-serif-style: italic;\n' +
          '    --font-mono: Fira Code;\n' +
          '    --font-mono-letter-spacing: 0.1em;'
      )
    })
  })

  describe('generateThemeSpacing', () => {
    test('should return empty string when spacing is undefined', () => {
      // Given
      const spacing = undefined

      // When
      const result = generateThemeSpacing(spacing)

      // Then
      expect(result).toBe('')
    })

    test('should return empty string when spacing is empty object', () => {
      // Given
      const spacing = {}

      // When
      const result = generateThemeSpacing(spacing)

      // Then
      expect(result).toBe('')
    })

    test('should generate CSS variables for rem values', () => {
      // Given
      const spacing = {
        xs: '0.5rem',
        sm: '1rem',
        md: '1.5rem',
      }

      // When
      const result = generateThemeSpacing(spacing)

      // Then
      expect(result).toBe(
        '    --spacing-xs: 0.5rem;\n' + '    --spacing-sm: 1rem;\n' + '    --spacing-md: 1.5rem;'
      )
    })

    test('should generate CSS variables for px values', () => {
      // Given
      const spacing = {
        small: '8px',
        medium: '16px',
        large: '24px',
      }

      // When
      const result = generateThemeSpacing(spacing)

      // Then
      expect(result).toBe(
        '    --spacing-small: 8px;\n' +
          '    --spacing-medium: 16px;\n' +
          '    --spacing-large: 24px;'
      )
    })

    test('should generate CSS variables for em values', () => {
      // Given
      const spacing = {
        tight: '0.5em',
        normal: '1em',
        loose: '2em',
      }

      // When
      const result = generateThemeSpacing(spacing)

      // Then
      expect(result).toBe(
        '    --spacing-tight: 0.5em;\n' +
          '    --spacing-normal: 1em;\n' +
          '    --spacing-loose: 2em;'
      )
    })

    test('should generate CSS variables for percentage values', () => {
      // Given
      const spacing = {
        half: '50%',
        full: '100%',
      }

      // When
      const result = generateThemeSpacing(spacing)

      // Then
      expect(result).toBe('    --spacing-half: 50%;\n    --spacing-full: 100%;')
    })

    test('should filter out Tailwind class names', () => {
      // Given
      const spacing = {
        xs: '0.5rem',
        sm: 'space-x-2', // Tailwind class
        md: '1.5rem',
        lg: 'gap-4', // Tailwind class
      }

      // When
      const result = generateThemeSpacing(spacing)

      // Then
      expect(result).toBe('    --spacing-xs: 0.5rem;\n    --spacing-md: 1.5rem;')
    })

    test('should handle decimal values', () => {
      // Given
      const spacing = {
        tiny: '0.25rem',
        small: '0.75rem',
        medium: '1.125rem',
      }

      // When
      const result = generateThemeSpacing(spacing)

      // Then
      expect(result).toBe(
        '    --spacing-tiny: 0.25rem;\n' +
          '    --spacing-small: 0.75rem;\n' +
          '    --spacing-medium: 1.125rem;'
      )
    })
  })

  describe('generateThemeShadows', () => {
    test('should return empty string when shadows is undefined', () => {
      // Given
      const shadows = undefined

      // When
      const result = generateThemeShadows(shadows)

      // Then
      expect(result).toBe('')
    })

    test('should return empty string when shadows is empty object', () => {
      // Given
      const shadows = {}

      // When
      const result = generateThemeShadows(shadows)

      // Then
      expect(result).toBe('')
    })

    test('should generate CSS variables for single shadow', () => {
      // Given
      const shadows = {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
      }

      // When
      const result = generateThemeShadows(shadows)

      // Then
      expect(result).toBe('    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);')
    })

    test('should generate CSS variables for multiple shadows', () => {
      // Given
      const shadows = {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px rgba(0, 0, 0, 0.1)',
      }

      // When
      const result = generateThemeShadows(shadows)

      // Then
      expect(result).toBe(
        '    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);\n' +
          '    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);\n' +
          '    --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);\n' +
          '    --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);'
      )
    })

    test('should handle complex shadow values', () => {
      // Given
      const shadows = {
        inset: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
        multiple: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
        colored: '0 4px 14px 0 rgba(0, 118, 255, 0.39)',
      }

      // When
      const result = generateThemeShadows(shadows)

      // Then
      expect(result).toBe(
        '    --shadow-inset: inset 0 2px 4px rgba(0, 0, 0, 0.06);\n' +
          '    --shadow-multiple: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);\n' +
          '    --shadow-colored: 0 4px 14px 0 rgba(0, 118, 255, 0.39);'
      )
    })

    test('should preserve original shadow values as-is', () => {
      // Given
      const shadows = {
        none: 'none',
        custom: '5px 5px 0 #000',
      }

      // When
      const result = generateThemeShadows(shadows)

      // Then
      expect(result).toBe('    --shadow-none: none;\n    --shadow-custom: 5px 5px 0 #000;')
    })
  })

  describe('generateThemeBorderRadius', () => {
    test('should return empty string when borderRadius is undefined', () => {
      // Given
      const borderRadius = undefined

      // When
      const result = generateThemeBorderRadius(borderRadius)

      // Then
      expect(result).toBe('')
    })

    test('should return empty string when borderRadius is empty object', () => {
      // Given
      const borderRadius = {}

      // When
      const result = generateThemeBorderRadius(borderRadius)

      // Then
      expect(result).toBe('')
    })

    test('should handle DEFAULT key specially', () => {
      // Given
      const borderRadius = {
        DEFAULT: '0.25rem',
      }

      // When
      const result = generateThemeBorderRadius(borderRadius)

      // Then
      expect(result).toBe('    --radius: 0.25rem;')
    })

    test('should generate CSS variables for named radius values', () => {
      // Given
      const borderRadius = {
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
      }

      // When
      const result = generateThemeBorderRadius(borderRadius)

      // Then
      expect(result).toBe(
        '    --radius-sm: 0.125rem;\n    --radius-md: 0.375rem;\n    --radius-lg: 0.5rem;'
      )
    })

    test('should handle px values', () => {
      // Given
      const borderRadius = {
        small: '2px',
        medium: '4px',
        large: '8px',
      }

      // When
      const result = generateThemeBorderRadius(borderRadius)

      // Then
      expect(result).toBe(
        '    --radius-small: 2px;\n    --radius-medium: 4px;\n    --radius-large: 8px;'
      )
    })

    test('should handle percentage values', () => {
      // Given
      const borderRadius = {
        circle: '50%',
        pill: '9999px',
      }

      // When
      const result = generateThemeBorderRadius(borderRadius)

      // Then
      expect(result).toBe('    --radius-circle: 50%;\n    --radius-pill: 9999px;')
    })

    test('should handle mixed DEFAULT and named values', () => {
      // Given
      const borderRadius = {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        lg: '0.5rem',
        full: '9999px',
      }

      // When
      const result = generateThemeBorderRadius(borderRadius)

      // Then
      expect(result).toBe(
        '    --radius: 0.25rem;\n' +
          '    --radius-sm: 0.125rem;\n' +
          '    --radius-lg: 0.5rem;\n' +
          '    --radius-full: 9999px;'
      )
    })
  })

  describe('generateThemeBreakpoints', () => {
    test('should return empty string when breakpoints is undefined', () => {
      // Given
      const breakpoints = undefined

      // When
      const result = generateThemeBreakpoints(breakpoints)

      // Then
      expect(result).toBe('')
    })

    test('should return empty string when breakpoints is empty object', () => {
      // Given
      const breakpoints = {}

      // When
      const result = generateThemeBreakpoints(breakpoints)

      // Then
      expect(result).toBe('')
    })

    test('should generate CSS variables for single breakpoint', () => {
      // Given
      const breakpoints = {
        sm: '640px',
      }

      // When
      const result = generateThemeBreakpoints(breakpoints)

      // Then
      expect(result).toBe('    --breakpoint-sm: 640px;')
    })

    test('should generate CSS variables for standard breakpoints', () => {
      // Given
      const breakpoints = {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      }

      // When
      const result = generateThemeBreakpoints(breakpoints)

      // Then
      expect(result).toBe(
        '    --breakpoint-sm: 640px;\n' +
          '    --breakpoint-md: 768px;\n' +
          '    --breakpoint-lg: 1024px;\n' +
          '    --breakpoint-xl: 1280px;\n' +
          '    --breakpoint-2xl: 1536px;'
      )
    })

    test('should handle em values', () => {
      // Given
      const breakpoints = {
        tablet: '48em',
        desktop: '64em',
        wide: '80em',
      }

      // When
      const result = generateThemeBreakpoints(breakpoints)

      // Then
      expect(result).toBe(
        '    --breakpoint-tablet: 48em;\n' +
          '    --breakpoint-desktop: 64em;\n' +
          '    --breakpoint-wide: 80em;'
      )
    })

    test('should handle custom breakpoint names', () => {
      // Given
      const breakpoints = {
        mobile: '320px',
        phablet: '576px',
        tablet: '768px',
        laptop: '1024px',
        desktop: '1440px',
      }

      // When
      const result = generateThemeBreakpoints(breakpoints)

      // Then
      expect(result).toBe(
        '    --breakpoint-mobile: 320px;\n' +
          '    --breakpoint-phablet: 576px;\n' +
          '    --breakpoint-tablet: 768px;\n' +
          '    --breakpoint-laptop: 1024px;\n' +
          '    --breakpoint-desktop: 1440px;'
      )
    })
  })
})