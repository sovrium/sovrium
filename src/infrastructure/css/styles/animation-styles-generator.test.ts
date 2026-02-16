/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  generateKeyframes,
  generateAnimationClass,
  isReservedAnimationProperty,
  processAnimationConfigObject,
  processLegacyAnimationEntry,
  generateAnimationStyles,
} from './animation-styles-generator'
import type { Theme } from '@/domain/models/app/theme'
import type { AnimationConfigObject } from '@/domain/models/app/theme/animations'

describe('Animation Styles Generator', () => {
  describe('generateKeyframes', () => {
    test('generates basic keyframes', () => {
      const keyframes = {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      }

      const result = generateKeyframes('fade-in', keyframes)

      expect(result).toContain('@keyframes fade-in')
      expect(result).toContain('0% { opacity: 0; }')
      expect(result).toContain('100% { opacity: 1; }')
    })

    test('generates keyframes with multiple properties', () => {
      const keyframes = {
        '0%': { opacity: '0', transform: 'translateY(-10px)' },
        '100%': { opacity: '1', transform: 'translateY(0)' },
      }

      const result = generateKeyframes('slide-in', keyframes)

      expect(result).toContain('@keyframes slide-in')
      expect(result).toContain('opacity: 0;')
      expect(result).toContain('transform: translateY(-10px);')
      expect(result).toContain('opacity: 1;')
      expect(result).toContain('transform: translateY(0);')
    })

    test('generates keyframes with color token references', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
        },
      }

      const keyframes = {
        '0%': { color: '$colors.primary' },
        '100%': { color: '#ffffff' },
      }

      const result = generateKeyframes('color-change', keyframes, theme)

      expect(result).toContain('@keyframes color-change')
      expect(result).toContain('color: #3b82f6;')
      expect(result).toContain('color: #ffffff;')
    })

    test('generates keyframes with multiple steps', () => {
      const keyframes = {
        '0%': { opacity: '0' },
        '50%': { opacity: '0.5' },
        '75%': { opacity: '0.75' },
        '100%': { opacity: '1' },
      }

      const result = generateKeyframes('multi-step', keyframes)

      expect(result).toContain('0% {')
      expect(result).toContain('50% {')
      expect(result).toContain('75% {')
      expect(result).toContain('100% {')
    })

    test('handles empty keyframes object', () => {
      const keyframes = {}

      const result = generateKeyframes('empty', keyframes)

      expect(result).toContain('@keyframes empty')
    })

    test('handles numeric property values', () => {
      const keyframes = {
        '0%': { opacity: 0 },
        '100%': { opacity: 1 },
      }

      const result = generateKeyframes('numeric', keyframes)

      expect(result).toContain('opacity: 0;')
      expect(result).toContain('opacity: 1;')
    })
  })

  describe('generateAnimationClass', () => {
    test('generates animation class with default values', () => {
      const result = generateAnimationClass('fade-in')

      expect(result).toBe('.animate-fade-in { animation: fade-in 300ms ease 0ms; }')
    })

    test('generates animation class with custom duration', () => {
      const result = generateAnimationClass('fade-in', '500ms')

      expect(result).toContain('animation: fade-in 500ms ease 0ms')
    })

    test('generates animation class with custom easing', () => {
      const result = generateAnimationClass('fade-in', '300ms', 'ease-in-out')

      expect(result).toContain('animation: fade-in 300ms ease-in-out 0ms')
    })

    test('generates animation class with custom delay', () => {
      const result = generateAnimationClass('fade-in', '300ms', 'ease', '100ms')

      expect(result).toContain('animation: fade-in 300ms ease 100ms')
    })

    test('generates animation class with all custom values', () => {
      const result = generateAnimationClass(
        'slide-in',
        '1s',
        'cubic-bezier(0.4, 0, 0.2, 1)',
        '200ms'
      )

      expect(result).toBe(
        '.animate-slide-in { animation: slide-in 1s cubic-bezier(0.4, 0, 0.2, 1) 200ms; }'
      )
    })
  })

  describe('isReservedAnimationProperty', () => {
    test('identifies reserved properties', () => {
      expect(isReservedAnimationProperty('duration')).toBe(true)
      expect(isReservedAnimationProperty('easing')).toBe(true)
      expect(isReservedAnimationProperty('keyframes')).toBe(true)
    })

    test('identifies non-reserved properties', () => {
      expect(isReservedAnimationProperty('fade-in')).toBe(false)
      expect(isReservedAnimationProperty('slide-up')).toBe(false)
      expect(isReservedAnimationProperty('custom')).toBe(false)
    })
  })

  describe('processAnimationConfigObject', () => {
    test('processes animation with keyframes', () => {
      const config: AnimationConfigObject = {
        keyframes: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        duration: '500ms',
        easing: 'ease-in',
      }

      const result = processAnimationConfigObject('fade-in', config)

      expect(result).toHaveLength(2)
      expect(result[0]).toContain('@keyframes fade-in')
      expect(result[1]).toContain('.animate-fade-in')
      expect(result[1]).toContain('500ms')
      expect(result[1]).toContain('ease-in')
    })

    test('returns only keyframes when enabled is false', () => {
      const config: AnimationConfigObject = {
        keyframes: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        enabled: false,
      }

      const result = processAnimationConfigObject('fade-in', config)

      expect(result).toHaveLength(1)
      expect(result[0]).toContain('@keyframes fade-in')
    })

    test('returns empty array when no keyframes', () => {
      const config: AnimationConfigObject = {
        duration: '500ms',
      }

      const result = processAnimationConfigObject('fade-in', config)

      expect(result).toHaveLength(0)
    })

    test('includes delay in animation class', () => {
      const config: AnimationConfigObject = {
        keyframes: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        duration: '300ms',
        easing: 'ease',
        delay: '100ms',
      }

      const result = processAnimationConfigObject('delayed', config)

      expect(result).toHaveLength(2)
      expect(result[1]).toContain('100ms')
    })

    test('resolves token references in keyframes', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
        },
      }

      const config: AnimationConfigObject = {
        keyframes: {
          '0%': { color: '$colors.primary' },
          '100%': { color: '#ffffff' },
        },
      }

      const result = processAnimationConfigObject('color-fade', config, theme)

      expect(result[0]).toContain('#3b82f6')
    })
  })

  describe('processLegacyAnimationEntry', () => {
    test('skips reserved properties', () => {
      const result1 = processLegacyAnimationEntry('duration', '500ms')
      const result2 = processLegacyAnimationEntry('easing', 'ease-in')
      const result3 = processLegacyAnimationEntry('keyframes', {})

      expect(result1).toHaveLength(0)
      expect(result2).toHaveLength(0)
      expect(result3).toHaveLength(0)
    })

    test('skips false boolean values', () => {
      const result = processLegacyAnimationEntry('fade-in', false)

      expect(result).toHaveLength(0)
    })

    test('skips string values', () => {
      const result = processLegacyAnimationEntry('fade-in', 'some-string')

      expect(result).toHaveLength(0)
    })

    test('processes object animation configs', () => {
      const config = {
        keyframes: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      }

      const result = processLegacyAnimationEntry('fade-in', config)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toContain('@keyframes fade-in')
    })

    test('skips undefined values', () => {
      const result = processLegacyAnimationEntry('fade-in', undefined)

      expect(result).toHaveLength(0)
    })

    test('handles true boolean values', () => {
      // Boolean true is not a reserved property, not false, not string, not object
      // So it falls through to the end and returns empty array
      const result = processLegacyAnimationEntry('fade-in', true)

      expect(result).toHaveLength(0)
    })
  })

  describe('generateAnimationStyles', () => {
    test('returns empty string for undefined animations', () => {
      const result = generateAnimationStyles(undefined)

      expect(result).toBe('')
    })

    test('returns empty string for empty animations object', () => {
      const result = generateAnimationStyles({})

      expect(result).toBe('')
    })

    test('generates styles from nested keyframes tokens', () => {
      const animations = {
        keyframes: {
          'fade-in': {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
          'slide-up': {
            '0%': { transform: 'translateY(20px)' },
            '100%': { transform: 'translateY(0)' },
          },
        },
      }

      const result = generateAnimationStyles(animations)

      expect(result).toContain('@keyframes fade-in')
      expect(result).toContain('@keyframes slide-up')
      expect(result).toContain('opacity: 0;')
      expect(result).toContain('transform: translateY(20px);')
    })

    test('generates styles from legacy flat animations', () => {
      const animations = {
        'fade-in': {
          keyframes: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
          duration: '500ms',
        },
      }

      const result = generateAnimationStyles(animations)

      expect(result).toContain('@keyframes fade-in')
      expect(result).toContain('.animate-fade-in')
      expect(result).toContain('500ms')
    })

    test('combines nested and legacy animations', () => {
      const animations = {
        keyframes: {
          'nested-anim': {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
        },
        'legacy-anim': {
          keyframes: {
            '0%': { scale: '0' },
            '100%': { scale: '1' },
          },
        },
      }

      const result = generateAnimationStyles(animations)

      expect(result).toContain('@keyframes nested-anim')
      expect(result).toContain('@keyframes legacy-anim')
    })

    test('resolves token references in animations', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
        },
      }

      const animations = {
        keyframes: {
          'color-pulse': {
            '0%': { color: '$colors.primary' },
            '100%': { color: '#ffffff' },
          },
        },
      }

      const result = generateAnimationStyles(animations, theme)

      expect(result).toContain('#3b82f6')
      expect(result).toContain('#ffffff')
    })

    test('skips invalid keyframes entries', () => {
      const animations = {
        keyframes: {
          'valid-anim': {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
          'invalid-anim': 'not-an-object' as unknown as Record<string, unknown>,
        },
      }

      const result = generateAnimationStyles(animations)

      expect(result).toContain('@keyframes valid-anim')
      expect(result).not.toContain('@keyframes invalid-anim')
    })

    test('handles disabled animations correctly', () => {
      const animations = {
        'enabled-anim': {
          keyframes: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
        },
        'disabled-anim': {
          keyframes: {
            '0%': { scale: '0' },
            '100%': { scale: '1' },
          },
          enabled: false,
        },
      }

      const result = generateAnimationStyles(animations)

      // Enabled animation should have both keyframes and class
      expect(result).toContain('@keyframes enabled-anim')
      expect(result).toContain('.animate-enabled-anim')

      // Disabled animation should only have keyframes
      expect(result).toContain('@keyframes disabled-anim')
      expect(result).not.toContain('.animate-disabled-anim')
    })

    test('generates complete animation CSS with all features', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
          accent: '#10b981',
        },
      }

      const animations = {
        keyframes: {
          pulse: {
            '0%': { opacity: '1' },
            '50%': { opacity: '0.5' },
            '100%': { opacity: '1' },
          },
        },
        'fade-in': {
          keyframes: {
            '0%': { opacity: '0', color: '$colors.primary' },
            '100%': { opacity: '1', color: '$colors.accent' },
          },
          duration: '600ms',
          easing: 'ease-in-out',
          delay: '100ms',
        },
      }

      const result = generateAnimationStyles(animations, theme)

      // Nested keyframes
      expect(result).toContain('@keyframes pulse')

      // Legacy animation with token resolution
      expect(result).toContain('@keyframes fade-in')
      expect(result).toContain('#3b82f6')
      expect(result).toContain('#10b981')
      expect(result).toContain('.animate-fade-in')
      expect(result).toContain('600ms')
      expect(result).toContain('ease-in-out')
      expect(result).toContain('100ms')
    })
  })
})
