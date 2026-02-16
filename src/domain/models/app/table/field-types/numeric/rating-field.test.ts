/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { RatingFieldSchema } from './rating-field'

describe('RatingFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid rating field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'product_rating',
        type: 'rating' as const,

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(RatingFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept rating field with all optional properties', () => {
      const field = {
        id: 1,
        name: 'product_rating',
        type: 'rating' as const,
        required: true,
        max: 5,
        style: 'stars',
      }

      const result = Schema.decodeSync(RatingFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept rating field with max value of 10', () => {
      const field = {
        id: 1,
        name: 'satisfaction',
        type: 'rating' as const,
        max: 10,
      }

      const result = Schema.decodeSync(RatingFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without id', () => {
      // Given: An invalid input
      const field = {
        name: 'product_rating',
        type: 'rating' as const,

        // When: The value is validated against the schema
        // Then: Validation should throw an error
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: id
        Schema.decodeSync(RatingFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with max value above 10', () => {
      const field = {
        id: 1,
        name: 'rating',
        type: 'rating' as const,
        max: 15,
      }

      expect(() => {
        Schema.decodeSync(RatingFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with max value of 0', () => {
      const field = {
        id: 1,
        name: 'rating',
        type: 'rating' as const,
        max: 0,
      }

      expect(() => {
        Schema.decodeSync(RatingFieldSchema)(field)
      }).toThrow()
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const field: Schema.Schema.Type<typeof RatingFieldSchema> = {
        id: 1,
        name: 'product_rating',
        type: 'rating' as const,
        max: 5,

        // When: TypeScript type inference is applied
        // Then: The type should be correctly inferred
      }
      expect(field.id).toBe(1)
    })
  })
})
