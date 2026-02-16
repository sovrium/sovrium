/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { MultiSelectFieldSchema } from './multi-select-field'

describe('MultiSelectFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid multi-select field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'tags',
        type: 'multi-select' as const,
        options: ['Urgent', 'Important'],

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(MultiSelectFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without id', () => {
      // Given: An invalid input
      const field = {
        name: 'tags',
        type: 'multi-select' as const,
        options: ['A'],

        // When: The value is validated against the schema
        // Then: Validation should throw an error
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: id
        Schema.decodeSync(MultiSelectFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with empty options array', () => {
      // Given: A field with empty options
      const field = {
        id: 1,
        name: 'tags',
        type: 'multi-select' as const,
        options: [],

        // When: The value is validated against the schema
        // Then: Validation should throw an error about requiring at least one option
      }

      expect(() => {
        Schema.decodeSync(MultiSelectFieldSchema)(field)
      }).toThrow(/at least one option/i)
    })
  })
})
