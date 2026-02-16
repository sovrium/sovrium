/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { RichTextFieldSchema } from './rich-text-field'

describe('RichTextFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid rich-text field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'article_content',
        type: 'rich-text' as const,

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(RichTextFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept rich-text field with all optional properties', () => {
      const field = {
        id: 1,
        name: 'article_content',
        type: 'rich-text' as const,
        required: true,
        maxLength: 10_000,
      }

      const result = Schema.decodeSync(RichTextFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept rich-text field with maxLength', () => {
      const field = {
        id: 1,
        name: 'description',
        type: 'rich-text' as const,
        maxLength: 5000,
      }

      const result = Schema.decodeSync(RichTextFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without id', () => {
      // Given: An invalid input
      const field = {
        name: 'article_content',
        type: 'rich-text' as const,

        // When: The value is validated against the schema
        // Then: Validation should throw an error
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: id
        Schema.decodeSync(RichTextFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with maxLength of 0', () => {
      const field = {
        id: 1,
        name: 'content',
        type: 'rich-text' as const,
        maxLength: 0,
      }

      expect(() => {
        Schema.decodeSync(RichTextFieldSchema)(field)
      }).toThrow()
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const field: Schema.Schema.Type<typeof RichTextFieldSchema> = {
        id: 1,
        name: 'article_content',
        type: 'rich-text' as const,
        maxLength: 10_000,

        // When: TypeScript type inference is applied
        // Then: The type should be correctly inferred
      }
      expect(field.id).toBe(1)
    })
  })
})
