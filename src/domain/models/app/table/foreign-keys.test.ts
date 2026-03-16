/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ForeignKeySchema } from './foreign-keys'

describe('ForeignKeySchema', () => {
  describe('validation - valid foreign keys', () => {
    test('accepts valid composite foreign key', () => {
      const validForeignKey = {
        name: 'fk_permissions_tenant_user',
        fields: ['tenant_id', 'user_id'],
        referencedTable: 'tenant_users',
        referencedFields: ['tenant_id', 'user_id'],
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result).toEqual(validForeignKey)
    })

    test('accepts valid single-column foreign key', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result).toEqual(validForeignKey)
    })

    test('accepts valid foreign key with onDelete cascade', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
        onDelete: 'cascade' as const,
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result).toEqual(validForeignKey)
    })

    test('accepts valid foreign key with onUpdate set-null', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
        onUpdate: 'set-null' as const,
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result).toEqual(validForeignKey)
    })

    test('accepts valid foreign key with all referential actions', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
        onDelete: 'cascade' as const,
        onUpdate: 'no-action' as const,
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result).toEqual(validForeignKey)
    })
  })

  describe('validation - constraint name', () => {
    test('rejects empty constraint name', () => {
      const invalidForeignKey = {
        name: '',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      expect(() => Schema.decodeUnknownSync(ForeignKeySchema)(invalidForeignKey)).toThrow()
    })

    test('rejects constraint name longer than 63 characters', () => {
      const invalidForeignKey = {
        name: 'a'.repeat(64),
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      expect(() => Schema.decodeUnknownSync(ForeignKeySchema)(invalidForeignKey)).toThrow()
    })

    test('rejects constraint name with uppercase letters', () => {
      const invalidForeignKey = {
        name: 'FK_Orders_Customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      expect(() => Schema.decodeUnknownSync(ForeignKeySchema)(invalidForeignKey)).toThrow()
    })

    test('rejects constraint name starting with number', () => {
      const invalidForeignKey = {
        name: '1_fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      expect(() => Schema.decodeUnknownSync(ForeignKeySchema)(invalidForeignKey)).toThrow()
    })

    test('accepts constraint name starting with underscore', () => {
      const validForeignKey = {
        name: '_fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.name).toBe('_fk_orders_customer')
    })

    test('accepts constraint name with numbers after first character', () => {
      const validForeignKey = {
        name: 'fk_table_123',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.name).toBe('fk_table_123')
    })
  })

  describe('validation - fields array', () => {
    test('rejects empty fields array', () => {
      const invalidForeignKey = {
        name: 'fk_orders_customer',
        fields: [],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      expect(() => Schema.decodeUnknownSync(ForeignKeySchema)(invalidForeignKey)).toThrow()
    })

    test('accepts single field', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.fields).toEqual(['customer_id'])
    })

    test('accepts multiple fields', () => {
      const validForeignKey = {
        name: 'fk_permissions_tenant_user',
        fields: ['tenant_id', 'user_id'],
        referencedTable: 'tenant_users',
        referencedFields: ['tenant_id', 'user_id'],
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.fields).toEqual(['tenant_id', 'user_id'])
    })
  })

  describe('validation - referenced table', () => {
    test('rejects empty referenced table name', () => {
      const invalidForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: '',
        referencedFields: ['id'],
      }

      expect(() => Schema.decodeUnknownSync(ForeignKeySchema)(invalidForeignKey)).toThrow()
    })

    test('accepts valid referenced table name', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.referencedTable).toBe('customers')
    })
  })

  describe('validation - referenced fields array', () => {
    test('rejects empty referenced fields array', () => {
      const invalidForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: [],
      }

      expect(() => Schema.decodeUnknownSync(ForeignKeySchema)(invalidForeignKey)).toThrow()
    })

    test('accepts single referenced field', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.referencedFields).toEqual(['id'])
    })

    test('accepts multiple referenced fields', () => {
      const validForeignKey = {
        name: 'fk_permissions_tenant_user',
        fields: ['tenant_id', 'user_id'],
        referencedTable: 'tenant_users',
        referencedFields: ['tenant_id', 'user_id'],
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.referencedFields).toEqual(['tenant_id', 'user_id'])
    })
  })

  describe('validation - referential actions', () => {
    test('accepts cascade for onDelete', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
        onDelete: 'cascade' as const,
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.onDelete).toBe('cascade')
    })

    test('accepts set-null for onDelete', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
        onDelete: 'set-null' as const,
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.onDelete).toBe('set-null')
    })

    test('accepts restrict for onDelete', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
        onDelete: 'restrict' as const,
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.onDelete).toBe('restrict')
    })

    test('accepts no-action for onDelete', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
        onDelete: 'no-action' as const,
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.onDelete).toBe('no-action')
    })

    test('accepts cascade for onUpdate', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
        onUpdate: 'cascade' as const,
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.onUpdate).toBe('cascade')
    })

    test('rejects invalid onDelete action', () => {
      const invalidForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
        onDelete: 'invalid-action',
      }

      expect(() => Schema.decodeUnknownSync(ForeignKeySchema)(invalidForeignKey)).toThrow()
    })

    test('rejects invalid onUpdate action', () => {
      const invalidForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
        onUpdate: 'invalid-action',
      }

      expect(() => Schema.decodeUnknownSync(ForeignKeySchema)(invalidForeignKey)).toThrow()
    })
  })

  describe('optional fields', () => {
    test('onDelete is optional', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.onDelete).toBeUndefined()
    })

    test('onUpdate is optional', () => {
      const validForeignKey = {
        name: 'fk_orders_customer',
        fields: ['customer_id'],
        referencedTable: 'customers',
        referencedFields: ['id'],
      }

      const result = Schema.decodeUnknownSync(ForeignKeySchema)(validForeignKey)
      expect(result.onUpdate).toBeUndefined()
    })
  })
})
