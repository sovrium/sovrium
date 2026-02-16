/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ColorFieldSchema } from './color-field'

describe('ColorFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid color field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'brand_color',
        type: 'color' as const,

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(ColorFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept color field with valid hex default', () => {
      const field = {
        id: 1,
        name: 'brand_color',
        type: 'color' as const,
        required: true,
        default: '#3B82F6',
      }

      const result = Schema.decodeSync(ColorFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept color field with lowercase hex', () => {
      const field = {
        id: 1,
        name: 'brand_color',
        type: 'color' as const,
        default: '#ff0000',
      }

      const result = Schema.decodeSync(ColorFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without id', () => {
      // Given: An invalid input
      const field = {
        name: 'brand_color',
        type: 'color' as const,

        // When: The value is validated against the schema
        // Then: Validation should throw an error
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: id
        Schema.decodeSync(ColorFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with invalid hex color', () => {
      const field = {
        id: 1,
        name: 'brand_color',
        type: 'color' as const,
        default: '#ZZZ',
      }

      expect(() => {
        Schema.decodeSync(ColorFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field with short hex color', () => {
      const field = {
        id: 1,
        name: 'brand_color',
        type: 'color' as const,
        default: '#FFF',
      }

      expect(() => {
        Schema.decodeSync(ColorFieldSchema)(field)
      }).toThrow()
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const field: Schema.Schema.Type<typeof ColorFieldSchema> = {
        id: 1,
        name: 'brand_color',
        type: 'color' as const,
        default: '#3B82F6',

        // When: TypeScript type inference is applied
        // Then: The type should be correctly inferred
      }
      expect(field.id).toBe(1)
    })
  })
})
