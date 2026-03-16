/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { FieldNameSchema } from './field-name'

describe('FieldNameSchema', () => {
  describe('valid field names', () => {
    test('accepts single lowercase letter', () => {
      // Given: A single lowercase letter
      const name = 'a'

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(FieldNameSchema)(name)

      // Then: The name should be accepted
      expect(result).toBe('a')
    })

    test('accepts lowercase letters', () => {
      // Given: A field name with only lowercase letters
      const name = 'email'

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(FieldNameSchema)(name)

      // Then: The name should be accepted
      expect(result).toBe('email')
    })

    test('accepts letters with numbers', () => {
      // Given: A field name with letters and numbers
      const name = 'field123'

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(FieldNameSchema)(name)

      // Then: The name should be accepted
      expect(result).toBe('field123')
    })

    test('accepts letters with underscores', () => {
      // Given: A field name with underscores
      const name = 'user_status'

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(FieldNameSchema)(name)

      // Then: The name should be accepted
      expect(result).toBe('user_status')
    })

    test('accepts snake_case names', () => {
      // Given: A snake_case field name
      const name = 'order_item'

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(FieldNameSchema)(name)

      // Then: The name should be accepted
      expect(result).toBe('order_item')
    })

    test('accepts names with multiple underscores', () => {
      // Given: A field name with multiple underscores
      const name = 'customer_email_address'

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(FieldNameSchema)(name)

      // Then: The name should be accepted
      expect(result).toBe('customer_email_address')
    })

    test('accepts timestamp names', () => {
      // Given: A timestamp field name
      const name = 'created_at'

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(FieldNameSchema)(name)

      // Then: The name should be accepted
      expect(result).toBe('created_at')
    })

    test('accepts names ending with numbers', () => {
      // Given: A field name ending with numbers
      const name = 'field_1'

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(FieldNameSchema)(name)

      // Then: The name should be accepted
      expect(result).toBe('field_1')
    })

    test('accepts maximum length (63 characters)', () => {
      // Given: A field name at maximum length (63 characters)
      const name = 'a'.repeat(63)

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(FieldNameSchema)(name)

      // Then: The name should be accepted
      expect(result).toBe(name)
    })
  })

  describe('invalid types', () => {
    test('rejects number', () => {
      // Given: A number instead of a string
      // When: The value is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)(123)).toThrow()
    })

    test('rejects boolean', () => {
      // Given: A boolean instead of a string
      // When: The value is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)(true)).toThrow()
    })

    test('rejects null', () => {
      // Given: A null value
      // When: The value is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)(null)).toThrow()
    })

    test('rejects undefined', () => {
      // Given: An undefined value
      // When: The value is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)(undefined)).toThrow()
    })

    test('rejects array', () => {
      // Given: An array instead of a string
      // When: The value is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)([])).toThrow()
    })

    test('rejects object', () => {
      // Given: An object instead of a string
      // When: The value is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)({})).toThrow()
    })
  })

  describe('invalid patterns', () => {
    test('rejects name starting with uppercase', () => {
      // Given: A field name starting with uppercase letter
      // When: The name is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)('Email')).toThrow()
    })

    test('rejects name with uppercase letters', () => {
      // Given: A field name with uppercase letters (camelCase)
      // When: The name is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)('userStatus')).toThrow()
    })

    test('rejects name starting with number', () => {
      // Given: A field name starting with a number
      // When: The name is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)('1field')).toThrow()
    })

    test('rejects name starting with underscore', () => {
      // Given: A field name starting with underscore
      // When: The name is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)('_private')).toThrow()
    })

    test('rejects name with hyphen', () => {
      // Given: A field name with hyphen (kebab-case)
      // When: The name is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)('user-status')).toThrow()
    })

    test('rejects name with space', () => {
      // Given: A field name containing spaces
      // When: The name is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)('user status')).toThrow()
    })

    test('rejects name with special characters', () => {
      // Given: A field name with special characters
      // When: The name is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)('user@email')).toThrow()
    })

    test('rejects name with dots', () => {
      // Given: A field name containing dots
      // When: The name is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)('user.email')).toThrow()
    })
  })

  describe('length constraints', () => {
    test('rejects empty string', () => {
      // Given: An empty string
      // When: The value is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)('')).toThrow()
    })

    test('rejects string longer than 63 characters', () => {
      // Given: A field name exceeding 63 characters
      const name = 'a'.repeat(64)

      // When: The name is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)(name)).toThrow()
    })

    test('rejects very long string', () => {
      // Given: A very long field name (well above limit)
      const name = 'field_name_that_is_way_too_long_and_exceeds_postgresql_limit_'.repeat(2)

      // When: The name is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)(name)).toThrow()
    })
  })

  describe('edge cases', () => {
    test('accepts single character at minimum length', () => {
      // Given: A single character field name
      const name = 'x'

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(FieldNameSchema)(name)

      // Then: The name should be accepted
      expect(result).toBe('x')
    })

    test('accepts name at boundary (63 chars)', () => {
      // Given: A field name at exactly 63 characters
      const name = 'a' + '_'.repeat(61) + 'b'

      // When: The name is validated against the schema
      const result = Schema.decodeUnknownSync(FieldNameSchema)(name)

      // Then: The name should be accepted
      expect(result).toBe(name)
    })

    test('rejects name just over boundary (64 chars)', () => {
      // Given: A field name just over the 63 character limit
      const name = 'a'.repeat(64)

      // When: The name is validated against the schema
      // Then: Validation should throw an error
      expect(() => Schema.decodeUnknownSync(FieldNameSchema)(name)).toThrow()
    })
  })
})
