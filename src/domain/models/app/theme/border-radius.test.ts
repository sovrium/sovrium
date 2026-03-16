/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { BorderRadiusConfigSchema } from './border-radius'

describe('BorderRadiusConfigSchema', () => {
  test('APP-THEME-RADIUS-001: should accept radius scale from none to 3xl', () => {
    // GIVEN: Progressive rounding scale
    const borderRadius = {
      none: '0',
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      '2xl': '1rem',
      '3xl': '1.5rem',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BorderRadiusConfigSchema)(borderRadius)

    // THEN: All radius levels should be accepted
    expect(result.none).toBe('0')
    expect(result.sm).toBe('0.125rem')
    expect(result['3xl']).toBe('1.5rem')
  })

  test('APP-THEME-RADIUS-002: should accept none with value 0', () => {
    // GIVEN: Sharp corners (no rounding)
    const borderRadius = {
      none: '0',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BorderRadiusConfigSchema)(borderRadius)

    // THEN: Zero radius should be accepted
    expect(result.none).toBe('0')
  })

  test('APP-THEME-RADIUS-003: should accept full with value 9999px', () => {
    // GIVEN: Perfect circles or pills
    const borderRadius = {
      full: '9999px',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BorderRadiusConfigSchema)(borderRadius)

    // THEN: Full rounding should be accepted
    expect(result.full).toBe('9999px')
  })

  test('APP-THEME-RADIUS-004: should accept rem units', () => {
    // GIVEN: Radius with rem units
    const borderRadius = {
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BorderRadiusConfigSchema)(borderRadius)

    // THEN: Rem-based values should be accepted
    expect(result.sm).toBe('0.125rem')
    expect(result.md).toBe('0.375rem')
    expect(result.lg).toBe('0.5rem')
  })

  test('APP-THEME-RADIUS-005: should accept semantic naming with kebab-case', () => {
    // GIVEN: Multi-word kebab-case names
    const borderRadius = {
      'button-radius': '0.5rem',
      'card-radius': '1rem',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BorderRadiusConfigSchema)(borderRadius)

    // THEN: Kebab-case names should be accepted
    expect(result['button-radius']).toBe('0.5rem')
    expect(result['card-radius']).toBe('1rem')
  })

  test('APP-THEME-RADIUS-006: should accept complete radius system', () => {
    // GIVEN: Complete rounding system
    const borderRadius = {
      none: '0',
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      '2xl': '1rem',
      '3xl': '1.5rem',
      full: '9999px',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BorderRadiusConfigSchema)(borderRadius)

    // THEN: All 8 radius tokens should be accepted
    expect(Object.keys(result)).toHaveLength(8)
  })
})
