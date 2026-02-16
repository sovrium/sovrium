/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { CheckboxFieldSchema } from './checkbox-field'

describe('CheckboxFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid checkbox field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'is_active',
        type: 'checkbox' as const,

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(CheckboxFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept checkbox field with all optional properties', () => {
      const field = {
        id: 1,
        name: 'is_active',
        type: 'checkbox' as const,
        required: true,
        indexed: true,
        default: false,
      }

      const result = Schema.decodeSync(CheckboxFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept checkbox field with default true', () => {
      const field = {
        id: 1,
        name: 'is_active',
        type: 'checkbox' as const,
        default: true,
      }

      const result = Schema.decodeSync(CheckboxFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without id', () => {
      // Given: An invalid input
      const field = {
        name: 'is_active',
        type: 'checkbox' as const,

        // When: The value is validated against the schema
        // Then: Validation should throw an error
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: id
        Schema.decodeSync(CheckboxFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field without type', () => {
      const field = {
        id: 1,
        name: 'is_active',
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: type
        Schema.decodeSync(CheckboxFieldSchema)(field)
      }).toThrow()
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const field: Schema.Schema.Type<typeof CheckboxFieldSchema> = {
        id: 1,
        name: 'is_active',
        type: 'checkbox' as const,
        default: true,

        // When: TypeScript type inference is applied
        // Then: The type should be correctly inferred
      }
      expect(field.id).toBe(1)
    })
  })
})
