/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  buildButtonClasses,
  buildButtonPrimaryClasses,
  buildBadgeBorderRadius,
  generateComponentsLayer,
  generateUtilitiesLayer,
} from './component-layer-generators'
import type { Theme } from '@/domain/models/app/theme'

describe('Component Layer Generators', () => {
  describe('buildButtonClasses', () => {
    test('includes base button classes', () => {
      const classes = buildButtonClasses(false, false)

      expect(classes).toContain('inline-flex')
      expect(classes).toContain('items-center')
      expect(classes).toContain('justify-center')
      expect(classes).toContain('rounded-md')
      expect(classes).toContain('px-4')
      expect(classes).toContain('py-2')
      expect(classes).toContain('font-medium')
      expect(classes).toContain('transition-colors')
    })

    test('uses default blue colors when no primary color', () => {
      const classes = buildButtonClasses(false, false)

      expect(classes).toContain('bg-blue-600')
      expect(classes).toContain('text-white')
      expect(classes).toContain('hover:bg-blue-700')
    })

    test('uses primary color when defined', () => {
      const classes = buildButtonClasses(true, false)

      expect(classes).toContain('bg-primary')
      expect(classes).toContain('text-white')
      expect(classes).not.toContain('hover:bg-primary-hover')
    })

    test('uses primary and hover colors when both defined', () => {
      const classes = buildButtonClasses(true, true)

      expect(classes).toContain('bg-primary')
      expect(classes).toContain('text-white')
      expect(classes).toContain('hover:bg-primary-hover')
    })
  })

  describe('buildButtonPrimaryClasses', () => {
    test('returns default blue colors when no primary', () => {
      const classes = buildButtonPrimaryClasses(false, false)

      expect(classes).toBe('bg-blue-600 text-white hover:bg-blue-700')
    })

    test('returns primary color only when hover not defined', () => {
      const classes = buildButtonPrimaryClasses(true, false)

      expect(classes).toBe('bg-primary text-white')
    })

    test('returns primary and hover colors when both defined', () => {
      const classes = buildButtonPrimaryClasses(true, true)

      expect(classes).toBe('bg-primary text-white hover:bg-primary-hover')
    })
  })

  describe('buildBadgeBorderRadius', () => {
    test('uses rounded-full when theme has no full radius', () => {
      const theme: Theme = {}

      const result = buildBadgeBorderRadius(theme)

      expect(result).toBe('@apply rounded-full;')
    })

    test('uses CSS variable when theme defines full radius', () => {
      const theme: Theme = {
        borderRadius: {
          full: '9999px',
        },
      }

      const result = buildBadgeBorderRadius(theme)

      expect(result).toBe('border-radius: var(--radius-full);')
    })

    test('uses rounded-full when theme is undefined', () => {
      const result = buildBadgeBorderRadius(undefined)

      expect(result).toBe('@apply rounded-full;')
    })
  })

  describe('generateComponentsLayer', () => {
    test('generates components layer with default styles', () => {
      const result = generateComponentsLayer(undefined)

      expect(result).toContain('@layer components')
      expect(result).toContain('.container-page')
      expect(result).toContain('.card')
      expect(result).toContain('.badge')
      expect(result).toContain('button {')
      expect(result).toContain('.btn {')
      expect(result).toContain('.btn-primary')
    })

    test('includes container-page utility class', () => {
      const result = generateComponentsLayer(undefined)

      expect(result).toContain('.container-page')
      expect(result).toContain('mx-auto')
      expect(result).toContain('max-w-4xl')
      expect(result).toContain('px-4')
      expect(result).toContain('py-8')
    })

    test('includes card component styles', () => {
      const result = generateComponentsLayer(undefined)

      expect(result).toContain('.card')
      expect(result).toContain('rounded-lg')
      expect(result).toContain('border')
      expect(result).toContain('bg-white')
      expect(result).toContain('p-6')
      expect(result).toContain('shadow-sm')
    })

    test('includes badge component with default border-radius', () => {
      const result = generateComponentsLayer(undefined)

      expect(result).toContain('.badge')
      expect(result).toContain('@apply rounded-full;')
    })

    test('uses theme border-radius for badge when defined', () => {
      const theme: Theme = {
        borderRadius: {
          full: '9999px',
        },
      }

      const result = generateComponentsLayer(theme)

      expect(result).toContain('.badge')
      expect(result).toContain('border-radius: var(--radius-full);')
    })

    test('applies primary colors to button elements', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
          'primary-hover': '#2563eb',
        },
      }

      const result = generateComponentsLayer(theme)

      expect(result).toContain('bg-primary')
      expect(result).toContain('hover:bg-primary-hover')
    })

    test('applies theme colors to btn-primary utility', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
          'primary-hover': '#2563eb',
        },
      }

      const result = generateComponentsLayer(theme)

      expect(result).toContain('.btn-primary')
      expect(result).toContain('bg-primary')
      expect(result).toContain('hover:bg-primary-hover')
    })

    test('uses default colors when theme has no primary', () => {
      const theme: Theme = {}

      const result = generateComponentsLayer(theme)

      expect(result).toContain('bg-blue-600')
      expect(result).toContain('hover:bg-blue-700')
    })

    test('generates complete components layer with all features', () => {
      const theme: Theme = {
        colors: {
          primary: '#3b82f6',
          'primary-hover': '#2563eb',
        },
        borderRadius: {
          full: '9999px',
        },
      }

      const result = generateComponentsLayer(theme)

      // Layout utilities
      expect(result).toContain('.container-page')

      // Components
      expect(result).toContain('.card')
      expect(result).toContain('.badge')

      // Badge with theme border-radius
      expect(result).toContain('border-radius: var(--radius-full);')

      // Buttons with theme colors
      expect(result).toContain('button {')
      expect(result).toContain('.btn {')
      expect(result).toContain('.btn-primary')
      expect(result).toContain('bg-primary')
      expect(result).toContain('hover:bg-primary-hover')
    })
  })

  describe('generateUtilitiesLayer', () => {
    test('generates utilities layer', () => {
      const result = generateUtilitiesLayer()

      expect(result).toContain('@layer utilities')
    })

    test('includes text-balance utility', () => {
      const result = generateUtilitiesLayer()

      expect(result).toContain('.text-balance')
      expect(result).toContain('text-wrap: balance;')
    })

    test('includes text-center safelist utility', () => {
      const result = generateUtilitiesLayer()

      expect(result).toContain('.text-center')
      expect(result).toContain('text-align: center;')
    })

    test('includes shadow-none override', () => {
      const result = generateUtilitiesLayer()

      expect(result).toContain('.shadow-none')
      expect(result).toContain('box-shadow: none !important;')
    })

    test('includes click animation CSS', () => {
      const result = generateUtilitiesLayer()

      // Click animations should be included (generated by generateClickAnimationCSS)
      // We just verify the layer structure is correct
      expect(result).toContain('@layer utilities')
    })

    test('maintains consistent structure', () => {
      const result = generateUtilitiesLayer()

      // Check opening and closing braces
      expect(result.startsWith('@layer utilities {')).toBe(true)
      expect(result.endsWith('}')).toBe(true)
    })
  })
})
