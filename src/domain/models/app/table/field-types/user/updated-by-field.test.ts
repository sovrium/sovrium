/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { UpdatedByFieldSchema } from './updated-by-field'

describe('UpdatedByFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid updated-by field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'updated_by',
        type: 'updated-by' as const,

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(UpdatedByFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept updated-by field with indexed flag', () => {
      const field = {
        id: 1,
        name: 'updated_by',
        type: 'updated-by' as const,
        indexed: true,
      }

      const result = Schema.decodeSync(UpdatedByFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept updated-by field without indexed flag', () => {
      const field = {
        id: 1,
        name: 'updated_by',
        type: 'updated-by' as const,
        indexed: false,
      }

      const result = Schema.decodeSync(UpdatedByFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without id', () => {
      // Given: An invalid input
      const field = {
        name: 'updated_by',
        type: 'updated-by' as const,

        // When: The value is validated against the schema
        // Then: Validation should throw an error
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: id
        Schema.decodeSync(UpdatedByFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field without type', () => {
      const field = {
        id: 1,
        name: 'updated_by',
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: type
        Schema.decodeSync(UpdatedByFieldSchema)(field)
      }).toThrow()
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const field: Schema.Schema.Type<typeof UpdatedByFieldSchema> = {
        id: 1,
        name: 'updated_by',
        type: 'updated-by' as const,
        indexed: true,

        // When: TypeScript type inference is applied
        // Then: The type should be correctly inferred
      }
      expect(field.id).toBe(1)
    })
  })
})
