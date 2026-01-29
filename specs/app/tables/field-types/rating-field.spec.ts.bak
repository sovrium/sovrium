/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Rating Field
 *
 * Source: src/domain/models/app/table/field-types/rating-field.ts
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Rating Field', () => {
  test(
    'APP-TABLES-FIELD-TYPES-RATING-001: should create PostgreSQL INTEGER column for rating storage when table configuration has rating field',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration with rating field
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'reviews',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'rating', type: 'rating' },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database schema
      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='reviews' AND column_name='rating'"
      )

      // THEN: column should be INTEGER type
      expect(columnInfo.data_type).toBe('integer')
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        'INSERT INTO reviews (rating) VALUES (5) RETURNING rating'
      )
      expect(validInsert.rating).toBe(5)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RATING-002: should enforce range constraint for rating values (typically 1-5)',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 2,
            name: 'products',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'rating', type: 'rating', max: 5 },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const validInsert = await executeQuery(
        'INSERT INTO products (rating) VALUES (3) RETURNING rating'
      )
      // THEN: assertion
      expect(validInsert.rating).toBe(3)

      // THEN: assertion
      await expect(executeQuery('INSERT INTO products (rating) VALUES (0)')).rejects.toThrow(
        /violates check constraint/
      )

      // THEN: assertion
      await expect(executeQuery('INSERT INTO products (rating) VALUES (6)')).rejects.toThrow(
        /violates check constraint/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RATING-003: should reject NULL value when rating field is required',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 3,
            name: 'feedback',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'rating', type: 'rating', required: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='feedback' AND column_name='rating'"
      )
      // THEN: assertion
      expect(notNullCheck.is_nullable).toBe('NO')

      // THEN: assertion
      await expect(executeQuery('INSERT INTO feedback (rating) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RATING-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 4,
            name: 'items',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'rating', type: 'rating', default: 3 },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const defaultInsert = await executeQuery(
        'INSERT INTO items (id) VALUES (DEFAULT) RETURNING rating'
      )
      // THEN: assertion
      expect(defaultInsert.rating).toBe(3)
    }
  )

  test(
    'APP-TABLES-FIELD-TYPES-RATING-005: should create btree index for fast queries when rating field has indexed=true',
    { tag: '@spec' },
    async ({ startServerWithSchema, executeQuery }) => {
      // GIVEN: table configuration
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 5,
            name: 'movies',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'rating', type: 'rating', required: true, indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      // WHEN: querying the database
      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_movies_rating'"
      )
      // THEN: assertion
      expect(indexExists.indexname).toBe('idx_movies_rating')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 5 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-TABLES-FIELD-TYPES-RATING-REGRESSION: user can complete full rating-field workflow',
    { tag: '@regression' },
    async ({ startServerWithSchema, executeQuery }) => {
      // Setup: Start server with rating fields demonstrating all configurations
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'data',
            fields: [
              { id: 1, name: 'id', type: 'integer', required: true },
              { id: 2, name: 'rating', type: 'rating' },
              { id: 3, name: 'constrained_rating', type: 'rating', max: 5 },
              { id: 4, name: 'required_rating', type: 'rating', required: true },
              { id: 5, name: 'defaulted_rating', type: 'rating', default: 3 },
              { id: 6, name: 'indexed_rating', type: 'rating', indexed: true },
            ],
            primaryKey: { type: 'composite', fields: ['id'] },
          },
        ],
      })

      await test.step('APP-TABLES-FIELD-TYPES-RATING-001: Creates PostgreSQL INTEGER column for rating storage', async () => {
        // WHEN: querying column info for rating field
        const columnInfo = await executeQuery(
          "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='rating'"
        )
        // THEN: INTEGER column is created
        expect(columnInfo.data_type).toBe('integer')
        expect(columnInfo.is_nullable).toBe('YES')

        // WHEN: inserting a rating value
        const validInsert = await executeQuery(
          'INSERT INTO data (rating, required_rating) VALUES (5, 1) RETURNING rating'
        )
        // THEN: value is stored correctly
        expect(validInsert.rating).toBe(5)
      })

      await test.step('APP-TABLES-FIELD-TYPES-RATING-002: Enforces range constraint for rating values', async () => {
        // WHEN: inserting valid rating within range
        const validInsert = await executeQuery(
          'INSERT INTO data (constrained_rating, required_rating) VALUES (3, 2) RETURNING constrained_rating'
        )
        // THEN: value is stored correctly
        expect(validInsert.constrained_rating).toBe(3)

        // WHEN: attempting to insert rating below range
        // THEN: CHECK constraint rejects insertion
        await expect(
          executeQuery('INSERT INTO data (constrained_rating, required_rating) VALUES (0, 3)')
        ).rejects.toThrow(/violates check constraint/)

        // WHEN: attempting to insert rating above range
        // THEN: CHECK constraint rejects insertion
        await expect(
          executeQuery('INSERT INTO data (constrained_rating, required_rating) VALUES (6, 4)')
        ).rejects.toThrow(/violates check constraint/)
      })

      await test.step('APP-TABLES-FIELD-TYPES-RATING-003: Rejects NULL value when required', async () => {
        // WHEN: querying NOT NULL constraint
        const notNullCheck = await executeQuery(
          "SELECT is_nullable FROM information_schema.columns WHERE table_name='data' AND column_name='required_rating'"
        )
        // THEN: column has NOT NULL constraint
        expect(notNullCheck.is_nullable).toBe('NO')

        // WHEN: attempting to insert NULL for required rating
        // THEN: NOT NULL constraint rejects insertion
        await expect(
          executeQuery('INSERT INTO data (required_rating) VALUES (NULL)')
        ).rejects.toThrow(/violates not-null constraint/)
      })

      await test.step('APP-TABLES-FIELD-TYPES-RATING-004: Applies DEFAULT value', async () => {
        // WHEN: inserting row without providing defaulted_rating value
        const defaultInsert = await executeQuery(
          'INSERT INTO data (required_rating) VALUES (5) RETURNING defaulted_rating'
        )
        // THEN: DEFAULT value is applied
        expect(defaultInsert.defaulted_rating).toBe(3)
      })

      await test.step('APP-TABLES-FIELD-TYPES-RATING-005: Creates btree index when indexed=true', async () => {
        // WHEN: checking for btree index on indexed rating field
        const indexExists = await executeQuery(
          "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_data_indexed_rating'"
        )
        // THEN: btree index exists
        expect(indexExists.indexname).toBe('idx_data_indexed_rating')
      })
    }
  )
})
