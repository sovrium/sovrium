/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { PrimaryKeySchema } from './primary-key'

describe('PrimaryKeySchema', () => {
  describe('valid values', () => {
    test('should accept auto-increment type with field', () => {
      // Given: A valid configuration
      const config = {
        type: 'auto-increment',
        field: 'id',

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeUnknownSync(PrimaryKeySchema)(config)
      expect(result).toEqual(config)
    })

    test('should accept uuid type with field', () => {
      const config = {
        type: 'uuid',
        field: 'id',
      }

      const result = Schema.decodeUnknownSync(PrimaryKeySchema)(config)
      expect(result).toEqual(config)
    })

    test('should accept composite type with fields array', () => {
      const config = {
        type: 'composite',
        fields: ['tenant_id', 'user_id'],
      }

      const result = Schema.decodeUnknownSync(PrimaryKeySchema)(config)
      expect(result).toEqual(config)
    })

    test('should accept auto-increment with custom field name', () => {
      const validConfigs = [
        { type: 'auto-increment', field: 'user_id' },
        { type: 'auto-increment', field: 'product_id' },
        { type: 'auto-increment', field: 'order_number' },
      ]

      validConfigs.forEach((config) => {
        const result = Schema.decodeUnknownSync(PrimaryKeySchema)(config)
        expect(result).toEqual(config)
      })
    })

    test('should accept composite with multiple fields', () => {
      const config = {
        type: 'composite',
        fields: ['tenant_id', 'user_id', 'created_at'],
      }

      const result = Schema.decodeUnknownSync(PrimaryKeySchema)(config)
      expect(result).toEqual(config)
    })

    test('should accept type without optional fields', () => {
      const config = {
        type: 'auto-increment',
      }

      const result = Schema.decodeUnknownSync(PrimaryKeySchema)(config)
      expect(result).toEqual(config)
    })
  })

  describe('invalid values', () => {
    test('should reject missing type field', () => {
      // Given: A configuration missing the required type field
      // When: The configuration is validated against the schema
      // Then: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(PrimaryKeySchema)({
          field: 'id',
        })
      }).toThrow()
    })

    test('should reject empty type string', () => {
      expect(() => {
        Schema.decodeUnknownSync(PrimaryKeySchema)({
          type: '',
          field: 'id',
        })
      }).toThrow()
    })

    test('should reject invalid field name pattern (uppercase)', () => {
      expect(() => {
        Schema.decodeUnknownSync(PrimaryKeySchema)({
          type: 'auto-increment',
          field: 'UserId',
        })
      }).toThrow()
    })

    test('should reject invalid field name pattern (starts with number)', () => {
      expect(() => {
        Schema.decodeUnknownSync(PrimaryKeySchema)({
          type: 'uuid',
          field: '1id',
        })
      }).toThrow()
    })

    test('should reject invalid field name pattern (hyphen)', () => {
      expect(() => {
        Schema.decodeUnknownSync(PrimaryKeySchema)({
          type: 'auto-increment',
          field: 'user-id',
        })
      }).toThrow()
    })

    test('should reject empty string in fields array', () => {
      expect(() => {
        Schema.decodeUnknownSync(PrimaryKeySchema)({
          type: 'composite',
          fields: ['tenant_id', ''],
        })
      }).toThrow('This field is required')
    })

    test('should reject non-string type', () => {
      expect(() => {
        Schema.decodeUnknownSync(PrimaryKeySchema)({
          type: 123,
          field: 'id',
        })
      }).toThrow()
    })

    test('should reject non-string field', () => {
      expect(() => {
        Schema.decodeUnknownSync(PrimaryKeySchema)({
          type: 'auto-increment',
          field: 123,
        })
      }).toThrow()
    })

    test('should reject non-array fields', () => {
      expect(() => {
        Schema.decodeUnknownSync(PrimaryKeySchema)({
          type: 'composite',
          fields: 'tenant_id,user_id',
        })
      }).toThrow()
    })
  })

  describe('edge cases', () => {
    test('should accept both field and fields (last one wins in union)', () => {
      // Given: A valid configuration
      const config = {
        type: 'composite',
        field: 'id',
        fields: ['tenant_id', 'user_id'],

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeUnknownSync(PrimaryKeySchema)(config)
      expect(result).toEqual(config)
    })

    test('should accept empty fields array', () => {
      const config = {
        type: 'composite',
        fields: [],
      }

      const result = Schema.decodeUnknownSync(PrimaryKeySchema)(config)
      expect(result).toEqual(config)
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const pk: Schema.Schema.Type<typeof PrimaryKeySchema> = {
        type: 'auto-increment',
        field: 'id',

        // When: TypeScript type inference is applied
        // Then: The type should be correctly inferred
      }
      expect(pk.type).toBe('auto-increment')
      expect(pk.field).toBe('id')
    })
  })
})
