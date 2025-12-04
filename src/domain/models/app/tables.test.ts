/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Schema } from 'effect'
import { TablesSchema, TableSchema, type Tables, type Table } from './tables'

describe('TablesSchema', () => {
  describe('Valid Tables Collections', () => {
    test('should accept empty array of tables', () => {
      // GIVEN: An empty array of tables
      const tables: readonly unknown[] = []

      // WHEN: The tables array is validated against the schema
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: The empty array should be accepted
      expect(result).toEqual([])
      expect(result.length).toBe(0)
    })

    test('should accept array with single table', () => {
      // GIVEN: An array containing one table
      const tables = [
        {
          id: 1,
          name: 'users',
          fields: [
            {
              id: 1,
              name: 'email',
              type: 'email' as const,
              required: true,
            },
          ],
        },
      ]

      // WHEN: The tables array is validated against the schema
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: The array should be accepted with one table
      expect(result.length).toBe(1)
      expect(result[0]!.name).toBe('users')
      expect(result[0]!.fields.length).toBe(1)
    })

    test('should accept array with multiple tables', () => {
      // GIVEN: An array containing multiple tables
      const tables = [
        {
          id: 1,
          name: 'users',
          fields: [
            { id: 1, name: 'email', type: 'email' as const },
            { id: 2, name: 'name', type: 'single-line-text' as const },
          ],
        },
        {
          id: 2,
          name: 'products',
          fields: [
            { id: 1, name: 'title', type: 'single-line-text' as const },
            { id: 2, name: 'price', type: 'currency' as const, currency: 'USD' },
          ],
        },
        {
          id: 3,
          name: 'orders',
          fields: [
            { id: 1, name: 'order_id', type: 'integer' as const },
            { id: 2, name: 'total', type: 'currency' as const, currency: 'EUR' },
          ],
        },
      ]

      // WHEN: The tables array is validated against the schema
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: The array should be accepted with all tables
      expect(result.length).toBe(3)
      expect(result[0]!.name).toBe('users')
      expect(result[1]!.name).toBe('products')
      expect(result[2]!.name).toBe('orders')
    })

    test('should accept tables with different optional properties', () => {
      // GIVEN: Tables with varying optional properties
      const tables = [
        {
          id: 1,
          name: 'minimal',
          fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
        },
        {
          id: 2,
          name: 'with_primary_key',
          fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
          primaryKey: { type: 'simple' as const, field: 'field1' },
        },
        {
          id: 3,
          name: 'with_constraints',
          fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
          uniqueConstraints: [{ name: 'unique_field1', fields: ['field1'] }],
        },
        {
          id: 4,
          name: 'with_indexes',
          fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
          indexes: [{ name: 'idx_field1', fields: ['field1'], unique: false }],
        },
      ]

      // WHEN: The tables array is validated against the schema
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: All tables should be accepted with their respective properties
      expect(result.length).toBe(4)
      expect(result[0]!.primaryKey).toBeUndefined()
      expect(result[1]!.primaryKey).toBeDefined()
      expect(result[2]!.uniqueConstraints).toBeDefined()
      expect(result[3]!.indexes).toBeDefined()
    })

    test('should accept tables with complex field configurations', () => {
      // GIVEN: Tables with various field types and configurations
      const tables = [
        {
          id: 1,
          name: 'text_fields',
          fields: [
            { id: 1, name: 'short', type: 'single-line-text' as const },
            { id: 2, name: 'long', type: 'long-text' as const },
            { id: 3, name: 'phone', type: 'phone-number' as const },
          ],
        },
        {
          id: 2,
          name: 'number_fields',
          fields: [
            { id: 1, name: 'integer', type: 'integer' as const },
            { id: 2, name: 'decimal', type: 'decimal' as const, precision: 2 },
            {
              id: 3,
              name: 'currency',
              type: 'currency' as const,
              currency: 'USD',
              precision: 2,
            },
            { id: 4, name: 'percentage', type: 'percentage' as const, precision: 1 },
          ],
        },
      ]

      // WHEN: The tables array is validated against the schema
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: All tables should be accepted with correct field types
      expect(result.length).toBe(2)
      expect(result[0]!.fields.length).toBe(3)
      expect(result[1]!.fields.length).toBe(4)
      expect(result[1]!.fields[2]!.type).toBe('currency')
    })
  })

  describe('Invalid Tables Collections - Wrong Type', () => {
    test('should reject non-array value', () => {
      // GIVEN: An object instead of an array
      const tables = {
        id: 1,
        name: 'users',
        fields: [],
      }

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow()
    })

    test('should reject string value', () => {
      // GIVEN: A string instead of an array
      const tables = 'not an array'

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow()
    })

    test('should reject number value', () => {
      // GIVEN: A number instead of an array
      const tables = 123

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow()
    })

    test('should reject null value', () => {
      // GIVEN: A null value
      const tables = null

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow()
    })

    test('should reject undefined value', () => {
      // GIVEN: An undefined value
      const tables = undefined

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow()
    })
  })

  describe('Invalid Tables Collections - Invalid Table Items', () => {
    test('should accept array containing table without id (auto-generated)', () => {
      // GIVEN: An array with a table missing id field
      const tables = [
        {
          name: 'users',
          fields: [{ id: 1, name: 'email', type: 'email' as const }],
        },
      ]

      // WHEN: The validation is performed
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: The validation should succeed and auto-generate ID
      expect(result[0]!.name).toBe('users')
      expect(result[0]!.id).toBe(1) // Auto-generated ID starts at 1
    })

    test('should reject array containing invalid table (missing name)', () => {
      // GIVEN: An array with a table missing required name field
      const tables = [
        {
          id: 1,
          fields: [{ id: 1, name: 'email', type: 'email' as const }],
        },
      ]

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow()
    })

    test('should reject array containing invalid table (missing fields)', () => {
      // GIVEN: An array with a table missing required fields array
      const tables = [
        {
          id: 1,
          name: 'users',
        },
      ]

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow()
    })

    test('should reject array containing table with empty fields array', () => {
      // GIVEN: An array with a table with empty fields
      const tables = [
        {
          id: 1,
          name: 'users',
          fields: [],
        },
      ]

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow()
    })

    test('should reject array containing non-table primitive values', () => {
      // GIVEN: An array containing primitive values instead of tables
      const tables = [1, 'two', true, null]

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow()
    })

    test('should reject array with mix of valid and invalid tables', () => {
      // GIVEN: An array with one valid and one invalid table
      const tables = [
        {
          id: 1,
          name: 'valid_table',
          fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
        },
        {
          id: 2,
          name: 'invalid_table',
          // Missing fields array
        },
      ]

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow()
    })

    test('should reject array containing table with invalid field', () => {
      // GIVEN: An array with a table containing an invalid field
      const tables = [
        {
          id: 1,
          name: 'users',
          fields: [
            { id: 1, name: 'email' }, // missing 'type'
          ],
        },
      ]

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow()
    })

    test('should reject tables with duplicate IDs', () => {
      // GIVEN: Tables array with duplicate table IDs
      const tables = [
        {
          id: 1,
          name: 'users',
          fields: [{ id: 1, name: 'email', type: 'email' as const }],
        },
        {
          id: 1, // Duplicate ID
          name: 'products',
          fields: [{ id: 1, name: 'title', type: 'single-line-text' as const }],
        },
      ]

      // WHEN: Schema validation is performed
      // THEN: Validation should fail with uniqueness error
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow(/unique/i)
    })

    test('should accept tables with unique IDs', () => {
      // GIVEN: Tables array with unique IDs
      const tables = [
        {
          id: 1,
          name: 'users',
          fields: [{ id: 1, name: 'email', type: 'email' as const }],
        },
        {
          id: 2,
          name: 'products',
          fields: [{ id: 1, name: 'title', type: 'single-line-text' as const }],
        },
      ]

      // WHEN: Schema validation is performed
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: Both tables should be accepted
      expect(result.length).toBe(2)
      expect(result[0]!.id).toBe(1)
      expect(result[1]!.id).toBe(2)
    })
  })

  describe('Type Inference', () => {
    test('should infer Tables type correctly', () => {
      // GIVEN: A valid tables array
      const tables = [
        {
          id: 1,
          name: 'users',
          fields: [
            {
              id: 1,
              name: 'email',
              type: 'email' as const,
            },
          ],
        },
      ]

      // WHEN: The tables array is validated against the schema
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: TypeScript should infer the correct type
      const typedResult: Tables = result
      expect(typedResult.length).toBe(1)
      expect(typedResult[0]!.name).toBe('users')
    })

    test('should infer empty array type correctly', () => {
      // GIVEN: An empty tables array
      const tables: readonly unknown[] = []

      // WHEN: The tables array is validated against the schema
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: TypeScript should infer the correct type
      const typedResult: Tables = result
      expect(typedResult.length).toBe(0)
    })

    test('should infer individual table types correctly', () => {
      // GIVEN: A tables array
      const tables = [
        {
          id: 1,
          name: 'users',
          fields: [{ id: 1, name: 'email', type: 'email' as const }],
        },
        {
          id: 2,
          name: 'products',
          fields: [{ id: 1, name: 'title', type: 'single-line-text' as const }],
        },
      ]

      // WHEN: The tables array is validated against the schema
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: Each item should be a valid Table type
      const firstTable: Table = result[0]!
      const secondTable: Table = result[1]!
      expect(firstTable.name).toBe('users')
      expect(secondTable.name).toBe('products')
    })
  })

  describe('Re-exported Types', () => {
    test('should re-export Table type from table/index', () => {
      // GIVEN: A valid table
      const table = {
        id: 1,
        name: 'users',
        fields: [{ id: 1, name: 'email', type: 'email' as const }],
      }

      // WHEN: The table is validated against TableSchema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The result should match the re-exported Table type
      const typedResult: Table = result
      expect(typedResult.id).toBe(1)
    })

    test('should re-export TableSchema from table/index', () => {
      // GIVEN: A valid table
      const table = {
        id: 1,
        name: 'users',
        fields: [{ id: 1, name: 'email', type: 'email' as const }],
      }

      // WHEN: The table is validated against re-exported TableSchema
      const result = Schema.decodeUnknownSync(TableSchema)(table)

      // THEN: The validation should work correctly
      expect(result.name).toBe('users')
    })
  })

  describe('Edge Cases', () => {
    test('should accept very large array of tables', () => {
      // GIVEN: A large array of tables
      const tables = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `table_${i + 1}`,
        fields: [
          {
            id: 1,
            name: 'field1',
            type: 'single-line-text' as const,
          },
        ],
      }))

      // WHEN: The tables array is validated against the schema
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: All tables should be accepted
      expect(result.length).toBe(100)
      expect(result[0]!.name).toBe('table_1')
      expect(result[99]!.name).toBe('table_100')
    })

    test('should reject tables with duplicate names', () => {
      // GIVEN: Multiple tables with the same name
      const tables = [
        {
          id: 1,
          name: 'users',
          fields: [{ id: 1, name: 'email', type: 'email' as const }],
        },
        {
          id: 2,
          name: 'users', // Duplicate name
          fields: [{ id: 1, name: 'username', type: 'single-line-text' as const }],
        },
      ]

      // WHEN/THEN: The validation should fail
      expect(() => {
        Schema.decodeUnknownSync(TablesSchema)(tables)
      }).toThrow(/Table names must be unique/)
    })

    test('should accept tables with various ID values', () => {
      // GIVEN: Tables with different ID ranges
      const tables = [
        {
          id: 1,
          name: 'table_min',
          fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
        },
        {
          id: 1000,
          name: 'table_mid',
          fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
        },
        {
          id: 9_007_199_254_740_991, // MAX_SAFE_INTEGER
          name: 'table_max',
          fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
        },
      ]

      // WHEN: The tables array is validated against the schema
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: All tables should be accepted
      expect(result.length).toBe(3)
      expect(result[0]!.id).toBe(1)
      expect(result[2]!.id).toBe(9_007_199_254_740_991)
    })

    test('should preserve order of tables', () => {
      // GIVEN: Tables in specific order
      const tables = [
        {
          id: 3,
          name: 'third',
          fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
        },
        {
          id: 1,
          name: 'first',
          fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
        },
        {
          id: 2,
          name: 'second',
          fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
        },
      ]

      // WHEN: The tables array is validated against the schema
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: Order should be preserved (not sorted by id)
      expect(result[0]!.name).toBe('third')
      expect(result[1]!.name).toBe('first')
      expect(result[2]!.name).toBe('second')
    })

    test('should accept tables with all optional properties defined', () => {
      // GIVEN: Tables with all optional properties
      const tables = [
        {
          id: 1,
          name: 'complete_table',
          fields: [{ id: 1, name: 'field1', type: 'single-line-text' as const }],
          primaryKey: {
            type: 'simple' as const,
            field: 'field1',
          },
          uniqueConstraints: [{ name: 'unique_field1', fields: ['field1'] }],
          indexes: [{ name: 'idx_field1', fields: ['field1'], unique: false }],
        },
      ]

      // WHEN: The tables array is validated against the schema
      const result = Schema.decodeUnknownSync(TablesSchema)(tables)

      // THEN: All optional properties should be present
      expect(result[0]!.primaryKey).toBeDefined()
      expect(result[0]!.uniqueConstraints).toBeDefined()
      expect(result[0]!.indexes).toBeDefined()
    })
  })
})
