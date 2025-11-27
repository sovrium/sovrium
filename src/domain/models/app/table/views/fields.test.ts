/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ViewFieldsSchema } from './fields'

describe('ViewFieldsSchema', () => {
  describe('Valid Fields', () => {
    test('should accept empty array', () => {
      // GIVEN: An empty fields array
      const fields: readonly string[] = []

      // WHEN: The fields are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldsSchema)(fields)

      // THEN: The fields should be accepted
      expect(result).toEqual([])
    })

    test('should accept array with single field', () => {
      // GIVEN: An array with a single field name
      const fields = ['name']

      // WHEN: The fields are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldsSchema)(fields)

      // THEN: The fields should be accepted
      expect(result).toEqual(['name'])
    })

    test('should accept array with multiple fields', () => {
      // GIVEN: An array with multiple field names
      const fields = ['name', 'email', 'created_at']

      // WHEN: The fields are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldsSchema)(fields)

      // THEN: The fields should be accepted
      expect(result).toEqual(['name', 'email', 'created_at'])
    })

    test('should preserve field order', () => {
      // GIVEN: An array with fields in specific order
      const fields = ['z_field', 'a_field', 'm_field']

      // WHEN: The fields are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldsSchema)(fields)

      // THEN: The order should be preserved
      expect(result).toEqual(['z_field', 'a_field', 'm_field'])
    })
  })

  describe('Invalid Fields', () => {
    test('should reject null', () => {
      // GIVEN: A null value
      const fields = null

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFieldsSchema)(fields)
      }).toThrow()
    })

    test('should reject non-array', () => {
      // GIVEN: A non-array value
      const fields = 'name'

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFieldsSchema)(fields)
      }).toThrow()
    })

    test('should reject array with non-string elements', () => {
      // GIVEN: An array with non-string elements
      const fields = ['name', 123, 'email']

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFieldsSchema)(fields)
      }).toThrow()
    })

    test('should reject array with object elements', () => {
      // GIVEN: An array with object elements (old format)
      const fields = [{ field: 'name', visible: true }]

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFieldsSchema)(fields)
      }).toThrow()
    })
  })

  describe('Type Inference', () => {
    test('should infer ViewFields type correctly', () => {
      // GIVEN: A valid fields array
      const fields = ['name', 'email', 'status']

      // WHEN: The fields are validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldsSchema)(fields)

      // THEN: TypeScript should infer the correct type
      expect(result.length).toBe(3)
      expect(result[0]).toBe('name')
      expect(result[1]).toBe('email')
      expect(result[2]).toBe('status')
    })
  })
})
