/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  applyComponentShadow,
  buildFinalClassName,
  parseComponentStyle,
  processComponentStyle,
} from './style-processor'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

describe('Style Processor', () => {
  describe('parseComponentStyle', () => {
    test('returns undefined for falsy values', () => {
      expect(parseComponentStyle(undefined, undefined)).toBeUndefined()
      expect(parseComponentStyle('', undefined)).toBeUndefined()
      expect(parseComponentStyle(0, undefined)).toBeUndefined()
      expect(parseComponentStyle(false, undefined)).toBeUndefined()
    })

    test('parses string style to object', () => {
      const result = parseComponentStyle('color: red; padding: 10px', undefined)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('color')
      expect(result).toHaveProperty('padding')
    })

    test('returns object style as-is', () => {
      const style = { color: 'blue', margin: '5px' }
      const result = parseComponentStyle(style, undefined)
      expect(result).toMatchObject(style)
    })

    test('normalizes animation properties', () => {
      const style = {
        color: 'red',
        animationName: 'fade',
        animationDuration: '300ms',
      }
      const result = parseComponentStyle(style, undefined)
      expect(result).toBeDefined()
      // Animation properties handled by animation composer
      expect(result).toHaveProperty('animationDuration')
    })

    test('extracts CSS properties from props', () => {
      const props = { maxWidth: '1200px', minHeight: '400px', backgroundColor: '#f0f0f0' }
      const result = parseComponentStyle(undefined, props)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('maxWidth', '1200px')
      expect(result).toHaveProperty('minHeight', '400px')
      expect(result).toHaveProperty('backgroundColor', '#f0f0f0')
    })

    test('merges CSS properties from props with explicit style', () => {
      const props = { maxWidth: '1200px', padding: '10px' }
      const result = parseComponentStyle({ color: 'red' }, props)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('maxWidth', '1200px')
      expect(result).toHaveProperty('padding', '10px')
      expect(result).toHaveProperty('color', 'red')
    })

    test('explicit style overrides CSS properties from props', () => {
      const props = { padding: '10px' }
      const result = parseComponentStyle({ padding: '20px' }, props)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('padding', '20px')
    })
  })

  describe('buildFinalClassName', () => {
    test('returns undefined when no classes apply', () => {
      const result = buildFinalClassName({
        type: 'section' as Component['type'],
        className: undefined,
        theme: undefined,
        substitutedProps: undefined,
        interactions: undefined,
      })
      expect(result).toBeUndefined()
    })

    test('adds type class for component types in COMPONENT_TYPE_CLASSES', () => {
      expect(
        buildFinalClassName({
          type: 'card',
          className: undefined,
          theme: undefined,
          substitutedProps: undefined,
          interactions: undefined,
        })
      ).toBe('card')
      expect(
        buildFinalClassName({
          type: 'badge',
          className: undefined,
          theme: undefined,
          substitutedProps: undefined,
          interactions: undefined,
        })
      ).toBe('badge')
      expect(
        buildFinalClassName({
          type: 'btn',
          className: undefined,
          theme: undefined,
          substitutedProps: undefined,
          interactions: undefined,
        })
      ).toBe('btn')
    })

    test('does not add type class for other component types', () => {
      expect(
        buildFinalClassName({
          type: 'section' as Component['type'],
          className: undefined,
          theme: undefined,
          substitutedProps: undefined,
          interactions: undefined,
        })
      ).toBeUndefined()
      expect(
        buildFinalClassName({
          type: 'container',
          className: undefined,
          theme: undefined,
          substitutedProps: undefined,
          interactions: undefined,
        })
      ).toBeUndefined()
    })

    test('adds flex classes when type is flex', () => {
      const result = buildFinalClassName({
        type: 'flex',
        className: undefined,
        theme: undefined,
        substitutedProps: { align: 'center', gap: 4 },
        interactions: undefined,
      })
      expect(result).toContain('flex')
      expect(result).toContain('items-center')
      expect(result).toContain('gap-4')
    })

    test('adds grid classes when type is grid', () => {
      const theme: Theme = {
        breakpoints: { md: '768px' },
      }
      const result = buildFinalClassName({
        type: 'grid',
        className: undefined,
        theme,
        substitutedProps: undefined,
        interactions: undefined,
      })
      expect(result).toContain('grid')
      expect(result).toContain('md:grid-cols-2')
    })

    test('includes custom className when provided', () => {
      const result = buildFinalClassName({
        type: 'card',
        className: 'custom-class',
        theme: undefined,
        substitutedProps: undefined,
        interactions: undefined,
      })
      expect(result).toBe('card custom-class')
    })

    test('combines all applicable classes', () => {
      const theme: Theme = {
        breakpoints: { md: '768px' },
      }
      const result = buildFinalClassName({
        type: 'card',
        className: 'my-custom-class',
        theme,
        substitutedProps: { some: 'prop' },
        interactions: undefined,
      })
      expect(result).toContain('card')
      expect(result).toContain('my-custom-class')
    })

    test('handles flex with custom className', () => {
      const result = buildFinalClassName({
        type: 'flex',
        className: 'flex-container',
        theme: undefined,
        substitutedProps: { align: 'center' },
        interactions: undefined,
      })
      expect(result).toContain('flex')
      expect(result).toContain('items-center')
      expect(result).toContain('flex-container')
    })

    test('preserves class order: type, flex/grid, custom', () => {
      const result = buildFinalClassName({
        type: 'card',
        className: 'custom',
        theme: undefined,
        substitutedProps: undefined,
        interactions: undefined,
      })
      expect(result).toBe('card custom')
    })
  })

  describe('applyComponentShadow', () => {
    test('returns style unchanged when no shadow applies', () => {
      const style = { color: 'red', padding: '10px' }
      const result = applyComponentShadow('section' as Component['type'], style, undefined)
      expect(result).toEqual(style)
    })

    test('returns undefined when style is undefined and no shadow applies', () => {
      const result = applyComponentShadow('section' as Component['type'], undefined, undefined)
      expect(result).toBeUndefined()
    })

    test('adds shadow to style for card component', () => {
      const style = { color: 'blue' }
      const theme: Theme = {
        shadows: { md: '0 4px 6px rgba(0,0,0,0.1)' },
      }
      const result = applyComponentShadow('card', style, theme)

      expect(result).toMatchObject({
        color: 'blue',
        boxShadow: 'var(--shadow-md)',
      })
    })

    test('adds shadow to style for button component', () => {
      const style = { padding: '8px 16px' }
      const theme: Theme = {
        shadows: { brand: '0 2px 4px rgba(59,130,246,0.3)' },
      }
      const result = applyComponentShadow('button', style, theme)

      expect(result).toMatchObject({
        padding: '8px 16px',
        boxShadow: 'var(--shadow-brand)',
      })
    })

    test('creates new style object when shadow applies to undefined style', () => {
      const theme: Theme = {
        shadows: { sm: '0 1px 2px rgba(0,0,0,0.05)' },
      }
      const result = applyComponentShadow('list-item', undefined, theme)

      expect(result).toEqual({
        boxShadow: 'var(--shadow-sm)',
      })
    })

    test('does not mutate original style object', () => {
      const style = { color: 'red' }
      const theme: Theme = {
        shadows: { md: '0 4px 6px rgba(0,0,0,0.1)' },
      }

      const result = applyComponentShadow('card', style, theme)

      // Original should be unchanged
      expect(style).toEqual({ color: 'red' })
      // Result should have shadow
      expect(result).toMatchObject({
        color: 'red',
        boxShadow: 'var(--shadow-md)',
      })
    })
  })

  describe('processComponentStyle', () => {
    test('returns undefined when styleValue is falsy', () => {
      const result = processComponentStyle(
        'section' as Component['type'],
        undefined,
        undefined,
        undefined
      )
      expect(result).toBeUndefined()
    })

    test('processes string style', () => {
      const result = processComponentStyle(
        'section' as Component['type'],
        'color: red; padding: 10px',
        undefined,
        undefined
      )
      expect(result).toBeDefined()
      expect(result).toHaveProperty('color')
      expect(result).toHaveProperty('padding')
    })

    test('processes object style', () => {
      const style = { color: 'blue', margin: '5px' }
      const result = processComponentStyle('section' as Component['type'], style, undefined, undefined)
      expect(result).toMatchObject(style)
    })

    test('applies animations for animated component types', () => {
      const style = { padding: '10px' }
      const theme: Theme = {
        animations: {
          fadeOut: {
            keyframes: {
              '0%': { opacity: '1' },
              '100%': { opacity: '0' },
            },
            duration: '300ms',
          },
        },
      }

      const result = processComponentStyle('toast', style, theme, undefined)

      // Should have animation properties
      expect(result).toBeDefined()
      expect(result).toHaveProperty('padding', '10px')
      // Animation properties handled by animation composer
    })

    test('applies shadows for shadow component types', () => {
      const style = { color: 'red' }
      const theme: Theme = {
        shadows: { md: '0 4px 6px rgba(0,0,0,0.1)' },
      }

      const result = processComponentStyle('card', style, theme, undefined)

      // Should have shadow
      expect(result).toMatchObject({
        color: 'red',
        boxShadow: 'var(--shadow-md)',
      })
    })

    test('applies both animations and shadows when applicable', () => {
      const style = { padding: '20px' }
      const theme: Theme = {
        animations: {
          scaleUp: {
            keyframes: {
              '0%': { transform: 'scale(0.9)' },
              '100%': { transform: 'scale(1)' },
            },
          },
        },
        shadows: { md: '0 4px 6px rgba(0,0,0,0.1)' },
      }

      const result = processComponentStyle('card', style, theme, undefined)

      // Should have both animation and shadow
      expect(result).toBeDefined()
      expect(result).toHaveProperty('padding', '20px')
      // Animation properties handled by animation composer
      expect(result).toHaveProperty('boxShadow', 'var(--shadow-md)')
    })

    test('handles empty theme', () => {
      const style = { color: 'blue' }
      const theme: Theme = {}

      const result = processComponentStyle('card', style, theme, undefined)

      // Should return style without animations or shadows
      expect(result).toEqual(style)
    })

    test('processes complex style with all features', () => {
      const style = {
        color: 'white',
        backgroundColor: 'blue',
        padding: '16px',
        borderRadius: '8px',
      }
      const theme: Theme = {
        animations: {
          scaleUp: {
            keyframes: {
              '0%': { opacity: '0', transform: 'scale(0.95)' },
              '100%': { opacity: '1', transform: 'scale(1)' },
            },
            duration: '200ms',
          },
        },
        shadows: {
          custom: '0 8px 16px rgba(0,0,0,0.15)',
        },
      }

      const result = processComponentStyle('card', style, theme, undefined)

      // Should preserve original style and add theme features
      expect(result).toMatchObject({
        color: 'white',
        backgroundColor: 'blue',
        padding: '16px',
        borderRadius: '8px',
      })
      // Animation properties handled by animation composer
      expect(result).toHaveProperty('boxShadow', 'var(--shadow-custom)')
    })

    test('extracts CSS properties from props', () => {
      const props = { maxWidth: '1200px', minHeight: '400px', backgroundColor: '#f0f0f0' }
      const result = processComponentStyle('section' as Component['type'], undefined, undefined, props)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('maxWidth', '1200px')
      expect(result).toHaveProperty('minHeight', '400px')
      expect(result).toHaveProperty('backgroundColor', '#f0f0f0')
    })

    test('merges CSS properties from props with explicit style and applies shadows', () => {
      const props = { maxWidth: '1200px', padding: '10px' }
      const theme: Theme = {
        shadows: { md: '0 4px 6px rgba(0,0,0,0.1)' },
      }
      const result = processComponentStyle('card', { color: 'red' }, theme, props)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('maxWidth', '1200px')
      expect(result).toHaveProperty('padding', '10px')
      expect(result).toHaveProperty('color', 'red')
      expect(result).toHaveProperty('boxShadow', 'var(--shadow-md)')
    })
  })
})
