/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Schema } from 'effect'
import { TableSchema, type Table } from '.'

describe('TableSchema', () => {
  describe('Valid Tables', () => {
    test('should accept minimal table with required fields only', () => {
      // GIVEN: A minimal table with id, name, and fields
      const table = {
        id: 1,
        name: 'users',
        fields: [
          {
            id: 1,
            name: 'email',
            type: 'email' as const,
          },
        ],
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted
      expect(result.id).toBe(1)
      expect(result.name).toBe('users')
      expect(result.fields.length).toBe(1)
      expect(result.fields[0]!.type).toBe('email')
    })

    test('should accept table with multiple fields', () => {
      // GIVEN: A table with multiple fields
      const table = {
        id: 2,
        name: 'products',
        fields: [
          { id: 1, name: 'title', type: 'single-line-text' as const, required: true },
          {
            id: 2,
            name: 'price',
            type: 'currency' as const,
            required: true,
            currency: 'USD',
          },
          { id: 3, name: 'description', type: 'long-text' as const, required: false },
        ],
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted with all fields
      expect(result.fields.length).toBe(3)
      expect(result.fields[0]!.name).toBe('title')
      // Type assertion needed for discriminated union property access
      expect((result.fields[1] as { currency?: string })!.currency).toBe('USD')
      expect(result.fields[2]!.required).toBe(false)
    })

    test('should accept table with primary key', () => {
      // GIVEN: A table with a primary key definition
      const table = {
        id: 3,
        name: 'orders',
        fields: [
          { id: 1, name: 'order_id', type: 'integer' as const },
          { id: 2, name: 'customer', type: 'single-line-text' as const },
        ],
        primaryKey: {
          type: 'simple' as const,
          field: 'order_id',
        },
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted with primary key
      expect(result.primaryKey).toBeDefined()
      expect(result.primaryKey?.type).toBe('simple')
    })

    test('should accept table with unique constraints', () => {
      // GIVEN: A table with unique constraints
      const table = {
        id: 4,
        name: 'accounts',
        fields: [
          { id: 1, name: 'email', type: 'email' as const },
          { id: 2, name: 'username', type: 'single-line-text' as const },
        ],
        uniqueConstraints: [
          { name: 'unique_email', fields: ['email'] },
          { name: 'unique_username', fields: ['username'] },
        ],
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted with unique constraints
      expect(result.uniqueConstraints).toBeDefined()
      expect(result.uniqueConstraints?.length).toBe(2)
      expect(result.uniqueConstraints?.[0]!.name).toBe('unique_email')
    })

    test('should accept table with indexes', () => {
      // GIVEN: A table with indexes
      const table = {
        id: 5,
        name: 'posts',
        fields: [
          { id: 1, name: 'title', type: 'single-line-text' as const },
          { id: 2, name: 'created_at', type: 'date' as const },
        ],
        indexes: [{ name: 'idx_created_at', fields: ['created_at'], unique: false }],
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted with indexes
      expect(result.indexes).toBeDefined()
      expect(result.indexes?.length).toBe(1)
      expect(result.indexes?.[0]!.name).toBe('idx_created_at')
    })

    test('should accept table with all optional properties', () => {
      // GIVEN: A table with all optional properties defined
      const table = {
        id: 6,
        name: 'complete_table',
        fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
        primaryKey: {
          type: 'simple' as const,
          field: 'field1',
        },
        uniqueConstraints: [{ name: 'constraint1', fields: ['field1'] }],
        indexes: [{ name: 'index1', fields: ['field1'], unique: false }],
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted with all properties
      expect(result.primaryKey).toBeDefined()
      expect(result.uniqueConstraints).toBeDefined()
      expect(result.indexes).toBeDefined()
    })
  })

  describe('Invalid Tables - Missing Required Fields', () => {
    test('should accept table without id (id is optional and auto-generated)', () => {
      // GIVEN: A table missing the id field
      const table = {
        name: 'users',
        fields: [{ id: 1, name: 'email', type: 'email' as const }],
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted (id is optional)
      expect(result.name).toBe('users')
      expect(result.id).toBeUndefined() // ID is optional at table level, auto-generated at tables array level
    })

    test('should reject table without name', () => {
      // GIVEN: A table missing the name field
      const table = {
        id: 1,
        fields: [{ id: 1, name: 'email', type: 'email' as const }],
      }

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })

    test('should reject table without fields', () => {
      // GIVEN: A table missing the fields array
      const table = {
        id: 1,
        name: 'users',
      }

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })

    test('should reject table with empty fields array', () => {
      // GIVEN: A table with an empty fields array
      const table = {
        id: 1,
        name: 'users',
        fields: [],
      }

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })
  })

  describe('Invalid Tables - Invalid Field Types', () => {
    test('should accept table with string id (UUID or simple string)', () => {
      // GIVEN: A table with a string id (UUID format)
      const table = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'users',
        fields: [{ id: 1, name: 'email', type: 'email' as const }],
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted (string IDs are valid for UUIDs)
      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    test('should reject table with invalid name type', () => {
      // GIVEN: A table with a number name instead of string
      const table = {
        id: 1,
        name: 123,
        fields: [{ id: 1, name: 'email', type: 'email' as const }],
      }

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })

    test('should reject table with non-array fields', () => {
      // GIVEN: A table with fields as an object instead of array
      const table = {
        id: 1,
        name: 'users',
        fields: { id: 1, name: 'email', type: 'email' },
      }

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })

    test('should reject table with invalid field in fields array', () => {
      // GIVEN: A table with an invalid field (missing required properties)
      const table = {
        id: 1,
        name: 'users',
        fields: [
          { id: 1, name: 'email' }, // missing 'type'
        ],
      }

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })
  })

  describe('Invalid Tables - Invalid Optional Properties', () => {
    test('should reject table with invalid primaryKey structure', () => {
      // GIVEN: A table with an invalid primary key
      const table = {
        id: 1,
        name: 'users',
        fields: [{ id: 1, name: 'email', type: 'email' as const }],
        primaryKey: 'invalid',
      }

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })

    test('should reject table with invalid uniqueConstraints type', () => {
      // GIVEN: A table with uniqueConstraints as object instead of array
      const table = {
        id: 1,
        name: 'users',
        fields: [{ id: 1, name: 'email', type: 'email' as const }],
        uniqueConstraints: { name: 'unique_email', fields: ['email'] },
      }

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })

    test('should reject table with invalid indexes type', () => {
      // GIVEN: A table with indexes as string instead of array
      const table = {
        id: 1,
        name: 'users',
        fields: [{ id: 1, name: 'email', type: 'email' as const }],
        indexes: 'invalid',
      }

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })
  })

  describe('Invalid Tables - Null and Undefined Values', () => {
    test('should reject null table', () => {
      // GIVEN: A null value
      const table = null

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })

    test('should reject undefined table', () => {
      // GIVEN: An undefined value
      const table = undefined

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })

    test('should reject table with null id', () => {
      // GIVEN: A table with null id
      const table = {
        id: null,
        name: 'users',
        fields: [{ id: 1, name: 'email', type: 'email' as const }],
      }

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })

    test('should reject table with null name', () => {
      // GIVEN: A table with null name
      const table = {
        id: 1,
        name: null,
        fields: [{ id: 1, name: 'email', type: 'email' as const }],
      }

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })

    test('should reject table with null fields', () => {
      // GIVEN: A table with null fields
      const table = {
        id: 1,
        name: 'users',
        fields: null,
      }

      // WHEN/THEN: The table validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow()
    })
  })

  describe('Type Inference', () => {
    test('should infer Table type correctly', () => {
      // GIVEN: A valid table
      const table = {
        id: 1,
        name: 'users',
        fields: [
          {
            id: 1,
            name: 'email',
            type: 'email' as const,
          },
        ],
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: TypeScript should infer the correct type
      const typedResult: Table = result
      expect(typedResult.id).toBe(1)
      expect(typedResult.name).toBe('users')
    })

    test('should allow optional properties to be undefined in type', () => {
      // GIVEN: A table without optional properties
      const table = {
        id: 1,
        name: 'users',
        fields: [
          {
            id: 1,
            name: 'email',
            type: 'email' as const,
          },
        ],
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: Optional properties should be undefined
      expect(result.primaryKey).toBeUndefined()
      expect(result.uniqueConstraints).toBeUndefined()
      expect(result.indexes).toBeUndefined()
    })
  })

  describe('Organization Isolation Validation', () => {
    test('should reject organizationScoped table without organization_id field', () => {
      // GIVEN: A table with organizationScoped=true but no organization_id field
      const table = {
        id: 1,
        name: 'projects',
        fields: [
          { id: 1, name: 'id', type: 'integer' as const },
          { id: 2, name: 'name', type: 'single-line-text' as const },
        ],
        permissions: {
          organizationScoped: true,
        },
      }

      // WHEN/THEN: The table validation should fail with specific error message
      expect(() => {
        Schema.decodeUnknownSync(TableSchema)(table)
      }).toThrow(/organizationScoped requires organization_id field/)
    })

    test('should accept organizationScoped table with organization_id field', () => {
      // GIVEN: A table with organizationScoped=true and organization_id field
      const table = {
        id: 1,
        name: 'projects',
        fields: [
          { id: 1, name: 'id', type: 'integer' as const },
          { id: 2, name: 'name', type: 'single-line-text' as const },
          { id: 3, name: 'organization_id', type: 'single-line-text' as const },
        ],
        permissions: {
          organizationScoped: true,
        },
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted
      expect(result.permissions?.organizationScoped).toBe(true)
      expect(result.fields.some((f) => f.name === 'organization_id')).toBe(true)
    })

    test('should accept table without organizationScoped flag', () => {
      // GIVEN: A table without organizationScoped flag (no organization_id required)
      const table = {
        id: 1,
        name: 'public_table',
        fields: [
          { id: 1, name: 'id', type: 'integer' as const },
          { id: 2, name: 'title', type: 'single-line-text' as const },
        ],
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted (no organization_id field required)
      expect(result.permissions).toBeUndefined()
      expect(result.fields.some((f) => f.name === 'organization_id')).toBe(false)
    })

    test('should accept table with organizationScoped=false', () => {
      // GIVEN: A table with organizationScoped=false (no organization_id required)
      const table = {
        id: 1,
        name: 'public_table',
        fields: [
          { id: 1, name: 'id', type: 'integer' as const },
          { id: 2, name: 'title', type: 'single-line-text' as const },
        ],
        permissions: {
          organizationScoped: false,
        },
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted (no organization_id field required)
      expect(result.permissions?.organizationScoped).toBe(false)
      expect(result.fields.some((f) => f.name === 'organization_id')).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    test('should accept table with very large number of fields', () => {
      // GIVEN: A table with many fields
      const fields = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `field_${i + 1}`,
        type: 'single-line-text' as const,
      }))

      const table = {
        id: 1,
        name: 'large_table',
        fields,
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted
      expect(result.fields.length).toBe(100)
    })

    test('should accept table with various field types', () => {
      // GIVEN: A table with multiple different field types
      const table = {
        id: 1,
        name: 'mixed_fields',
        fields: [
          { id: 1, name: 'text', type: 'single-line-text' as const },
          { id: 2, name: 'email', type: 'email' as const },
          { id: 3, name: 'url', type: 'url' as const },
          { id: 4, name: 'number', type: 'integer' as const },
          { id: 5, name: 'decimal', type: 'decimal' as const },
          { id: 6, name: 'currency', type: 'currency' as const, currency: 'EUR' },
          { id: 7, name: 'percent', type: 'percentage' as const },
          { id: 8, name: 'date', type: 'date' as const },
          { id: 9, name: 'checkbox', type: 'checkbox' as const },
        ],
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted with all field types
      expect(result.fields.length).toBe(9)
      expect(result.fields[5]!.type).toBe('currency')
    })

    test('should accept table with complex primary key (composite)', () => {
      // GIVEN: A table with a composite primary key
      const table = {
        id: 1,
        name: 'composite_pk',
        fields: [
          { id: 1, name: 'col1', type: 'integer' as const },
          { id: 2, name: 'col2', type: 'integer' as const },
        ],
        primaryKey: {
          type: 'composite' as const,
          fields: ['col1', 'col2'],
        },
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted
      expect(result.primaryKey?.type).toBe('composite')
    })

    test('should accept table with multiple unique constraints and indexes', () => {
      // GIVEN: A table with multiple constraints and indexes
      const table = {
        id: 1,
        name: 'complex_constraints',
        fields: [
          { id: 1, name: 'email', type: 'email' as const },
          { id: 2, name: 'username', type: 'single-line-text' as const },
          { id: 3, name: 'created_at', type: 'date' as const },
        ],
        uniqueConstraints: [
          { name: 'unique_email', fields: ['email'] },
          { name: 'unique_username', fields: ['username'] },
          { name: 'unique_email_username', fields: ['email', 'username'] },
        ],
        indexes: [
          { name: 'idx_email', fields: ['email'], unique: true },
          { name: 'idx_created_at', fields: ['created_at'], unique: false },
          { name: 'idx_composite', fields: ['username', 'created_at'], unique: false },
        ],
      }

      // WHEN: The table is validated against the schema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The table should be accepted with all constraints
      expect(result.uniqueConstraints?.length).toBe(3)
      expect(result.indexes?.length).toBe(3)
    })
  })
})
