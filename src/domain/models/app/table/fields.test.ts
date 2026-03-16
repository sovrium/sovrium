/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { FieldsSchema } from './fields'

describe('FieldsSchema', () => {
  describe('valid values', () => {
    test('should accept array with at least one field', () => {
      // Given: An array with a single valid field
      const fields = [
        {
          id: 1,
          name: 'email',
          type: 'single-line-text',
        },
      ] as const

      // When: The fields array is validated against the schema
      const result = Schema.decodeUnknownSync(FieldsSchema)(fields)

      // Then: The fields array should be accepted
      expect(result).toEqual(fields)
    })

    test('should accept multiple fields', () => {
      // Given: An array with multiple valid fields
      const fields = [
        {
          id: 1,
          name: 'email',
          type: 'email',
        },
        {
          id: 2,
          name: 'name',
          type: 'single-line-text',
        },
      ] as const

      // When: The fields array is validated against the schema
      const result = Schema.decodeUnknownSync(FieldsSchema)(fields)

      // Then: The fields array should be accepted
      expect(result).toEqual(fields)
    })
  })

  describe('invalid values', () => {
    test('should reject empty array', () => {
      // Given: An empty fields array
      // When: The empty array is validated against the schema
      // Then: Validation should throw an error (at least one field required)
      expect(() => {
        Schema.decodeUnknownSync(FieldsSchema)([])
      }).toThrow()
    })

    test('should reject non-array value', () => {
      // Given: A single object instead of an array
      // When: The object is validated against the schema
      // Then: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(FieldsSchema)({
          id: 1,
          name: 'email',
          type: 'single-line-text',
        })
      }).toThrow()
    })

    test('should reject duplicate field IDs', () => {
      // Given: An array with duplicate field IDs
      const fields = [
        {
          id: 1,
          name: 'email',
          type: 'email',
        },
        {
          id: 1, // Duplicate ID
          name: 'name',
          type: 'single-line-text',
        },
      ] as const

      // When: The fields array is validated against the schema
      // Then: Validation should throw an error with message about unique IDs
      expect(() => {
        Schema.decodeUnknownSync(FieldsSchema)(fields)
      }).toThrow(/Field IDs must be unique within the table/)
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid fields array with TypeScript type annotation
      const fields = [
        {
          id: 1,
          name: 'email',
          type: 'email' as const,
        },
      ] as Schema.Schema.Type<typeof FieldsSchema>

      // When: TypeScript type inference is applied
      // Then: The type should be correctly inferred
      expect(fields).toHaveLength(1)
    })
  })
})
