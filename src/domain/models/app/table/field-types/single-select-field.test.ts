/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { SingleSelectFieldSchema } from './single-select-field'

describe('SingleSelectFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid single-select field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'category',
        type: 'single-select' as const,
        options: ['Electronics', 'Clothing', 'Food'],

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(SingleSelectFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept single-select field with default', () => {
      const field = {
        id: 1,
        name: 'category',
        type: 'single-select' as const,
        required: true,
        indexed: true,
        options: ['Electronics', 'Clothing', 'Food'],
        default: 'Electronics',
      }

      const result = Schema.decodeSync(SingleSelectFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without id', () => {
      // Given: An invalid input
      const field = {
        name: 'category',
        type: 'single-select' as const,
        options: ['A', 'B'],

        // When: The value is validated against the schema
        // Then: Validation should throw an error
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: id
        Schema.decodeSync(SingleSelectFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with empty options array', () => {
      // Given: A field with empty options
      const field = {
        id: 1,
        name: 'category',
        type: 'single-select' as const,
        options: [],

        // When: The value is validated against the schema
        // Then: Validation should throw an error about requiring at least one option
      }

      expect(() => {
        Schema.decodeSync(SingleSelectFieldSchema)(field)
      }).toThrow(/at least one option/i)
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const field: Schema.Schema.Type<typeof SingleSelectFieldSchema> = {
        id: 1,
        name: 'category',
        type: 'single-select' as const,
        options: ['A', 'B'],

        // When: TypeScript type inference is applied
        // Then: The type should be correctly inferred
      }
      expect(field.id).toBe(1)
    })
  })
})
