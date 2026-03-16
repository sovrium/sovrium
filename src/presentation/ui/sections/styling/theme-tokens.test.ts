/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { substitutePropsThemeTokens, substituteThemeTokens } from './theme-tokens'
import type { Theme } from '@/domain/models/app/theme'

describe('Theme Tokens', () => {
  describe('substituteThemeTokens', () => {
    test('returns non-string values unchanged', () => {
      const theme: Theme = { colors: { primary: '#007bff' } }

      expect(substituteThemeTokens(123, theme)).toBe(123)
      expect(substituteThemeTokens(true, theme)).toBe(true)
      expect(substituteThemeTokens(undefined, theme)).toBeUndefined()
      expect(substituteThemeTokens([], theme)).toEqual([])
      expect(substituteThemeTokens({}, theme)).toEqual({})
    })

    test('returns string unchanged when it has no theme tokens', () => {
      const theme: Theme = { colors: { primary: '#007bff' } }
      expect(substituteThemeTokens('static text', theme)).toBe('static text')
      expect(substituteThemeTokens('no tokens here', theme)).toBe('no tokens here')
    })

    test('returns string unchanged when theme is undefined', () => {
      expect(substituteThemeTokens('$theme.colors.primary', undefined)).toBe(
        '$theme.colors.primary'
      )
    })

    test('substitutes single theme token', () => {
      const theme: Theme = {
        colors: { primary: '#007bff' },
      }
      const result = substituteThemeTokens('$theme.colors.primary', theme)
      expect(result).toBe('#007bff')
    })

    test('substitutes multiple theme tokens in same string', () => {
      const theme: Theme = {
        spacing: { section: 'py-16', container: 'px-4' },
      }
      const result = substituteThemeTokens('$theme.spacing.section $theme.spacing.container', theme)
      expect(result).toBe('py-16 px-4')
    })

    test('handles deeply nested theme paths', () => {
      const theme = {
        design: {
          layout: {
            width: '1200px',
          },
        },
      } as Theme
      const result = substituteThemeTokens('$theme.design.layout.width', theme)
      expect(result).toBe('1200px')
    })

    test('handles color names with numbers', () => {
      const theme: Theme = {
        colors: {
          'gray-100': '#f7fafc',
          'primary-500': '#3b82f6',
        },
      }
      expect(substituteThemeTokens('$theme.colors.gray-100', theme)).toBe('#f7fafc')
      expect(substituteThemeTokens('$theme.colors.primary-500', theme)).toBe('#3b82f6')
    })

    test('handles color names with hyphens', () => {
      const theme: Theme = {
        colors: {
          'blue-gray': '#64748b',
          'warm-gray': '#78716c',
        },
      }
      expect(substituteThemeTokens('$theme.colors.blue-gray', theme)).toBe('#64748b')
      expect(substituteThemeTokens('$theme.colors.warm-gray', theme)).toBe('#78716c')
    })

    test('returns original token when path not found', () => {
      const theme: Theme = {
        colors: { primary: '#007bff' },
      }
      const result = substituteThemeTokens('$theme.colors.nonexistent', theme)
      expect(result).toBe('$theme.colors.nonexistent')
    })

    test('returns original token when intermediate path not found', () => {
      const theme: Theme = {
        colors: { primary: '#007bff' },
      }
      const result = substituteThemeTokens('$theme.spacing.section', theme)
      expect(result).toBe('$theme.spacing.section')
    })

    test('preserves text around theme tokens', () => {
      const theme: Theme = {
        colors: { primary: '#007bff' },
      }
      const result = substituteThemeTokens('color: $theme.colors.primary;', theme)
      expect(result).toBe('color: #007bff;')
    })

    test('substitutes numeric theme values', () => {
      const theme: Theme = {
        spacing: { section: 1200 as never }, // Numeric spacing value
      }
      const result = substituteThemeTokens('$theme.spacing.section', theme)
      expect(result).toBe('1200')
    })

    test('handles mixed valid and invalid tokens', () => {
      const theme: Theme = {
        colors: { primary: '#007bff' },
      }
      const result = substituteThemeTokens('$theme.colors.primary $theme.colors.invalid', theme)
      expect(result).toBe('#007bff $theme.colors.invalid')
    })
  })

  describe('substitutePropsThemeTokens', () => {
    test('returns undefined when props is undefined', () => {
      const theme: Theme = { colors: { primary: '#007bff' } }
      expect(substitutePropsThemeTokens(undefined, theme)).toBeUndefined()
    })

    test('returns props unchanged when theme is undefined', () => {
      const props = { color: '$theme.colors.primary' }
      const result = substitutePropsThemeTokens(props, undefined)
      expect(result).toEqual(props)
    })

    test('substitutes theme tokens in string props', () => {
      const theme: Theme = {
        colors: { primary: '#007bff', secondary: '#6c757d' },
      }
      const props = {
        color: '$theme.colors.primary',
        borderColor: '$theme.colors.secondary',
      }
      const result = substitutePropsThemeTokens(props, theme)
      expect(result).toEqual({
        color: '#007bff',
        borderColor: '#6c757d',
      })
    })

    test('preserves non-string props unchanged', () => {
      const theme: Theme = { colors: { primary: '#007bff' } }
      const props = {
        width: 100,
        visible: true,
        items: ['a', 'b'],
        config: { nested: 'value' },
      }
      const result = substitutePropsThemeTokens(props, theme)
      expect(result).toEqual(props)
    })

    test('recursively substitutes in nested objects', () => {
      const theme: Theme = {
        colors: { primary: '#007bff', secondary: '#6c757d' },
      }
      const props = {
        color: '$theme.colors.primary',
        style: {
          backgroundColor: '$theme.colors.secondary',
          nested: {
            borderColor: '$theme.colors.primary',
          },
        },
      }
      const result = substitutePropsThemeTokens(props, theme)
      expect(result).toEqual({
        color: '#007bff',
        style: {
          backgroundColor: '#6c757d',
          nested: {
            borderColor: '#007bff',
          },
        },
      })
    })

    test('does not modify arrays', () => {
      const theme: Theme = { colors: { primary: '#007bff' } }
      const props = {
        items: ['$theme.colors.primary', 'static'],
      }
      const result = substitutePropsThemeTokens(props, theme)
      // Arrays are preserved as-is (not recursively substituted)
      expect(result).toEqual(props)
    })

    test('handles mixed prop types', () => {
      const theme: Theme = {
        colors: { primary: '#007bff' },
        spacing: { gap: '1rem' },
      }
      const props = {
        color: '$theme.colors.primary',
        width: 200,
        visible: true,
        style: {
          gap: '$theme.spacing.gap',
        },
        label: 'Static text',
      }
      const result = substitutePropsThemeTokens(props, theme)
      expect(result).toEqual({
        color: '#007bff',
        width: 200,
        visible: true,
        style: {
          gap: '1rem',
        },
        label: 'Static text',
      })
    })

    test('creates new object (immutable)', () => {
      const theme: Theme = { colors: { primary: '#007bff' } }
      const props = { color: '$theme.colors.primary' }
      const result = substitutePropsThemeTokens(props, theme)

      // Result should be a new object
      expect(result).not.toBe(props)
      // But original should be unchanged
      expect(props).toEqual({ color: '$theme.colors.primary' })
    })

    test('handles empty props object', () => {
      const theme: Theme = { colors: { primary: '#007bff' } }
      const props = {}
      const result = substitutePropsThemeTokens(props, theme)
      expect(result).toEqual({})
    })

    test('preserves tokens when path not found', () => {
      const theme: Theme = { colors: { primary: '#007bff' } }
      const props = {
        color: '$theme.colors.nonexistent',
        style: {
          backgroundColor: '$theme.spacing.invalid',
        },
      }
      const result = substitutePropsThemeTokens(props, theme)
      expect(result).toEqual({
        color: '$theme.colors.nonexistent',
        style: {
          backgroundColor: '$theme.spacing.invalid',
        },
      })
    })
  })
})
