/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  applySpacingStyles,
  getContainerSpacingStyle,
  getFlexSpacingStyle,
  getSectionSpacingStyle,
} from './spacing-resolver'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

describe('Spacing Resolver', () => {
  describe('getSectionSpacingStyle', () => {
    test('returns padding when type is section and theme has section spacing', () => {
      const theme: Theme = {
        spacing: {
          section: '2rem',
        },
      }
      const result = getSectionSpacingStyle('section', theme)
      expect(result).toEqual({ padding: '2rem' })
    })

    test('returns undefined when type is not section', () => {
      const theme: Theme = {
        spacing: {
          section: '2rem',
        },
      }
      const result = getSectionSpacingStyle('container' as Component['type'], theme)
      expect(result).toBeUndefined()
    })

    test('returns undefined when theme has no section spacing', () => {
      const theme: Theme = {
        spacing: {},
      }
      const result = getSectionSpacingStyle('section', theme)
      expect(result).toBeUndefined()
    })

    test('returns undefined when theme is undefined', () => {
      const result = getSectionSpacingStyle('section', undefined)
      expect(result).toBeUndefined()
    })

    test('returns undefined when section spacing is not a CSS value', () => {
      const theme: Theme = {
        spacing: {
          section: 'py-16' as never, // Tailwind class, not CSS value
        },
      }
      const result = getSectionSpacingStyle('section', theme)
      expect(result).toBeUndefined()
    })
  })

  describe('getContainerSpacingStyle', () => {
    test('returns maxWidth and margin when type is container and theme has container spacing', () => {
      const theme: Theme = {
        spacing: {
          container: '1200px',
        },
      }
      const result = getContainerSpacingStyle('container', theme)
      expect(result).toEqual({ maxWidth: '1200px', margin: '0 auto' })
    })

    test('returns undefined when type is not container', () => {
      const theme: Theme = {
        spacing: {
          container: '1200px',
        },
      }
      const result = getContainerSpacingStyle('section' as Component['type'], theme)
      expect(result).toBeUndefined()
    })

    test('returns undefined when theme has no container spacing', () => {
      const theme: Theme = {
        spacing: {},
      }
      const result = getContainerSpacingStyle('container', theme)
      expect(result).toBeUndefined()
    })

    test('returns undefined when container spacing is not a CSS value', () => {
      const theme: Theme = {
        spacing: {
          container: 'max-w-7xl' as never, // Tailwind class, not CSS value
        },
      }
      const result = getContainerSpacingStyle('container', theme)
      expect(result).toBeUndefined()
    })
  })

  describe('getFlexSpacingStyle', () => {
    test('returns display flex and gap when type is flex and theme has gap spacing', () => {
      const theme: Theme = {
        spacing: {
          gap: '1rem',
        },
      }
      const result = getFlexSpacingStyle('flex', theme)
      expect(result).toEqual({ display: 'flex', gap: '1rem' })
    })

    test('returns undefined when type is not flex', () => {
      const theme: Theme = {
        spacing: {
          gap: '1rem',
        },
      }
      const result = getFlexSpacingStyle('section' as Component['type'], theme)
      expect(result).toBeUndefined()
    })

    test('returns undefined when theme has no gap spacing', () => {
      const theme: Theme = {
        spacing: {},
      }
      const result = getFlexSpacingStyle('flex', theme)
      expect(result).toBeUndefined()
    })

    test('returns undefined when gap spacing is not a CSS value', () => {
      const theme: Theme = {
        spacing: {
          gap: 'space-x-4' as never, // Tailwind class, not CSS value
        },
      }
      const result = getFlexSpacingStyle('flex', theme)
      expect(result).toBeUndefined()
    })
  })

  describe('applySpacingStyles', () => {
    test('applies section spacing to style prop', () => {
      const baseProps = { id: 'test' }
      const theme: Theme = {
        spacing: {
          section: '2rem',
        },
      }
      const result = applySpacingStyles('section', baseProps, theme)
      expect(result).toEqual({
        id: 'test',
        style: { padding: '2rem' },
      })
    })

    test('applies container spacing to style prop', () => {
      const baseProps = { id: 'test' }
      const theme: Theme = {
        spacing: {
          container: '1200px',
        },
      }
      const result = applySpacingStyles('container', baseProps, theme)
      expect(result).toEqual({
        id: 'test',
        style: { maxWidth: '1200px', margin: '0 auto' },
      })
    })

    test('applies flex spacing to style prop', () => {
      const baseProps = { id: 'test' }
      const theme: Theme = {
        spacing: {
          gap: '1rem',
        },
      }
      const result = applySpacingStyles('flex', baseProps, theme)
      expect(result).toEqual({
        id: 'test',
        style: { display: 'flex', gap: '1rem' },
      })
    })

    test('merges with existing style prop', () => {
      const baseProps = { id: 'test', style: { color: 'red' } }
      const theme: Theme = {
        spacing: {
          section: '2rem',
        },
      }
      const result = applySpacingStyles('section', baseProps, theme)
      expect(result).toEqual({
        id: 'test',
        style: { color: 'red', padding: '2rem' },
      })
    })

    test('returns baseProps unchanged when no spacing applies', () => {
      const baseProps = { id: 'test' }
      const theme: Theme = {
        spacing: {},
      }
      const result = applySpacingStyles('section', baseProps, theme)
      expect(result).toEqual(baseProps)
    })

    test('applies multiple spacing styles in order', () => {
      const baseProps = { id: 'test' }
      // Create a scenario where multiple might apply (though typically only one type matches)
      const theme: Theme = {
        spacing: {
          section: '2rem',
          container: '1200px',
          gap: '1rem',
        },
      }

      // Only section spacing should apply for 'section' type
      const resultSection = applySpacingStyles('section', baseProps, theme)
      expect(resultSection).toEqual({
        id: 'test',
        style: { padding: '2rem' },
      })

      // Only container spacing should apply for 'container' type
      const resultContainer = applySpacingStyles('container', baseProps, theme)
      expect(resultContainer).toEqual({
        id: 'test',
        style: { maxWidth: '1200px', margin: '0 auto' },
      })

      // Only flex spacing should apply for 'flex' type
      const resultFlex = applySpacingStyles('flex', baseProps, theme)
      expect(resultFlex).toEqual({
        id: 'test',
        style: { display: 'flex', gap: '1rem' },
      })
    })

    test('preserves other baseProps properties', () => {
      const baseProps = {
        id: 'test',
        className: 'my-class',
        'data-testid': 'component',
        style: { color: 'blue' },
      }
      const theme: Theme = {
        spacing: {
          section: '2rem',
        },
      }
      const result = applySpacingStyles('section', baseProps, theme)
      expect(result).toEqual({
        id: 'test',
        className: 'my-class',
        'data-testid': 'component',
        style: { color: 'blue', padding: '2rem' },
      })
    })
  })
})
