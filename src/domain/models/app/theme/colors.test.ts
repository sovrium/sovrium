/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ColorNameSchema, ColorValueSchema, ColorsConfigSchema } from './colors'

describe('ColorNameSchema', () => {
  test('should accept valid kebab-case color names', () => {
    // GIVEN: Valid kebab-case color names
    const names = ['primary', 'primary-hover', 'gray-500', 'text-muted'] as const

    // WHEN: Schema validation is performed on each
    const results = names.map((name) => Schema.decodeUnknownSync(ColorNameSchema)(name))

    // THEN: All names should be accepted
    expect(results).toEqual([...names])
  })

  test('should reject invalid color names', () => {
    // GIVEN: Invalid color names (camelCase, spaces, uppercase)
    const invalidNames = ['primaryColor', 'text_muted', 'Background Light', 'BORDER']

    // WHEN: Schema validation is performed on each
    // THEN: All should be rejected
    invalidNames.forEach((name) => {
      expect(() => Schema.decodeUnknownSync(ColorNameSchema)(name)).toThrow()
    })
  })
})

describe('ColorValueSchema', () => {
  test('APP-THEME-COLORS-001: should accept 6-digit hex colors', () => {
    // GIVEN: A color with 6-digit hex value
    const color = '#007bff'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ColorValueSchema)(color)

    // THEN: Hex color should be accepted
    expect(result).toBe('#007bff')
  })

  test('APP-THEME-COLORS-002: should accept 8-digit hex colors with alpha', () => {
    // GIVEN: A color with 8-digit hex value (with transparency)
    const color = '#007bff80'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ColorValueSchema)(color)

    // THEN: Hex color with alpha should be accepted
    expect(result).toBe('#007bff80')
  })

  test('APP-THEME-COLORS-003: should accept rgb() format', () => {
    // GIVEN: A color in rgb() format
    const color = 'rgb(255, 0, 0)'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ColorValueSchema)(color)

    // THEN: RGB color should be accepted
    expect(result).toBe('rgb(255, 0, 0)')
  })

  test('APP-THEME-COLORS-004: should accept rgba() format with alpha', () => {
    // GIVEN: A color in rgba() format with transparency
    const color = 'rgba(255, 0, 0, 0.5)'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ColorValueSchema)(color)

    // THEN: RGBA color should be accepted
    expect(result).toBe('rgba(255, 0, 0, 0.5)')
  })

  test('APP-THEME-COLORS-005: should accept hsl() format', () => {
    // GIVEN: A color in hsl() format
    const color = 'hsl(210, 100%, 50%)'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ColorValueSchema)(color)

    // THEN: HSL color should be accepted
    expect(result).toBe('hsl(210, 100%, 50%)')
  })

  test('APP-THEME-COLORS-006: should accept hsla() format with alpha', () => {
    // GIVEN: A color in hsla() format with transparency
    const color = 'hsla(210, 100%, 50%, 0.8)'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ColorValueSchema)(color)

    // THEN: HSLA color should be accepted
    expect(result).toBe('hsla(210, 100%, 50%, 0.8)')
  })

  test('should reject invalid color formats', () => {
    // GIVEN: Invalid color values
    const invalidColors = ['blue', '#gg0000', 'notacolor']

    // WHEN: Schema validation is performed on each
    // THEN: All should be rejected
    invalidColors.forEach((color) => {
      expect(() => Schema.decodeUnknownSync(ColorValueSchema)(color)).toThrow()
    })
  })
})

describe('ColorsConfigSchema', () => {
  test('APP-THEME-COLORS-007: should accept color variants with suffixes', () => {
    // GIVEN: Colors with variant naming (base, hover, light, dark)
    const colors = {
      primary: '#007bff',
      'primary-hover': '#0056b3',
      'primary-light': '#e7f1ff',
      'primary-dark': '#003d7a',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ColorsConfigSchema)(colors)

    // THEN: All color variants should be accepted
    expect(result.primary).toBe('#007bff')
    expect(result['primary-hover']).toBe('#0056b3')
    expect(result['primary-light']).toBe('#e7f1ff')
    expect(result['primary-dark']).toBe('#003d7a')
  })

  test('APP-THEME-COLORS-008: should accept numbered gray scale', () => {
    // GIVEN: Gray scale with numbered variants (100-900)
    const colors = {
      'gray-100': '#f8f9fa',
      'gray-300': '#dee2e6',
      'gray-500': '#adb5bd',
      'gray-700': '#495057',
      'gray-900': '#212529',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ColorsConfigSchema)(colors)

    // THEN: All gray scale colors should be accepted
    expect(result['gray-100']).toBe('#f8f9fa')
    expect(result['gray-500']).toBe('#adb5bd')
    expect(result['gray-900']).toBe('#212529')
  })

  test('APP-THEME-COLORS-009: should accept comprehensive color system', () => {
    // GIVEN: Complete color system with semantic colors
    const colors = {
      primary: '#007bff',
      secondary: '#6c757d',
      success: '#28a745',
      danger: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8',
      light: '#f8f9fa',
      dark: '#343a40',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ColorsConfigSchema)(colors)

    // THEN: All semantic colors should be accepted
    expect(Object.keys(result)).toHaveLength(8)
    expect(result.primary).toBe('#007bff')
    expect(result.success).toBe('#28a745')
    expect(result.danger).toBe('#dc3545')
  })

  test('should accept empty colors config', () => {
    // GIVEN: An empty colors config
    const colors = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ColorsConfigSchema)(colors)

    // THEN: Empty config should be valid
    expect(result).toEqual({})
  })

  test('should accept mixed color formats', () => {
    // GIVEN: Colors in different formats (hex, rgb, hsl)
    const colors = {
      primary: '#007bff',
      danger: 'rgb(220, 53, 69)',
      success: 'hsl(134, 61%, 41%)',
      overlay: 'rgba(0, 0, 0, 0.5)',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ColorsConfigSchema)(colors)

    // THEN: All formats should be accepted
    expect(result.primary).toBe('#007bff')
    expect(result.danger).toBe('rgb(220, 53, 69)')
    expect(result.success).toBe('hsl(134, 61%, 41%)')
    expect(result.overlay).toBe('rgba(0, 0, 0, 0.5)')
  })
})
