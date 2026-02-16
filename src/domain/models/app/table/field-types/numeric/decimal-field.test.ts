/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { DecimalFieldSchema } from './decimal-field'

describe('DecimalFieldSchema', () => {
  test('should accept valid decimal field configuration', () => {
    // Given: A valid input
    const field = {
      id: 1,
      name: 'weight',
      type: 'decimal' as const,
      required: true,
      precision: 2,
      min: 0.01,
      max: 999.99,
      default: 1.0,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(DecimalFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept decimal field without precision (optional)', () => {
    // Given: A valid configuration
    const field = {
      id: 1,
      name: 'weight',
      type: 'decimal' as const,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(DecimalFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept tax rate with 4 decimal precision', () => {
    // Given: A valid configuration
    const field = {
      id: 2,
      name: 'tax_rate',
      type: 'decimal' as const,
      required: true,
      precision: 4,
      min: 0,
      max: 1,
      default: 0.0825,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(DecimalFieldSchema)(field)
    expect(result.precision).toBe(4)
    expect(result.default).toBe(0.0825)
  })

  test('should accept minimal decimal field configuration', () => {
    // Given: A minimal valid configuration
    const field = {
      id: 1,
      name: 'amount',
      type: 'decimal' as const,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(DecimalFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should reject wrong type value', () => {
    // Given: A configuration with wrong type
    const field = {
      id: 1,
      name: 'weight',
      type: 'integer',

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      // @ts-expect-error - Testing validation with wrong type (integer instead of decimal)
      Schema.decodeSync(DecimalFieldSchema)(field)
    }).toThrow()
  })

  test('should reject precision less than 0', () => {
    // Given: An invalid input
    const field = {
      id: 1,
      name: 'weight',
      type: 'decimal' as const,
      precision: -1,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      Schema.decodeSync(DecimalFieldSchema)(field)
    }).toThrow()
  })

  test('should reject precision greater than 10', () => {
    // Given: An invalid input
    const field = {
      id: 1,
      name: 'weight',
      type: 'decimal' as const,
      precision: 11,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      Schema.decodeSync(DecimalFieldSchema)(field)
    }).toThrow()
  })

  test('should reject precision of 0 (must be positive)', () => {
    // Given: An invalid configuration with precision 0
    const field = {
      id: 1,
      name: 'rounded_value',
      type: 'decimal' as const,
      precision: 0,

      // When: The value is validated against the schema
      // Then: Validation should throw an error (precision must be 1-10)
    }

    expect(() => {
      Schema.decodeSync(DecimalFieldSchema)(field)
    }).toThrow()
  })
})
