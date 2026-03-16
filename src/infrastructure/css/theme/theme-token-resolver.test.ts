/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  resolveColorToken,
  resolveEasingToken,
  resolveTokenReference,
} from './theme-token-resolver'
import type { Theme } from '@/domain/models/app/theme'

describe('Theme Token Resolver', () => {
  describe('resolveColorToken', () => {
    test('resolves existing color token', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
          secondary: '#8b5cf6',
        },
      }

      expect(resolveColorToken('primary', theme)).toBe('#3b82f6')
      expect(resolveColorToken('secondary', theme)).toBe('#8b5cf6')
    })

    test('returns undefined for non-existent color token', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
        },
      }

      expect(resolveColorToken('nonexistent', theme)).toBeUndefined()
    })

    test('returns undefined when theme is undefined', () => {
      expect(resolveColorToken('primary', undefined)).toBeUndefined()
    })

    test('returns undefined when theme has no colors', () => {
      const theme: Theme = {}

      expect(resolveColorToken('primary', theme)).toBeUndefined()
    })

    test('handles empty string color value', () => {
      const theme: Theme = {
        colors: {
          empty: '',
        },
      }

      expect(resolveColorToken('empty', theme)).toBeUndefined()
    })

    test('converts non-string color values to strings', () => {
      const theme: Theme = {
        colors: {
          numeric: 123 as unknown as string,
        },
      }

      expect(resolveColorToken('numeric', theme)).toBe('123')
    })
  })

  describe('resolveEasingToken', () => {
    test('resolves existing easing token', () => {
      const theme: Theme = {
        animations: {
          easing: {
            smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
            bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          },
        },
      }

      expect(resolveEasingToken('smooth', theme)).toBe('cubic-bezier(0.4, 0, 0.2, 1)')
      expect(resolveEasingToken('bounce', theme)).toBe('cubic-bezier(0.68, -0.55, 0.265, 1.55)')
    })

    test('returns undefined for non-existent easing token', () => {
      const theme: Theme = {
        animations: {
          easing: {
            smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
          },
        },
      }

      expect(resolveEasingToken('nonexistent', theme)).toBeUndefined()
    })

    test('returns undefined when theme is undefined', () => {
      expect(resolveEasingToken('smooth', undefined)).toBeUndefined()
    })

    test('returns undefined when theme has no animations', () => {
      const theme: Theme = {}

      expect(resolveEasingToken('smooth', theme)).toBeUndefined()
    })

    test('returns undefined when animations has no easing', () => {
      const theme: Theme = {
        animations: {},
      }

      expect(resolveEasingToken('smooth', theme)).toBeUndefined()
    })

    test('returns undefined when easing is not an object', () => {
      const theme: Theme = {
        animations: {
          easing: 'not-an-object' as unknown as Record<string, string>,
        },
      }

      expect(resolveEasingToken('smooth', theme)).toBeUndefined()
    })

    test('handles empty string easing value', () => {
      const theme: Theme = {
        animations: {
          easing: {
            empty: '',
          },
        },
      }

      expect(resolveEasingToken('empty', theme)).toBeUndefined()
    })
  })

  describe('resolveTokenReference', () => {
    test('resolves color token reference', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
          accent: '#10b981',
        },
      }

      expect(resolveTokenReference('$colors.primary', theme)).toBe('#3b82f6')
      expect(resolveTokenReference('$colors.accent', theme)).toBe('#10b981')
    })

    test('resolves easing token reference', () => {
      const theme: Theme = {
        animations: {
          easing: {
            smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
          },
        },
      }

      expect(resolveTokenReference('$easing.smooth', theme)).toBe('cubic-bezier(0.4, 0, 0.2, 1)')
    })

    test('returns original value for non-token strings', () => {
      expect(resolveTokenReference('plain-value', undefined)).toBe('plain-value')
      expect(resolveTokenReference('#ff5733', undefined)).toBe('#ff5733')
      expect(resolveTokenReference('500ms', undefined)).toBe('500ms')
    })

    test('returns original value for malformed token references', () => {
      expect(resolveTokenReference('$colors', undefined)).toBe('$colors')
      expect(resolveTokenReference('$colors.', undefined)).toBe('$colors.')
      expect(resolveTokenReference('$.primary', undefined)).toBe('$.primary')
      expect(resolveTokenReference('colors.primary', undefined)).toBe('colors.primary')
    })

    test('returns original value when token not found', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
        },
      }

      expect(resolveTokenReference('$colors.nonexistent', theme)).toBe('$colors.nonexistent')
    })

    test('returns original value for unknown token category', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
        },
      }

      expect(resolveTokenReference('$spacing.large', theme)).toBe('$spacing.large')
      expect(resolveTokenReference('$unknown.value', theme)).toBe('$unknown.value')
    })

    test('converts non-string values to strings', () => {
      expect(resolveTokenReference(42, undefined)).toBe('42')
      expect(resolveTokenReference(true, undefined)).toBe('true')
      expect(resolveTokenReference(null, undefined)).toBe('null')
      expect(resolveTokenReference(undefined, undefined)).toBe('undefined')
    })

    test('handles nested token resolution with fallback', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
        },
        animations: {
          easing: {
            smooth: 'ease-in-out',
          },
        },
      }

      // Valid color token
      expect(resolveTokenReference('$colors.primary', theme)).toBe('#3b82f6')

      // Valid easing token
      expect(resolveTokenReference('$easing.smooth', theme)).toBe('ease-in-out')

      // Invalid color token - returns original
      expect(resolveTokenReference('$colors.invalid', theme)).toBe('$colors.invalid')

      // Invalid easing token - returns original
      expect(resolveTokenReference('$easing.invalid', theme)).toBe('$easing.invalid')
    })

    test('handles case sensitivity', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
        },
      }

      // Exact match works
      expect(resolveTokenReference('$colors.primary', theme)).toBe('#3b82f6')

      // Case mismatch returns original (no token found)
      expect(resolveTokenReference('$colors.Primary', theme)).toBe('$colors.Primary')
      expect(resolveTokenReference('$Colors.primary', theme)).toBe('$Colors.primary')
    })
  })
})
