/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { PercentageFieldSchema } from './percentage-field'

describe('PercentageFieldSchema', () => {
  test('should accept valid percentage field configuration', () => {
    // Given: A valid input
    const field = {
      id: 1,
      name: 'discount_rate',
      type: 'percentage' as const,
      required: true,
      precision: 1,
      min: 0,
      max: 100,
      default: 10.0,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(PercentageFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept percentage field without precision (optional)', () => {
    // Given: A valid configuration
    const field = {
      id: 1,
      name: 'completion',
      type: 'percentage' as const,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(PercentageFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept completion percentage', () => {
    // Given: A valid configuration
    const field = {
      id: 2,
      name: 'completion',
      type: 'percentage' as const,
      required: true,
      precision: 0,
      min: 0,
      max: 100,
      default: 0,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(PercentageFieldSchema)(field)
    expect(result.precision).toBe(0)
    expect(result.default).toBe(0)
  })

  test('should accept minimal percentage field configuration', () => {
    // Given: A minimal valid configuration
    const field = {
      id: 1,
      name: 'rate',
      type: 'percentage' as const,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(PercentageFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should reject wrong type value', () => {
    // Given: A configuration with wrong type
    const field = {
      id: 1,
      name: 'discount_rate',
      type: 'decimal' as const,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      // @ts-expect-error - Testing wrong type value
      Schema.decodeSync(PercentageFieldSchema)(field)
    }).toThrow()
  })

  test('should reject precision less than 0', () => {
    // Given: An invalid input
    const field = {
      id: 1,
      name: 'rate',
      type: 'percentage' as const,
      precision: -1,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      Schema.decodeSync(PercentageFieldSchema)(field)
    }).toThrow()
  })

  test('should reject precision greater than 10', () => {
    // Given: An invalid input
    const field = {
      id: 1,
      name: 'rate',
      type: 'percentage' as const,
      precision: 11,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      Schema.decodeSync(PercentageFieldSchema)(field)
    }).toThrow()
  })

  test('should accept percentage with decimal precision', () => {
    // Given: A valid configuration
    const field = {
      id: 1,
      name: 'tax_rate',
      type: 'percentage' as const,
      precision: 2,
      default: 8.25,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(PercentageFieldSchema)(field)
    expect(result.precision).toBe(2)
    expect(result.default).toBe(8.25)
  })

  test('should accept 0-100 range for typical percentages', () => {
    // Given: A valid configuration
    const field = {
      id: 1,
      name: 'progress',
      type: 'percentage' as const,
      min: 0,
      max: 100,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(PercentageFieldSchema)(field)
    expect(result.min).toBe(0)
    expect(result.max).toBe(100)
  })
})
