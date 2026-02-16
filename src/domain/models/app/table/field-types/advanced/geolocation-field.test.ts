/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { GeolocationFieldSchema } from './geolocation-field'

describe('GeolocationFieldSchema', () => {
  describe('valid values', () => {
    test('should accept valid geolocation field', () => {
      // Given: A valid input
      const field = {
        id: 1,
        name: 'office_location',
        type: 'geolocation' as const,

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(GeolocationFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept geolocation field with required flag', () => {
      const field = {
        id: 1,
        name: 'office_location',
        type: 'geolocation' as const,
        required: true,
      }

      const result = Schema.decodeSync(GeolocationFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept geolocation field with optional flag', () => {
      const field = {
        id: 1,
        name: 'delivery_location',
        type: 'geolocation' as const,
        required: false,
      }

      const result = Schema.decodeSync(GeolocationFieldSchema)(field)
      expect(result).toEqual(field)
    })
  })

  describe('invalid values', () => {
    test('should reject field without id', () => {
      // Given: An invalid input
      const field = {
        name: 'office_location',
        type: 'geolocation' as const,

        // When: The value is validated against the schema
        // Then: Validation should throw an error
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: id
        Schema.decodeSync(GeolocationFieldSchema)(field)
      }).toThrow()
    })

    test('should reject field without type', () => {
      const field = {
        id: 1,
        name: 'office_location',
      }

      expect(() => {
        // @ts-expect-error - Testing missing required property: type
        Schema.decodeSync(GeolocationFieldSchema)(field)
      }).toThrow()
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const field: Schema.Schema.Type<typeof GeolocationFieldSchema> = {
        id: 1,
        name: 'office_location',
        type: 'geolocation' as const,
        required: true,

        // When: TypeScript type inference is applied
        // Then: The type should be correctly inferred
      }
      expect(field.id).toBe(1)
    })
  })
})
