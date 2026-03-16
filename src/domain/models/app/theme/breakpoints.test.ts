/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { BreakpointsConfigSchema } from './breakpoints'

describe('BreakpointsConfigSchema', () => {
  test('APP-THEME-BREAKPOINTS-001: should accept standard Tailwind breakpoints', () => {
    // GIVEN: Common responsive breakpoints
    const breakpoints = {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BreakpointsConfigSchema)(breakpoints)

    // THEN: All breakpoints should be accepted
    expect(result.sm).toBe('640px')
    expect(result.md).toBe('768px')
    expect(result.lg).toBe('1024px')
    expect(result.xl).toBe('1280px')
    expect(result['2xl']).toBe('1536px')
  })

  test('should accept lowercase alphanumeric keys', () => {
    // GIVEN: Alphanumeric breakpoint keys
    const breakpoints = {
      sm: '640px',
      md: '768px',
      '2xl': '1536px',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BreakpointsConfigSchema)(breakpoints)

    // THEN: Keys should be accepted
    expect(Object.keys(result)).toHaveLength(3)
  })

  test('should accept pixel values', () => {
    // GIVEN: Breakpoints in pixels
    const breakpoints = {
      mobile: '640px',
      tablet: '768px',
      desktop: '1280px',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BreakpointsConfigSchema)(breakpoints)

    // THEN: Pixel values should be accepted
    expect(result.mobile).toBe('640px')
    expect(result.tablet).toBe('768px')
    expect(result.desktop).toBe('1280px')
  })

  test('should reject non-pixel values', () => {
    // GIVEN: Invalid breakpoint values (not in pixels)
    const breakpoints = {
      sm: '40rem' as any,
      md: '768' as any,
    }

    // WHEN: Schema validation is attempted
    // THEN: Non-pixel values should cause validation errors
    expect(() => Schema.decodeUnknownSync(BreakpointsConfigSchema)(breakpoints)).toThrow()
  })

  test('should reject keys with uppercase or hyphens', () => {
    // GIVEN: Invalid keys (uppercase, hyphens)
    const breakpoints = {
      SM: '640px',
      'medium-screen': '768px',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BreakpointsConfigSchema)(breakpoints)

    // THEN: Invalid keys should be filtered out
    expect(result.SM).toBeUndefined()
    expect(result['medium-screen']).toBeUndefined()
  })
})
