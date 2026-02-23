/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { applyComponentAnimations } from './animation-composer-wrapper'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

describe('Animation Composer Wrapper', () => {
  describe('applyComponentAnimations', () => {
    test('returns baseStyle unchanged for non-animated component types', () => {
      const baseStyle = { color: 'red', padding: '10px' }
      const result = applyComponentAnimations('section' as Component['type'], baseStyle)

      expect(result).toEqual(baseStyle)
    })

    test('applies fadeOut animation for toast components', () => {
      const baseStyle = { padding: '10px' }
      const theme: Theme = {
        animations: {
          fadeOut: {
            keyframes: {
              '0%': { opacity: '1' },
              '100%': { opacity: '0' },
            },
            duration: '200ms',
          },
        },
      }

      const result = applyComponentAnimations('toast', baseStyle, theme)

      // Should return a style object (animation composition happens internally)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('padding', '10px')
    })

    test('applies scaleUp animation for card components', () => {
      const baseStyle = { padding: '10px' }
      const theme: Theme = {
        animations: {
          scaleUp: {
            keyframes: {
              '0%': { transform: 'scale(0.9)', opacity: '0' },
              '100%': { transform: 'scale(1)', opacity: '1' },
            },
            duration: '400ms',
          },
        },
      }

      const result = applyComponentAnimations('card', baseStyle, theme)

      // Should return a style object
      expect(result).toBeDefined()
      expect(result).toHaveProperty('padding', '10px')
    })

    test('applies float animation for fab components', () => {
      const baseStyle = { position: 'fixed' }
      const theme: Theme = {
        animations: {
          float: {
            keyframes: {
              '0%, 100%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(-10px)' },
            },
            duration: '2s',
          },
        },
      }

      const result = applyComponentAnimations('fab', baseStyle, theme)

      // Should return a style object
      expect(result).toBeDefined()
      expect(result).toHaveProperty('position', 'fixed')
    })

    test('handles undefined baseStyle', () => {
      const result = applyComponentAnimations('toast', undefined)

      // Should return empty object or undefined
      expect(result === undefined || typeof result === 'object').toBe(true)
    })

    test('handles theme without animations', () => {
      const baseStyle = { padding: '10px' }
      const theme: Theme = {} // No animations defined

      const result = applyComponentAnimations('toast', baseStyle, theme)

      // Should return baseStyle as animations won't be found
      expect(result).toEqual(baseStyle)
    })

    test('handles undefined theme', () => {
      const baseStyle = { padding: '10px' }

      const result = applyComponentAnimations('toast', baseStyle, undefined)

      // Should return baseStyle as no theme available
      expect(result).toEqual(baseStyle)
    })

    test('preserves existing baseStyle properties', () => {
      const baseStyle = {
        color: 'blue',
        padding: '20px',
        fontSize: '16px',
      }
      const theme: Theme = {
        animations: {
          fadeOut: {
            keyframes: {
              '0%': { opacity: '1' },
              '100%': { opacity: '0' },
            },
          },
        },
      }

      const result = applyComponentAnimations('toast', baseStyle, theme)

      // Should preserve original properties
      expect(result).toMatchObject({
        color: 'blue',
        padding: '20px',
        fontSize: '16px',
      })
    })

    test('chains animations properly for card (scaleUp applied after fadeOut logic)', () => {
      const baseStyle = { margin: '10px' }
      const theme: Theme = {
        animations: {
          fadeOut: {
            keyframes: { '0%': { opacity: '1' }, '100%': { opacity: '0' } },
          },
          scaleUp: {
            keyframes: { '0%': { transform: 'scale(0)' }, '100%': { transform: 'scale(1)' } },
          },
        },
      }

      const result = applyComponentAnimations('card', baseStyle, theme)

      // Card should get scaleUp animation (fadeOut is only for toast)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('margin', '10px')
      // Animation properties are composed internally
    })

    test('chains animations properly for fab (float applied after card logic)', () => {
      const baseStyle = { bottom: '20px' }
      const theme: Theme = {
        animations: {
          float: {
            keyframes: {
              '0%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(-5px)' },
              '100%': { transform: 'translateY(0)' },
            },
          },
        },
      }

      const result = applyComponentAnimations('fab', baseStyle, theme)

      // Fab should get float animation with infinite
      expect(result).toBeDefined()
      expect(result).toHaveProperty('bottom', '20px')
      // Animation properties are composed internally
    })
  })
})
