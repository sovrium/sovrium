/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { IndexesSchema } from './indexes'

describe('IndexesSchema', () => {
  describe('valid values', () => {
    test('should accept empty array', () => {
      // Given: A valid configuration
      const indexes: unknown[] = []

      // When: The value is validated against the schema
      const result = Schema.decodeUnknownSync(IndexesSchema)(indexes)

      // Then: Validation succeeds and the value is accepted
      expect(result).toEqual([])
    })

    test('should accept single index with one field', () => {
      const indexes = [
        {
          name: 'idx_user_email',
          fields: ['email'],
        },
      ]

      const result = Schema.decodeUnknownSync(IndexesSchema)(indexes)
      expect(result).toEqual(indexes)
    })

    test('should accept index with multiple fields (composite index)', () => {
      const indexes = [
        {
          name: 'idx_user_name_email',
          fields: ['name', 'email'],
        },
      ]

      const result = Schema.decodeUnknownSync(IndexesSchema)(indexes)
      expect(result).toEqual(indexes)
    })

    test('should accept index with unique flag set to true', () => {
      const indexes = [
        {
          name: 'idx_user_email',
          fields: ['email'],
          unique: true,
        },
      ]

      const result = Schema.decodeUnknownSync(IndexesSchema)(indexes)
      expect(result).toEqual(indexes)
    })

    test('should accept index with unique flag set to false', () => {
      const indexes = [
        {
          name: 'idx_user_created',
          fields: ['created_at'],
          unique: false,
        },
      ]

      const result = Schema.decodeUnknownSync(IndexesSchema)(indexes)
      expect(result).toEqual(indexes)
    })

    test('should accept multiple indexes', () => {
      const indexes = [
        {
          name: 'idx_users_email',
          fields: ['email'],
        },
        {
          name: 'idx_products_sku',
          fields: ['sku'],
          unique: true,
        },
        {
          name: 'idx_orders_status',
          fields: ['status'],
        },
      ]

      const result = Schema.decodeUnknownSync(IndexesSchema)(indexes)
      expect(result).toEqual(indexes)
    })

    test('should accept index without unique field (optional)', () => {
      const indexes = [
        {
          name: 'idx_user_email',
          fields: ['email'],
        },
      ]

      const result = Schema.decodeUnknownSync(IndexesSchema)(indexes)
      expect(result).toEqual(indexes)
    })
  })

  describe('invalid values', () => {
    test('should reject index with empty name', () => {
      // Given: An index with empty name
      // When: The index is validated against the schema
      // Then: Validation should throw an error with message "This field is required"
      expect(() => {
        Schema.decodeUnknownSync(IndexesSchema)([
          {
            name: '',
            fields: ['email'],
          },
        ])
      }).toThrow('This field is required')
    })

    test('should reject index with invalid name pattern (uppercase)', () => {
      expect(() => {
        Schema.decodeUnknownSync(IndexesSchema)([
          {
            name: 'Idx_User_Email',
            fields: ['email'],
          },
        ])
      }).toThrow()
    })

    test('should reject index with invalid name pattern (starts with number)', () => {
      expect(() => {
        Schema.decodeUnknownSync(IndexesSchema)([
          {
            name: '1idx_user',
            fields: ['email'],
          },
        ])
      }).toThrow()
    })

    test('should reject index with invalid name pattern (hyphen)', () => {
      expect(() => {
        Schema.decodeUnknownSync(IndexesSchema)([
          {
            name: 'idx-user-email',
            fields: ['email'],
          },
        ])
      }).toThrow()
    })

    test('should reject index with empty fields array', () => {
      expect(() => {
        Schema.decodeUnknownSync(IndexesSchema)([
          {
            name: 'idx_user_email',
            fields: [],
          },
        ])
      }).toThrow()
    })

    test('should reject index with empty string in fields array', () => {
      expect(() => {
        Schema.decodeUnknownSync(IndexesSchema)([
          {
            name: 'idx_user_email',
            fields: ['email', ''],
          },
        ])
      }).toThrow('This field is required')
    })

    test('should reject index with missing name field', () => {
      expect(() => {
        Schema.decodeUnknownSync(IndexesSchema)([
          {
            fields: ['email'],
          },
        ])
      }).toThrow()
    })

    test('should reject index with missing fields array', () => {
      expect(() => {
        Schema.decodeUnknownSync(IndexesSchema)([
          {
            name: 'idx_user_email',
          },
        ])
      }).toThrow()
    })

    test('should reject index with non-array fields', () => {
      expect(() => {
        Schema.decodeUnknownSync(IndexesSchema)([
          {
            name: 'idx_user_email',
            fields: 'email',
          },
        ])
      }).toThrow()
    })

    test('should reject non-array value', () => {
      expect(() => {
        Schema.decodeUnknownSync(IndexesSchema)({
          name: 'idx_user_email',
          fields: ['email'],
        })
      }).toThrow()
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const indexes: Schema.Schema.Type<typeof IndexesSchema> = [
        {
          name: 'idx_user_email',
          fields: ['email'],
          unique: true,

          // When: TypeScript type inference is applied
          // Then: The type should be correctly inferred
        },
      ]
      expect(indexes[0]?.name).toBe('idx_user_email')
      expect(indexes[0]?.fields).toEqual(['email'])
      expect(indexes[0]?.unique).toBe(true)
    })
  })
})
