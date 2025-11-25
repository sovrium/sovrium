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
 * Source: specs/app/tables/field-types/rating-field/rating-field.schema.json
 * Domain: app
 * Spec Count: 5
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (5 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Rating Field', () => {
  test.fixme(
    'APP-RATING-FIELD-001: should create PostgreSQL INTEGER column for rating storage when table configuration has rating field',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_reviews',
            name: 'reviews',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'rating', type: 'rating' },
            ],
          },
        ],
      })

      const columnInfo = await executeQuery(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='reviews' AND column_name='rating'"
      )
      expect(columnInfo.data_type).toBe('integer')
      expect(columnInfo.is_nullable).toBe('YES')

      const validInsert = await executeQuery(
        'INSERT INTO reviews (rating) VALUES (5) RETURNING rating'
      )
      expect(validInsert.rating).toBe(5)
    }
  )

  test.fixme(
    'APP-RATING-FIELD-002: should enforce range constraint for rating values (typically 1-5)',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_products',
            name: 'products',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'rating', type: 'rating', min: 1, max: 5 },
            ],
          },
        ],
      })

      const validInsert = await executeQuery(
        'INSERT INTO products (rating) VALUES (3) RETURNING rating'
      )
      expect(validInsert.rating).toBe(3)

      await expect(executeQuery('INSERT INTO products (rating) VALUES (0)')).rejects.toThrow(
        /violates check constraint/
      )

      await expect(executeQuery('INSERT INTO products (rating) VALUES (6)')).rejects.toThrow(
        /violates check constraint/
      )
    }
  )

  test.fixme(
    'APP-RATING-FIELD-003: should reject NULL value when rating field is required',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_feedback',
            name: 'feedback',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'rating', type: 'rating', required: true },
            ],
          },
        ],
      })

      const notNullCheck = await executeQuery(
        "SELECT is_nullable FROM information_schema.columns WHERE table_name='feedback' AND column_name='rating'"
      )
      expect(notNullCheck.is_nullable).toBe('NO')

      await expect(executeQuery('INSERT INTO feedback (rating) VALUES (NULL)')).rejects.toThrow(
        /violates not-null constraint/
      )
    }
  )

  test.fixme(
    'APP-RATING-FIELD-004: should apply DEFAULT value when row inserted without providing value',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_items',
            name: 'items',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'rating', type: 'rating', default: 3 },
            ],
          },
        ],
      })

      const defaultInsert = await executeQuery(
        'INSERT INTO items (id) VALUES (DEFAULT) RETURNING rating'
      )
      expect(defaultInsert.rating).toBe(3)
    }
  )

  test.fixme(
    'APP-RATING-FIELD-005: should create btree index for fast queries when rating field has indexed=true',
    { tag: '@spec' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_movies',
            name: 'movies',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              { name: 'rating', type: 'rating', required: true, indexed: true },
            ],
          },
        ],
      })

      const indexExists = await executeQuery(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_movies_rating'"
      )
      expect(indexExists.indexname).toBe('idx_movies_rating')
    }
  )

  test.fixme(
    'user can complete full rating-field workflow',
    { tag: '@regression' },
    async ({
      page,
      startServerWithSchema,
      executeQuery,
    }) => {
      await startServerWithSchema({
        name: 'test-app',
        tables: [
          {
            id: 'tbl_data',
            name: 'data',
            fields: [
              { name: 'id', type: 'integer', constraints: { primaryKey: true } },
              {
                name: 'rating_field',
                type: 'rating',
                required: true,
                indexed: true,
                min: 1,
                max: 5,
                default: 3,
              },
            ],
          },
        ],
      })

      await executeQuery('INSERT INTO data (rating_field) VALUES (4)')
      const stored = await executeQuery('SELECT rating_field FROM data WHERE id = 1')
      expect(stored.rating_field).toBe(4)

      const avgRating = await executeQuery('SELECT AVG(rating_field) as avg FROM data')
      expect(avgRating.avg).toBeTruthy()
    }
  )
})
