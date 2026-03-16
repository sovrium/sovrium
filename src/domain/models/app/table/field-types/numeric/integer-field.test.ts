/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { IntegerFieldSchema } from './integer-field'

describe('IntegerFieldSchema', () => {
  test('should accept valid integer field configuration', () => {
    // Given: A valid input
    const field = {
      id: 1,
      name: 'quantity',
      type: 'integer' as const,
      required: true,
      min: 0,
      max: 1000,
      default: 1,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(IntegerFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept integer field with age constraints', () => {
    // Given: A valid configuration
    const field = {
      id: 2,
      name: 'age',
      type: 'integer' as const,
      required: false,
      min: 0,
      max: 150,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(IntegerFieldSchema)(field)
    expect(result.min).toBe(0)
    expect(result.max).toBe(150)
  })

  test('should accept minimal integer field configuration', () => {
    // Given: A minimal valid configuration
    const field = {
      id: 1,
      name: 'count',
      type: 'integer' as const,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(IntegerFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should reject wrong type value', () => {
    // Given: A configuration with wrong type
    const field = {
      id: 1,
      name: 'quantity',
      type: 'decimal' as const,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      // @ts-expect-error - Testing wrong type value
      Schema.decodeSync(IntegerFieldSchema)(field)
    }).toThrow()
  })

  test('should reject non-integer default value', () => {
    // Given: An invalid input
    const field = {
      id: 1,
      name: 'quantity',
      type: 'integer' as const,
      default: 1.5,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      Schema.decodeSync(IntegerFieldSchema)(field)
    }).toThrow()
  })

  test('should accept negative min value', () => {
    // Given: A valid configuration
    const field = {
      id: 1,
      name: 'temperature',
      type: 'integer' as const,
      min: -100,
      max: 100,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(IntegerFieldSchema)(field)
    expect(result.min).toBe(-100)
  })
})
