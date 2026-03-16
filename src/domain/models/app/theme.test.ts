/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ThemeSchema } from './theme'

describe('ThemeSchema', () => {
  test('should accept theme with only colors defined', () => {
    // GIVEN: Minimal theme with only colors
    const theme = {
      colors: {
        primary: '#007bff',
        secondary: '#6c757d',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ThemeSchema)(theme)

    // THEN: Theme should be accepted with only colors
    expect(result.colors).toEqual({
      primary: '#007bff',
      secondary: '#6c757d',
    })
    expect(result.fonts).toBeUndefined()
    expect(result.spacing).toBeUndefined()
  })

  test('should accept theme with colors and fonts', () => {
    // GIVEN: Basic branding with colors and fonts
    const theme = {
      colors: {
        primary: '#007bff',
        text: '#212529',
      },
      fonts: {
        body: {
          family: 'Inter',
          fallback: 'sans-serif',
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ThemeSchema)(theme)

    // THEN: Theme with colors and fonts should be accepted
    expect(result.colors?.primary).toBe('#007bff')
    expect(result.fonts?.body?.family).toBe('Inter')
  })

  test('should accept theme with colors, fonts, and spacing', () => {
    // GIVEN: Core design system with 3 categories
    const theme = {
      colors: {
        primary: '#007bff',
      },
      fonts: {
        body: {
          family: 'Inter',
        },
      },
      spacing: {
        section: '4rem',
        gap: '1rem',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ThemeSchema)(theme)

    // THEN: All 3 categories should be accepted
    expect(result.colors).toBeDefined()
    expect(result.fonts).toBeDefined()
    expect(result.spacing).toBeDefined()
  })

  test('should accept complete theme with all 7 design token categories', () => {
    // GIVEN: Comprehensive theme with all categories
    const theme = {
      colors: {
        primary: '#007bff',
      },
      fonts: {
        body: {
          family: 'Inter',
        },
      },
      spacing: {
        section: '4rem',
      },
      animations: {
        fadeIn: true,
      },
      breakpoints: {
        md: '768px',
      },
      shadows: {
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      },
      borderRadius: {
        md: '0.375rem',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ThemeSchema)(theme)

    // THEN: All 7 categories should be accepted
    expect(result.colors).toBeDefined()
    expect(result.fonts).toBeDefined()
    expect(result.spacing).toBeDefined()
    expect(result.animations).toBeDefined()
    expect(result.breakpoints).toBeDefined()
    expect(result.shadows).toBeDefined()
    expect(result.borderRadius).toBeDefined()
  })

  test('should accept theme with breakpoints for responsive system', () => {
    // GIVEN: Responsive breakpoints configuration
    const theme = {
      breakpoints: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ThemeSchema)(theme)

    // THEN: Breakpoints should be accepted
    expect(result.breakpoints).toEqual({
      sm: '640px',
      md: '768px',
      lg: '1024px',
    })
  })

  test('should accept theme with animations for interaction system', () => {
    // GIVEN: Animation library
    const theme = {
      animations: {
        fadeIn: true,
        slideIn: 'slide-in 0.5s ease-out',
        pulse: {
          duration: '2s',
          easing: 'ease-in-out',
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ThemeSchema)(theme)

    // THEN: All animation types should be accepted
    expect(result.animations?.fadeIn).toBe(true)
    expect(result.animations?.slideIn).toBe('slide-in 0.5s ease-out')
    expect(result.animations?.pulse).toEqual({
      duration: '2s',
      easing: 'ease-in-out',
    })
  })

  test('should accept theme with semantic naming and progressive scales', () => {
    // GIVEN: Theme following design system best practices
    const theme = {
      colors: {
        primary: '#007bff',
        'primary-hover': '#0056b3',
        'primary-light': '#e7f1ff',
      },
      spacing: {
        gap: '1rem',
        gapSmall: '0.5rem',
        gapLarge: '1.5rem',
      },
      shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ThemeSchema)(theme)

    // THEN: Semantic naming and scales should be accepted
    expect(result.colors?.primary).toBe('#007bff')
    expect(result.colors?.['primary-hover']).toBe('#0056b3')
    expect(result.spacing?.gap).toBe('1rem')
    expect(result.shadows?.sm).toBeDefined()
    expect(result.shadows?.md).toBeDefined()
    expect(result.shadows?.lg).toBeDefined()
  })

  test('should accept theme with Tailwind-compatible tokens', () => {
    // GIVEN: Tailwind-style spacing and breakpoints
    const theme = {
      spacing: {
        section: '4rem',
        container: '80rem',
      },
      breakpoints: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ThemeSchema)(theme)

    // THEN: Tailwind-compatible values should be accepted
    expect(result.spacing?.section).toBe('4rem')
    expect(result.spacing?.container).toBe('80rem')
    expect(result.breakpoints?.sm).toBe('640px')
  })

  test('should accept empty theme object', () => {
    // GIVEN: Empty theme (all categories optional)
    const theme = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ThemeSchema)(theme)

    // THEN: Empty theme should be accepted
    expect(result).toEqual({})
  })
})
