/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { UserFieldSchema } from './user-field'

describe('UserFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid user field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'assigned_to',
        type: 'user' as const,

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(UserFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept user field with all optional properties', () => {
      const field = {
        id: 1,
        name: 'assigned_to',
        type: 'user' as const,
        required: true,
        indexed: true,
        allowMultiple: true,
      }

      const result = Schema.decodeSync(UserFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept user field allowing single user', () => {
      const field = {
        id: 1,
        name: 'author',
        type: 'user' as const,
        allowMultiple: false,
      }

      const result = Schema.decodeSync(UserFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without id', () => {
      // Given: An invalid input
      const field = {
        name: 'assigned_to',
        type: 'user' as const,

        // When: The value is validated against the schema
        // Then: Validation should throw an error
      }

      expect(() => {
        // @ts-expect-error - Testing validation with missing required id property
        Schema.decodeSync(UserFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field without type', () => {
      const field = {
        id: 1,
        name: 'assigned_to',
      }

      expect(() => {
        // @ts-expect-error - Testing validation with missing required type property
        Schema.decodeSync(UserFieldSchema)(field)
      }).toThrow()
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const field: Schema.Schema.Type<typeof UserFieldSchema> = {
        id: 1,
        name: 'assigned_to',
        type: 'user' as const,
        allowMultiple: true,

        // When: TypeScript type inference is applied
        // Then: The type should be correctly inferred
      }
      expect(field.id).toBe(1)
    })
  })
})
