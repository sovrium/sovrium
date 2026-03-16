/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ShadowsConfigSchema } from './shadows'

describe('ShadowsConfigSchema', () => {
  test('APP-THEME-SHADOWS-001: should accept shadow scale from sm to 2xl', () => {
    // GIVEN: Elevation system from subtle to dramatic
    const shadows = {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
      '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ShadowsConfigSchema)(shadows)

    // THEN: All elevation levels should be accepted
    expect(result.sm).toBe('0 1px 2px 0 rgb(0 0 0 / 0.05)')
    expect(result['2xl']).toBe('0 25px 50px -12px rgb(0 0 0 / 0.25)')
  })

  test('should accept inset shadows', () => {
    // GIVEN: Inset shadow value
    const shadows = {
      inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ShadowsConfigSchema)(shadows)

    // THEN: Inset shadow should be accepted
    expect(result.inner).toBe('inset 0 2px 4px 0 rgb(0 0 0 / 0.05)')
  })

  test('should accept none shadow', () => {
    // GIVEN: No shadow value
    const shadows = {
      none: '0 0 #0000',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ShadowsConfigSchema)(shadows)

    // THEN: None shadow should be accepted
    expect(result.none).toBe('0 0 #0000')
  })

  test('should accept kebab-case keys', () => {
    // GIVEN: Multi-word shadow names
    const shadows = {
      'card-shadow': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      'button-hover': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ShadowsConfigSchema)(shadows)

    // THEN: Kebab-case keys should be accepted
    expect(result['card-shadow']).toBe('0 4px 6px -1px rgb(0 0 0 / 0.1)')
  })

  test('should accept complete shadow system', () => {
    // GIVEN: Complete shadow system
    const shadows = {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
      '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
      none: '0 0 #0000',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ShadowsConfigSchema)(shadows)

    // THEN: All shadows should be accepted
    expect(Object.keys(result)).toHaveLength(7)
  })
})
