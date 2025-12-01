/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Percentage Field
 *
 * Source: src/domain/models/app/table/field-types/percentage-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Percentage Field', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per spec)
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-PERCENTAGE-001: should create PostgreSQL DECIMAL column for percentage storage when table configuration has percentage field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with percentage field 'completion'
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'completion', type: 'percentage' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: field migration creates column
      // THEN: PostgreSQL DECIMAL column is created for percentage values
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='tasks' AND column_name='completion'"
      )
      // THEN: assertion
      expect(columnInfo.column_name).toBe('completion')
      expect(columnInfo.data_type).toMatch(/numeric|decimal/)
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        'INSERT INTO tasks (completion) VALUES (75.5) RETURNING completion'
      )
      // THEN: assertion
      expect(parseFloat(validInsert.completion)).toBe(75.5)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-PERCENTAGE-002: should reject values outside min/max range when CHECK constraint enforces range validation',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with percentage field 'progress' (min=0, max=100)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'projects',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'progress', type: 'percentage', min: 0, max: 100 },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: CHECK constraint enforces range validation
      // THEN: PostgreSQL rejects values outside min/max range
      const validInsert = await executeQuery(
        'INSERT INTO projects (progress) VALUES (50.0) RETURNING progress'
      )
      // THEN: assertion
      expect(parseFloat(validInsert.progress)).toBe(50)

      // THEN: assertion
      await expect(executeQuery('INSERT INTO projects (progress) VALUES (-0.1)')).rejects.toThrow(
        /violates check constraint/
      )

      // THEN: assertion
      await expect(executeQuery('INSERT INTO projects (progress) VALUES (100.1)')).rejects.toThrow(
        /violates check constraint/
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-PERCENTAGE-003: should enforce NOT NULL and UNIQUE constraints when percentage field is required and unique',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with percentage field 'score' (required, unique)
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'scores',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'score',
                type: 'percentage',
                unique: true,
                required: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // GIVEN: table configuration
      await executeQuery(['INSERT INTO scores (score) VALUES (95.5)'])

      // WHEN: constraints are applied
      // THEN: PostgreSQL enforces NOT NULL and UNIQUE constraints
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='scores' AND column_name='score'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      // THEN: assertion
      await expect(executeQuery('INSERT INTO scores (score) VALUES (95.5)')).rejects.toThrow(
        /duplicate key value violates unique constraint/
      )

      // THEN: assertion
      await expect(executeQuery('INSERT INTO scores (score) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-PERCENTAGE-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table with percentage field 'discount' and default value 10.0
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'promotions',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'discount', type: 'percentage', default: 10.0 },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: row inserted without providing discount value
      // THEN: PostgreSQL applies DEFAULT value 10.0
      const defaultInsert = await executeQuery(
        'INSERT INTO promotions (id) VALUES (DEFAULT) RETURNING discount'
      )
      // THEN: assertion
      expect(parseFloat(defaultInsert.discount)).toBe(10)

      const explicitInsert = await executeQuery(
        'INSERT INTO promotions (discount) VALUES (25.0) RETURNING discount'
      )
      // THEN: assertion
      expect(parseFloat(explicitInsert.discount)).toBe(25)
    }
  )

  test.fixme(
    'APP-TABLES-FIELD-TYPES-PERCENTAGE-005: should create btree index for fast queries when percentage field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with percentage field 'rating', indexed=true
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'reviews',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'rating',
                type: 'percentage',
                required: true,
                indexed: true,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: index is created on the percentage field
      // THEN: PostgreSQL btree index exists for fast queries
      const indexExists = await executeQuery(
        "SELECT indexname, tablename FROM pg_indexes WHERE indexname = 'idx_reviews_rating'"
      )
      // THEN: assertion
      expect(indexExists).toEqual({
        indexname: 'idx_reviews_rating',
        tablename: 'reviews',
      })
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly one test)
  // ============================================================================

  test.fixme(
    'APP-TABLES-FIELD-TYPES-PERCENTAGE-006: user can complete full percentage-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: Application configured with representative percentage field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 6,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              {
                id: 2,
                name: 'percentage_field',
                type: 'percentage',
                required: true,
                indexed: true,
                min: 0,
                max: 100,
                default: 50.0,
              },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      const columnInfo = await executeQuery(
        "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='percentage_field'"
      )
      // THEN: assertion
      expect(columnInfo.data_type).toMatch(/numeric|decimal/)
      expect(columnInfo.is_nullable).toBe('NO')

      // Test percentage range (0-100)
      await executeQuery('INSERT INTO data (percentage_field) VALUES (75.25)')
      const stored = await executeQuery('SELECT percentage_field FROM data WHERE id = 1')
      // THEN: assertion
      expect(parseFloat(stored.percentage_field)).toBe(75.25)

      // Verify out-of-range rejected
      // THEN: assertion
      await expect(
        executeQuery('INSERT INTO data (percentage_field) VALUES (150.0)')
      ).rejects.toThrow(/violates check constraint/)
    }
  )
})
