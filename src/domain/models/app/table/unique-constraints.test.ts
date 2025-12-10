/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { UniqueConstraintsSchema } from './unique-constraints'

describe('UniqueConstraintsSchema', () => {
  describe('valid values', () => {
    test('should accept empty array', () => {
      // Given: A valid configuration
      const constraints: unknown[] = []

      // When: The value is validated against the schema
      const result = Schema.decodeUnknownSync(UniqueConstraintsSchema)(constraints)

      // Then: Validation succeeds and the value is accepted
      expect(result).toEqual([])
    })

    test('should accept single constraint with multiple fields', () => {
      const constraints = [
        {
          name: 'uq_user_email_tenant',
          fields: ['email', 'tenant_id'],
        },
      ]

      const result = Schema.decodeUnknownSync(UniqueConstraintsSchema)(constraints)
      expect(result).toEqual(constraints)
    })

    test('should accept constraint with two fields', () => {
      const constraints = [
        {
          name: 'uq_product_sku_variant',
          fields: ['sku', 'variant_id'],
        },
      ]

      const result = Schema.decodeUnknownSync(UniqueConstraintsSchema)(constraints)
      expect(result).toEqual(constraints)
    })

    test('should accept multiple constraints', () => {
      const constraints = [
        {
          name: 'uq_users_email_tenant',
          fields: ['email', 'tenant_id'],
        },
        {
          name: 'uq_products_sku_variant',
          fields: ['sku', 'variant_id'],
        },
        {
          name: 'uq_orders_number_year',
          fields: ['order_number', 'year'],
        },
      ]

      const result = Schema.decodeUnknownSync(UniqueConstraintsSchema)(constraints)
      expect(result).toEqual(constraints)
    })

    test('should accept constraint with more than two fields', () => {
      const constraints = [
        {
          name: 'uq_user_email_tenant_org',
          fields: ['email', 'tenant_id', 'org_id'],
        },
      ]

      const result = Schema.decodeUnknownSync(UniqueConstraintsSchema)(constraints)
      expect(result).toEqual(constraints)
    })

    test('should accept constraint with single field', () => {
      const constraints = [
        {
          name: 'uq_user_email',
          fields: ['email'],
        },
      ]

      const result = Schema.decodeUnknownSync(UniqueConstraintsSchema)(constraints)
      expect(result).toEqual(constraints)
    })

    test('should accept and lowercase constraint names with uppercase characters', () => {
      const constraints = [
        {
          name: 'UQ_User_Email',
          fields: ['email'],
        },
      ]

      const result = Schema.decodeUnknownSync(UniqueConstraintsSchema)(constraints)
      expect(result).toEqual([
        {
          name: 'uq_user_email',
          fields: ['email'],
        },
      ])
    })
  })

  describe('invalid values', () => {
    test('should reject constraint with empty name', () => {
      // Given: A constraint with empty name
      // When: The constraint is validated against the schema
      // Then: Validation should throw an error with message "This field is required"
      expect(() => {
        Schema.decodeUnknownSync(UniqueConstraintsSchema)([
          {
            name: '',
            fields: ['email', 'tenant_id'],
          },
        ])
      }).toThrow('This field is required')
    })

    test('should reject constraint with invalid name pattern (starts with number)', () => {
      expect(() => {
        Schema.decodeUnknownSync(UniqueConstraintsSchema)([
          {
            name: '1uq_user',
            fields: ['email'],
          },
        ])
      }).toThrow()
    })

    test('should reject constraint with invalid name pattern (hyphen)', () => {
      expect(() => {
        Schema.decodeUnknownSync(UniqueConstraintsSchema)([
          {
            name: 'uq-user-email',
            fields: ['email'],
          },
        ])
      }).toThrow()
    })

    test('should reject constraint with empty fields array', () => {
      expect(() => {
        Schema.decodeUnknownSync(UniqueConstraintsSchema)([
          {
            name: 'uq_user_email',
            fields: [],
          },
        ])
      }).toThrow()
    })

    test('should reject constraint with empty string in fields array', () => {
      expect(() => {
        Schema.decodeUnknownSync(UniqueConstraintsSchema)([
          {
            name: 'uq_user_email_tenant',
            fields: ['email', ''],
          },
        ])
      }).toThrow('This field is required')
    })

    test('should reject constraint with missing name field', () => {
      expect(() => {
        Schema.decodeUnknownSync(UniqueConstraintsSchema)([
          {
            fields: ['email', 'tenant_id'],
          },
        ])
      }).toThrow()
    })

    test('should reject constraint with missing fields array', () => {
      expect(() => {
        Schema.decodeUnknownSync(UniqueConstraintsSchema)([
          {
            name: 'uq_user_email',
          },
        ])
      }).toThrow()
    })

    test('should reject constraint with non-array fields', () => {
      expect(() => {
        Schema.decodeUnknownSync(UniqueConstraintsSchema)([
          {
            name: 'uq_user_email',
            fields: 'email',
          },
        ])
      }).toThrow()
    })

    test('should reject non-array value', () => {
      expect(() => {
        Schema.decodeUnknownSync(UniqueConstraintsSchema)({
          name: 'uq_user_email',
          fields: ['email'],
        })
      }).toThrow()
    })

    test('should reject duplicate constraint names within same table', () => {
      expect(() => {
        Schema.decodeUnknownSync(UniqueConstraintsSchema)([
          {
            name: 'uq_users_contact',
            fields: ['email', 'phone'],
          },
          {
            name: 'uq_users_contact',
            fields: ['name', 'email'],
          },
        ])
      }).toThrow(/duplicate.*constraint.*name|constraint name.*must be unique/i)
    })
  })

  describe('type inference', () => {
    test('should infer correct TypeScript type', () => {
      // Given: A valid value with TypeScript type annotation
      const constraints: Schema.Schema.Type<typeof UniqueConstraintsSchema> = [
        {
          name: 'uq_user_email_tenant',
          fields: ['email', 'tenant_id'],

          // When: TypeScript type inference is applied
          // Then: The type should be correctly inferred
        },
      ]
      expect(constraints[0]?.name).toBe('uq_user_email_tenant')
      expect(constraints[0]?.fields).toEqual(['email', 'tenant_id'])
    })
  })
})
